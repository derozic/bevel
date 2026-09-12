# IoT Systems

Device fleets, connectivity, and digital-physical control loops for facilities intelligence.

## When to use

- Sensor / actuator deployments
- Device inventory and health
- Edge vs cloud processing choices

## Design checklist

| Topic | Decision |
|-------|----------|
| Connectivity | Wi-Fi / Thread / Ethernet / cellular |
| Power | Mains / PoE / battery life |
| Identity | Device auth, rotate credentials via @veda |
| Telemetry | Metrics, interval, retention (@mildred cost) |
| Fail mode | Safe default on disconnect |
| Update | OTA path and rollback |

## Output contract

```markdown
## IoT Design — YYYY-MM-DD
**Site / system:** ...

### Devices
...

### Data flow
...

### Risks
...
```
