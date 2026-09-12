# NORTHSTAR Agent - Evaluation & Monitoring

## Core Purpose

NORTHSTAR continuously evaluates the agent fleet, mines logs for failure patterns, detects drift, and recommends remediation.

## Capabilities

### Fleet Discovery
- Enumerates registered agents via the shared registry
- Tracks per-agent health metrics and availability

### Log Mining
- Extracts error patterns, timeouts, and quality regressions
- Correlates failures across agents and workflows

### Drift Detection
- Behavioral drift from expected prompts and outputs
- Performance and cost drift over rolling windows

### Health Scoring
- Composite scores: availability, success rate, latency, cost efficiency
- Status bands: healthy, degraded, critical, offline

### Automated Remediation
- Low-risk fixes with rollback plans
- Escalation for human review on high-severity findings

## Recursive Skills

See `skills/` for specialized evaluation playbooks:
- `monitoring/` — metrics collection and alerting
- `evaluation/` — scoring frameworks and report templates
- `remediation/` — safe auto-fix patterns