"""Strawberry GraphQL schema mirroring the REST control plane."""

from __future__ import annotations

from typing import Any

import strawberry
from strawberry.scalars import JSON

from bevel_api.database import database, get_session
from bevel_api.lib import processes, realtime_proxy, tenants
from bevel_api.repositories import channels as channels_repo
from bevel_api.repositories import messages as messages_repo
from bevel_api.repositories import tenants as tenants_repo


@strawberry.type
class Health:
    status: str
    service: str
    version: str
    database_status: str = "unknown"


@strawberry.type
class ServiceStatus:
    name: str
    label: str
    port: int
    process_up: bool
    http_up: bool
    latency_ms: float | None
    pid: int | None
    detail: str
    public_url: str
    health_url: str


@strawberry.type
class Tenant:
    slug: str
    name: str
    domain: str | None
    hosts: list[str]
    auth_mode: str | None
    realtime_namespace: str
    has_theme: bool


@strawberry.type
class Channel:
    slug: str
    name: str
    tags: list[str]
    href: str


@strawberry.type
class Message:
    id: str
    speaker_id: str
    speaker_name: str
    body: str
    created_at: str | None
    mentioned_agent_ids: list[str]


@strawberry.type
class Agent:
    id: str
    name: str
    role: str


@strawberry.type
class PublicUrls:
    web: str
    api: str
    api_docs: str
    graphql: str
    realtime_health: str
    admin: str
    login: str
    workspace: str


@strawberry.type
class PostMessageResult:
    ok: bool
    id: str
    body: str
    mentioned_agent_ids: list[str]


def _service(s: processes.ServiceStatus) -> ServiceStatus:
    return ServiceStatus(
        name=s.name,
        label=s.label,
        port=s.port,
        process_up=s.process_up,
        http_up=s.http_up,
        latency_ms=s.latency_ms,
        pid=s.pid,
        detail=s.detail,
        public_url=s.public_url,
        health_url=s.health_url,
    )


def _tenant(row: dict[str, Any]) -> Tenant:
    return Tenant(
        slug=str(row.get("slug") or ""),
        name=str(row.get("name") or ""),
        domain=row.get("domain"),
        hosts=list(row.get("hosts") or []),
        auth_mode=row.get("auth_mode"),
        realtime_namespace=str(row.get("realtime_namespace") or ""),
        has_theme=bool(row.get("has_theme")),
    )


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> Health:
        db = "ok" if database.is_connected else "disconnected"
        return Health(
            status="ok" if database.is_connected else "degraded",
            service="bevel-api",
            version="0.1.0",
            database_status=db,
        )

    @strawberry.field
    def services(self) -> list[ServiceStatus]:
        return [_service(s) for s in processes.get_all_statuses()]

    @strawberry.field
    def service(self, name: str) -> ServiceStatus | None:
        if name not in processes.SERVICE_NAMES:
            return None
        return _service(processes.get_status(name))

    @strawberry.field
    async def tenants(self) -> list[Tenant]:
        if database.is_connected:
            try:
                async with get_session() as session:
                    rows = await tenants_repo.list_tenants(session)
                    if rows:
                        return [
                            Tenant(
                                slug=r.slug,
                                name=r.name,
                                domain=r.domain,
                                hosts=list(r.hosts or []),
                                auth_mode=r.auth_mode,
                                realtime_namespace=r.realtime_namespace,
                                has_theme=bool(r.theme),
                            )
                            for r in rows
                        ]
            except Exception:
                pass
        return [_tenant(t) for t in tenants.list_tenants() if "slug" in t]

    @strawberry.field
    def tenant(self, slug: str) -> Tenant | None:
        try:
            return _tenant(tenants.summarize_tenant(tenants.load_tenant(slug)))
        except FileNotFoundError:
            return None

    @strawberry.field
    async def channels(self, tenant_slug: str = "2x4m") -> list[Channel]:
        if database.is_connected:
            try:
                async with get_session() as session:
                    row = await tenants_repo.get_by_slug(session, tenant_slug)
                    if row:
                        chs = await channels_repo.list_for_tenant(session, row.id)
                        if not chs:
                            chs = await channels_repo.ensure_defaults(session, row.id)
                        return [
                            Channel(
                                slug=c.slug,
                                name=c.name,
                                tags=list(c.tags or []),
                                href=f"/bevel/{c.slug}",
                            )
                            for c in chs
                        ]
            except Exception:
                pass
        try:
            rows = tenants.tenant_channels(tenant_slug)
        except FileNotFoundError:
            return []
        return [
            Channel(
                slug=r["slug"],
                name=r["name"],
                tags=list(r.get("tags") or []),
                href=r["href"],
            )
            for r in rows
        ]

    @strawberry.field
    async def messages(
        self,
        tenant_slug: str = "2x4m",
        channel_slug: str = "general",
        limit: int = 50,
    ) -> list[Message]:
        if not database.is_connected:
            return []
        async with get_session() as session:
            row = await tenants_repo.get_by_slug(session, tenant_slug)
            if not row:
                return []
            ch = await channels_repo.ensure_channel(session, row.id, channel_slug)
            msgs = await messages_repo.list_for_channel(
                session,
                tenant_id=row.id,
                channel_id=ch.id,
                limit=limit,
            )
            return [
                Message(
                    id=m.id,
                    speaker_id=m.speaker_id,
                    speaker_name=m.speaker_name,
                    body=m.body,
                    created_at=m.created_at.isoformat() if m.created_at else None,
                    mentioned_agent_ids=list(m.mentioned_agent_ids or []),
                )
                for m in msgs
            ]

    @strawberry.field
    def agents(self) -> list[Agent]:
        return [
            Agent(id=a["id"], name=a["name"], role=a["role"])
            for a in tenants.catalog_agents()
        ]

    @strawberry.field
    def urls(self) -> PublicUrls:
        from bevel_api.config import settings

        return PublicUrls(
            web=settings.public_web_url,
            api=settings.public_api_url,
            api_docs=f"{settings.public_api_url}/docs",
            graphql=f"{settings.public_api_url}/graphql",
            realtime_health=f"{settings.public_realtime_url}/health",
            admin="https://admin.bevel.lvh.me",
            login=f"{settings.public_web_url}/login",
            workspace=f"{settings.public_web_url}/bevel/general",
        )

    @strawberry.field
    async def realtime_health(self) -> JSON:
        return await realtime_proxy.realtime_health()


