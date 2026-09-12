# Sensors & Telemetry

Environmental and occupancy sensing: placement, calibration, and signal quality.

## When to use

- Temp / humidity / air / occupancy / energy metering
- Alert thresholds and false-positive control
- Integrating sensors into ops dashboards (@flux)

## Placement heuristics

- Avoid HVAC vents for temp/humidity
- Occupancy: coverage vs privacy (notice if needed — @portia)
- Power metering: circuit-level clarity
- Document calibration date and expected drift

## Output contract

```markdown
## Sensor Plan — YYYY-MM-DD
**Zone:** ...

### Sensors
| Type | Model | Location | Interval |

### Alerts
...

### Privacy notes
...
```
