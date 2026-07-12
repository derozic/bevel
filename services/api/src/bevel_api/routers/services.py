"""Service lifecycle REST routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from bevel_api.lib import processes

router = APIRouter(prefix="/v1/services", tags=["Services"])


class ServiceStatusOut(BaseModel):
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


class ServiceActionRequest(BaseModel):
    only: list[str] | None = Field(
        default=None,
        description="Subset of services: web, admin, realtime, api",
    )
    skip: list[str] = Field(default_factory=list)


def _status_out(s: processes.ServiceStatus) -> ServiceStatusOut:
    return ServiceStatusOut(
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


@router.get("", response_model=list[ServiceStatusOut])
def list_services() -> list[ServiceStatusOut]:
    return [_status_out(s) for s in processes.get_all_statuses()]


@router.get("/monitor/snapshot", response_model=list[ServiceStatusOut])
def monitor_snapshot(
    only: str | None = Query(None, description="Comma-separated service names"),
) -> list[ServiceStatusOut]:
    names = tuple(p.strip() for p in only.split(",")) if only else None
    if names:
        unknown = set(names) - set(processes.SERVICE_NAMES)
        if unknown:
            raise HTTPException(400, f"unknown services: {', '.join(sorted(unknown))}")
    return [_status_out(s) for s in processes.get_all_statuses(names)]


@router.post("/start", response_model=list[ServiceStatusOut])
def start_services(body: ServiceActionRequest | None = None) -> list[ServiceStatusOut]:
    body = body or ServiceActionRequest()
    only = tuple(body.only) if body.only else None
    try:
        results = processes.start_services(only=only, skip=tuple(body.skip))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return [_status_out(s) for s in results]


@router.post("/stop", response_model=list[ServiceStatusOut])
def stop_services(body: ServiceActionRequest | None = None) -> list[ServiceStatusOut]:
    body = body or ServiceActionRequest()
    only = tuple(body.only) if body.only else None
    try:
        results = processes.stop_services(only=only, skip=tuple(body.skip))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return [_status_out(s) for s in results]


@router.get("/{name}", response_model=ServiceStatusOut)
def get_service(name: str) -> ServiceStatusOut:
    if name not in processes.SERVICE_NAMES:
        raise HTTPException(404, f"unknown service: {name}")
    return _status_out(processes.get_status(name))


@router.post("/{name}/start", response_model=ServiceStatusOut)
def start_one(name: str) -> ServiceStatusOut:
    if name not in processes.SERVICE_NAMES:
        raise HTTPException(404, f"unknown service: {name}")
    return _status_out(processes.start_service(name))


@router.post("/{name}/stop", response_model=ServiceStatusOut)
def stop_one(name: str) -> ServiceStatusOut:
    if name not in processes.SERVICE_NAMES:
        raise HTTPException(404, f"unknown service: {name}")
    return _status_out(processes.stop_service(name))
