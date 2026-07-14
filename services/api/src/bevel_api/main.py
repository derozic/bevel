"""BEVEL control plane — FastAPI REST + Strawberry GraphQL."""

from __future__ import annotations

from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from bevel_api.config import settings
from bevel_api.graphql.schema import schema
from bevel_api.lib import realtime_proxy
from bevel_api.routers import announcements as announcements_router
from bevel_api.routers import devices as devices_router
from bevel_api.routers import fleet as fleet_router
from bevel_api.routers import services as services_router
from bevel_api.routers import tenants as tenants_router

app = FastAPI(
    title="BEVEL API",
    description=(
        "Control plane for BEVEL™ — multi-tenant workspace channels for humans and agents. "
        "REST + GraphQL for services, tenants, channels, agents, sessions, and search."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bevel.lvh.me",
        "https://api.bevel.lvh.me",
        "https://admin.bevel.lvh.me",
        "https://bevel.2x4m.lvh.me",
        "https://2x4m.bevel.lvh.me",
        "http://127.0.0.1:43200",
        "http://localhost:43200",
        "http://127.0.0.1:43201",
        "http://localhost:43201",
    ],
    # Native clients may call from file:// or custom origins during dev
    allow_origin_regex=r"https://.*\.bevel\.(lvh\.me|com|cc)",
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
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    rt = await realtime_proxy.realtime_health()
    return {
        "status": "ok",
        "service": "bevel-api",
        "version": "0.1.0",
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
