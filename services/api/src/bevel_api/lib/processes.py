"""Local process start/stop/status for BEVEL stack services."""

from __future__ import annotations

import os
import signal
import socket
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

from bevel_api.config import settings


@dataclass(frozen=True)
class ServiceSpec:
    name: str
    label: str
    port: int
    health_path: str
    cwd: str
    command: list[str]
    public_url: str


def _specs() -> dict[str, ServiceSpec]:
    root = settings.bevel_repo_root
    return {
        "api": ServiceSpec(
            "api",
            "Control API",
            settings.api_port,
            "/health",
            "services/api",
            [
                "uv",
                "run",
                "uvicorn",
                "bevel_api.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(settings.api_port),
                "--reload",
            ],
            settings.public_api_url,
        ),
        "web": ServiceSpec(
            "web",
            "Web",
            settings.web_port,
            "/",
            "apps/web",
            ["pnpm", "dev"],
            settings.public_web_url,
        ),
        "admin": ServiceSpec(
            "admin",
            "Admin",
            settings.admin_port,
            "/",
            "apps/admin",
            ["pnpm", "dev"],
            "https://admin.bevel.lvh.me",
        ),
        "realtime": ServiceSpec(
            "realtime",
            "Realtime",
            settings.realtime_port,
            "/health",
            "services/realtime",
            ["pnpm", "dev"],
            settings.public_realtime_url,
        ),
    }


SERVICE_SPECS = _specs()
SERVICE_NAMES = tuple(SERVICE_SPECS.keys())
START_ORDER = ("realtime", "web", "admin")  # api is self; managed externally if needed
STOP_ORDER = ("admin", "web", "realtime")


@dataclass
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


def _run_dir() -> Path:
    path = settings.bevel_repo_root / ".run"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _log_dir() -> Path:
    path = settings.bevel_repo_root / "logs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def pid_path(name: str) -> Path:
    return _run_dir() / f"{name}.pid"


def log_path(name: str) -> Path:
    return _log_dir() / f"{name}.log"


def is_pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def read_pid(name: str) -> int | None:
    path = pid_path(name)
    if not path.is_file():
        return None
    try:
        pid = int(path.read_text(encoding="utf-8").strip())
    except ValueError:
        return None
    return pid if is_pid_alive(pid) else None


def write_pid(name: str, pid: int) -> None:
    pid_path(name).write_text(f"{pid}\n", encoding="utf-8")


def clear_pid(name: str) -> None:
    pid_path(name).unlink(missing_ok=True)


def probe_http(port: int, path: str, *, timeout: float = 1.5) -> tuple[bool, float | None]:
    url = f"http://127.0.0.1:{port}{path}"
    # Next multi-tenant web needs Host for a clean 200
    headers: dict[str, str] = {}
    if port == settings.web_port:
        headers["Host"] = "bevel.lvh.me"
    elif port == settings.admin_port:
        headers["Host"] = "admin.bevel.lvh.me"
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.get(url, headers=headers)
            latency = (time.perf_counter() - started) * 1000
            ok = 200 <= response.status_code < 500
            if path.rstrip("/").endswith("health"):
                ok = 200 <= response.status_code < 300
            return ok, latency
    except httpx.HTTPError:
        return False, None


def get_status(name: str) -> ServiceStatus:
    spec = SERVICE_SPECS[name]
    pid = read_pid(name)
    process_up = pid is not None or is_port_open(spec.port)
    http_up, latency = probe_http(spec.port, spec.health_path)
    if process_up and http_up:
        detail = "healthy"
    elif process_up:
        detail = "process up, HTTP down"
    elif http_up:
        detail = "port in use (untracked)"
    else:
        detail = "stopped"
    return ServiceStatus(
        name=spec.name,
        label=spec.label,
        port=spec.port,
        process_up=process_up,
        http_up=http_up,
        latency_ms=latency,
        pid=pid,
        detail=detail,
        public_url=spec.public_url,
        health_url=f"http://127.0.0.1:{spec.port}{spec.health_path}",
    )


