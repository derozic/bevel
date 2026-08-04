# BEVEL charts (D3)

Agents can emit **chart objects** in channel replies. The web client parses fenced JSON and renders D3 visuals inline.

## Fenced protocol

````markdown
```bevel-chart
{
  "type": "bar",
  "title": "Token consumption — current month",
  "unit": "M tokens",
  "data": [
    { "label": "Week 1", "value": 12.4 },
    { "label": "Week 2", "value": 18.1 }
  ]
}
```
````

Aliases: `bevel-chart`, `chart`, `bevel_chart`.

## Types

| type | fields | notes |
|------|--------|--------|
| `bar` / `hbar` | `data[]` or `series[]` | token spend, counts |
| `line` / `area` | `series[]` or `data[]` | trends |
| `pie` / `donut` | `data[]` | shares |
| `gantt` | `tasks[]` | timelines (`start`/`end` ISO or epoch) |

Schema: `@bevel/schema` → `bevelChartSpecSchema`  
Render: `@bevel/charts` → `<BevelChart spec={…} />`  
Chat: `@bevel/realtime-client` `ChatMessageBody` auto-detects fences.

## Mildred

`@mildred` is the cost / token books agent. When answering spend or usage questions she should:

1. Short prose answer  
2. One ` ```bevel-chart ` block (prefer `bar` or `line`)  
3. Caveats (approx, lag, missing meters)

## Packages

- `packages/schema/src/charts.ts`  
- `packages/charts/` (D3)  
- `packages/charts/README.md`  