@strawberry.type
class Mutation:
    @strawberry.mutation
    def start_services(
        self,
        only: list[str] | None = None,
        skip: list[str] | None = None,
    ) -> list[ServiceStatus]:
        results = processes.start_services(
            only=tuple(only) if only else None,
            skip=tuple(skip or ()),
        )
        return [_service(s) for s in results]

    @strawberry.mutation
    def stop_services(
        self,
        only: list[str] | None = None,
        skip: list[str] | None = None,
    ) -> list[ServiceStatus]:
        results = processes.stop_services(
            only=tuple(only) if only else None,
            skip=tuple(skip or ()),
        )
        return [_service(s) for s in results]

    @strawberry.mutation
    def start_service(self, name: str) -> ServiceStatus:
        if name not in processes.SERVICE_NAMES:
            raise ValueError(f"unknown service: {name}")
        return _service(processes.start_service(name))

    @strawberry.mutation
    def stop_service(self, name: str) -> ServiceStatus:
        if name not in processes.SERVICE_NAMES:
            raise ValueError(f"unknown service: {name}")
        return _service(processes.stop_service(name))

    @strawberry.mutation
    async def post_message(
        self,
        body: str,
        tenant_slug: str = "2x4m",
        channel_slug: str = "general",
        speaker_id: str = "system",
        speaker_name: str = "system",
    ) -> PostMessageResult:
        if not database.is_connected:
            raise RuntimeError("Database is not connected")
        async with get_session() as session:
            row = await tenants_repo.get_by_slug(session, tenant_slug)
            if not row:
                raise ValueError(f"tenant not found: {tenant_slug}")
            ch = await channels_repo.ensure_channel(session, row.id, channel_slug)
            record = await messages_repo.append(
                session,
                tenant_id=row.id,
                channel_id=ch.id,
                channel_slug=ch.slug,
                msg={
                    "body": body,
                    "speakerId": speaker_id,
                    "speakerName": speaker_name,
                    "speakerType": "agent",
                },
            )
            return PostMessageResult(
                ok=True,
                id=record.id,
                body=record.body,
                mentioned_agent_ids=list(record.mentioned_agent_ids or []),
            )


schema = strawberry.Schema(query=Query, mutation=Mutation)