def get_all_statuses(names: tuple[str, ...] | None = None) -> list[ServiceStatus]:
    selected = names or SERVICE_NAMES
    return [get_status(n) for n in selected]


def _pids_on_port(port: int) -> list[int]:
    try:
        result = subprocess.run(
            ["lsof", "-ti", f"tcp:{port}"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return []
    pids: list[int] = []
    for line in result.stdout.strip().splitlines():
        try:
            pids.append(int(line.strip()))
        except ValueError:
            continue
    return sorted(set(pids))


def _terminate_pid(pid: int, *, grace: float = 2.5) -> None:
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        return
    deadline = time.time() + grace
    while time.time() < deadline:
        if not is_pid_alive(pid):
            return
        time.sleep(0.1)
    try:
        os.kill(pid, signal.SIGKILL)
    except OSError:
        pass


def stop_service(name: str) -> ServiceStatus:
    if name == "api":
        # Do not kill ourselves via API call; report status only.
        return get_status("api")
    spec = SERVICE_SPECS[name]
    pid = read_pid(name)
    if pid is not None:
        _terminate_pid(pid)
    for p in _pids_on_port(spec.port):
        _terminate_pid(p)
    clear_pid(name)
    return get_status(name)


def start_service(name: str, *, wait: float = 20.0) -> ServiceStatus:
    if name == "api":
        return get_status("api")

    status = get_status(name)
    if status.process_up and status.http_up:
        return status

    if status.process_up:
        stop_service(name)

    spec = SERVICE_SPECS[name]
    cwd = settings.bevel_repo_root / spec.cwd
    log_file = log_path(name)
    env = os.environ.copy()
    env.setdefault("BEVEL_TENANTS_ROOT", str(settings.tenants_root()))
    env.setdefault("REALTIME_PORT", str(settings.realtime_port))
    env.setdefault("REALTIME_SERVER_URL", settings.realtime_server_url)
    env.setdefault("WEB_PORT", str(settings.web_port))
    env.setdefault("ADMIN_PORT", str(settings.admin_port))
    env.setdefault("NODE_OPTIONS", "--dns-result-order=ipv4first")
    env.setdefault("NEXT_TELEMETRY_DISABLED", "1")
    env.setdefault("WATCHPACK_POLLING", "true")

    with log_file.open("a", encoding="utf-8") as log:
        log.write(f"\n--- start {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
        proc = subprocess.Popen(
            spec.command,
            cwd=cwd,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=env,
        )
    write_pid(name, proc.pid)

    deadline = time.time() + wait
    while time.time() < deadline:
        st = get_status(name)
        if st.http_up:
            return st
        time.sleep(0.4)
    return get_status(name)


def start_services(
    only: tuple[str, ...] | None = None,
    skip: tuple[str, ...] = (),
) -> list[ServiceStatus]:
    names = set(only) if only else set(START_ORDER)
    names -= set(skip)
    unknown = names - set(SERVICE_NAMES)
    if unknown:
        raise ValueError(f"unknown services: {', '.join(sorted(unknown))}")
    results: list[ServiceStatus] = []
    for name in START_ORDER:
        if name in names:
            results.append(start_service(name))
    # Always include api status
    results.insert(0, get_status("api"))
    return results


def stop_services(
    only: tuple[str, ...] | None = None,
    skip: tuple[str, ...] = (),
) -> list[ServiceStatus]:
    names = set(only) if only else set(STOP_ORDER)
    names -= set(skip)
    unknown = names - set(SERVICE_NAMES)
    if unknown:
        raise ValueError(f"unknown services: {', '.join(sorted(unknown))}")
    results: list[ServiceStatus] = []
    for name in STOP_ORDER:
        if name in names:
            results.append(stop_service(name))
    results.append(get_status("api"))
    return results
