"""BEVEL control plane — FastAPI REST + Strawberry GraphQL over Postgres."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from bevel_api.config import settings
from bevel_api.database import database
from bevel_api.graphql.schema import schema
from bevel_api.lib import realtime_proxy
from bevel_api.routers import announcements as announcements_router
from bevel_api.routers import devices as devices_router
from bevel_api.routers import fleet as fleet_router
from bevel_api.routers import handoff as handoff_router
from bevel_api.routers import services as services_router
from bevel_api.routers import tenants as tenants_router
from bevel_api.routers import workspaces as workspaces_router

log = logging.getLogger("bevel_api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    connected = False
    try:
        await database.connect()
        connected = True
        from bevel_api.seed import run_seed

        try:
            result = await run_seed()
            log.info("seed complete: %s", result)
        except Exception:
            log.exception("seed failed (API still up; check DATABASE_URL / migrations)")
    except Exception:
        log.exception(
            "database connect failed — set DATABASE_URL to postgresql+asyncpg://…"
        )
        if settings.require_database:
            # Still yield so process can report unhealthy; do not crash crash-loop
            # on transient DB restarts if you set REQUIRE_DATABASE=0.
            pass
    yield
    if connected:
        await database.disconnect()


app = FastAPI(
    title="BEVEL API",
    description=(
        "Control plane for BEVEL™ — multi-tenant workspace channels for humans and agents. "
        "REST + GraphQL over PostgreSQL for tenants, channels, messages, and auth handoff."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bevel.lvh.me",
        "https://api.bevel.lvh.me",
        "https://admin.bevel.lvh.me",
        "https://bevel.2x4m.lvh.me",
        "https://2x4m.bevel.lvh.me",
        "https://bevel.is",
        "https://www.bevel.is",
        "https://admin.bevel.is",
        "https://bevel.2x4m.cc",
        "http://127.0.0.1:43200",
        "http://localhost:43200",
        "http://127.0.0.1:43201",
        "http://localhost:43201",
    ],
    allow_origin_regex=(
        r"https://([a-z0-9-]+\.)*(bevel\.(lvh\.me|is|com)|2x4m\.(cc|lvh\.me|systems))"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_app = GraphQLRouter(schema, path="/graphql", graphql_ide="graphiql")
app.include_router(graphql_app)
app.include_router(services_router.router, prefix="/api")
app.include_router(tenants_router.router, prefix="/api")
app.include_router(announcements_router.router, prefix="/api")
app.include_router(devices_router.router, prefix="/api")
app.include_router(fleet_router.router, prefix="/api")
app.include_router(workspaces_router.router, prefix="/api")
app.include_router(handoff_router.router, prefix="/api")


@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "name": "BEVEL API",
        "version": "0.1.0",
        "mark": "BEVEL™",
        "rest": "/api/v1",
        "graphql": "/graphql",
        "docs": "/docs",
        "health": "/health",
        "mcp": "uv run bevel-mcp  (stdio tools → this API)",
        "storage": "postgresql",
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    rt = await realtime_proxy.realtime_health()
    db_status: dict[str, Any] = {
        "status": "disconnected",
        "driver": "asyncpg",
        "connected": database.is_connected,
    }
    if database.is_connected:
        try:
            from bevel_api.database import get_session
            from bevel_api.seed import database_counts

            async with get_session() as session:
                from sqlalchemy import text

                await session.execute(text("SELECT 1"))
                counts = await database_counts(session)
            db_status = {
                "status": "ok",
                "driver": "asyncpg",
                "connected": True,
                "counts": counts,
            }
        except Exception as exc:
            db_status = {
                "status": "error",
                "driver": "asyncpg",
                "connected": True,
                "error": str(exc)[:200],
            }

    overall = "ok" if db_status.get("status") == "ok" else "degraded"
    return {
        "status": overall,
        "service": "bevel-api",
        "version": "0.1.0",
        "database": db_status,
        "realtime": rt.get("status", "unknown"),
        "tenants_root": str(settings.tenants_root()),
    }


def run() -> None:
    uvicorn.run(
        "bevel_api.main:app",
        host="127.0.0.1",
        port=settings.api_port,
        reload=True,
    )


if __name__ == "__main__":
    run()
