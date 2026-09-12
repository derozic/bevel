# OpenRouter Routing

## Models

- `openrouter/auto` — exploration, Q&A, architecture
- `openrouter/pareto-code` — implementation with Pareto quality gate
- `anthropic/claude-sonnet-4.6` — fallback on errors or rate limits

## Pareto plugin payload

```json
{
  "plugins": [{ "id": "pareto", "min_coding_score": 0.65 }]
}
```

## Suffixes

- `:nitro` — prefer low-latency providers
- `:floor` — prefer lowest cost

## Cookbook

https://openrouter.ai/docs/cookbook/coding-agents/hermes-integration