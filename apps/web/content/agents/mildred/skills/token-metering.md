# Token Metering Skill

Track LLM usage across the fleet with consistent fields.

## Dimensions

- **product** — monorepo / tenant (2x4m, bevel, agents, preso, …)
- **model** — OpenRouter id or provider id (e.g. `anthropic/claude-opus-4.6`)
- **lane** — one of the five fleet-supported model families + `openrouter` as aggregator
- **environment** — local | staging | production | ci
- **phase** — input | inference | output (map provider fields when only prompt/completion exist)
- **period** — day / ISO week / month / quarter

## Provider field map

| Provider report | Mildred column |
|-----------------|----------------|
| prompt_tokens / input_tokens | input |
| completion_tokens / output_tokens | output |
| cache_read / cache_write (when present) | inference adj. / notes |
| total_tokens | input + output (+ cache if billed) |
| cost / native_tokens_cost | $ total |

## Rules

1. Prefer raw provider counters; never invent tokens.
2. Attribute to product via workspace, API key, or OpenRouter metadata tags.
3. Record **rate source** and **as-of** date on every $ figure.
4. Flag missing meters (agent run with zero usage telemetry).
