# @bevel/charts

D3 charts for BEVEL. Agents emit **bevel-chart** JSON in chat; the client renders them inline.

## Agent protocol

In a channel reply, include a fenced block:

````markdown
Here's this month's token spend by day:

```bevel-chart
{
  "type": "bar",
  "title": "Token consumption — current month",
  "subtitle": "OpenRouter + fleet providers",
  "unit": "M tokens",
  "yLabel": "Tokens (M)",
  "data": [
    { "label": "Week 1", "value": 12.4 },
    { "label": "Week 2", "value": 18.1 },
    { "label": "Week 3", "value": 15.6 },
    { "label": "Week 4", "value": 9.2 }
  ]
}
```

Totals are approximate until billing sync finishes.
````

### Chart types

| `type` | Data | Use |
|--------|------|-----|
| `bar` | `data[]` or `series[]` | Token spend, counts |
| `hbar` | `data[]` | Rankings, long labels |
| `line` / `area` | `series[]` or `data[]` | Trends over time |
| `pie` / `donut` | `data[]` | Share of total |
| `gantt` | `tasks[]` | Timelines / schedules |

### Example — Gantt

```bevel-chart
{
  "type": "gantt",
  "title": "Fleet work this sprint",
  "tasks": [
    { "label": "Mildred · spend audit", "start": "2026-08-01", "end": "2026-08-05" },
    { "label": "Johnny · Caddy heal", "start": "2026-08-03", "end": "2026-08-07" }
  ]
}
```

### Example — multi-series line

```bevel-chart
{
  "type": "line",
  "title": "Daily tokens by model",
  "series": [
    {
      "name": "claude-sonnet",
      "data": [
        { "x": "Mon", "y": 2.1 },
        { "x": "Tue", "y": 3.4 }
      ]
    },
    {
      "name": "gpt-5",
      "data": [
        { "x": "Mon", "y": 1.2 },
        { "x": "Tue", "y": 1.8 }
      ]
    }
  ]
}
```

## Mildred

Mildred is the analytics / spend agent. Prefer `bar` or `line` for token consumption, with clear `title`, `unit`, and short prose around the chart.
