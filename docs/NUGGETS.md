# Channel nuggets (atomic design)

Inbound integrations and agents insert **nuggets** into conversations. The scale is Brad Frost’s, so it can be linted (`lintNugget` in `@bevel/schema`):

| Scale | What it is | Where it lands |
|-------|------------|----------------|
| **atom** | Indivisible UX unit (chip, icon, metric) | In-thread |
| **molecule** | Two or more atoms bonded | In-thread |
| **organism** | Complex preview (task card, chart) | In-thread; Expand for detail |
| **template** | Page partial / wireframe of organisms | Right pane (desktop) / main pane (phone) |
| **page** | Template with real content | Full width |

Wire format: message body starts with `bevel-nugget:v1` then JSON.

Ingest (fleet internal key):

```http
POST /api/v1/ingest/nuggets
POST /api/ingest/nuggets
```

```json
{
  "track": "ops",
  "nugget": {
    "v": 1,
    "scale": "organism",
    "source": "clickup",
    "title": "Ship Magenta MCP card",
    "atoms": [
      { "kind": "chip", "label": "status", "value": "in review" },
      { "kind": "person", "label": "assignee", "value": "Scott" }
    ]
  }
}
```

POST persists `kind=nugget` onto the track (`messages_repo.append`) with a `bevel-nugget:v1` JSON body, then fans out `message.created`. Chat renders the body as `NuggetCard`. On native (`html[data-bevel-native=1]`), **template** / **page** Expand posts `BevelNuggets` JSON to Flutter `NuggetStage` (right pane on tablet/fold, main pane on phone).

A CMYK BrandKit share is an **organism** that links to a **process-token molecule**. Opening the molecule does not leave the conversation.

Flutter stages `template` / `page` in `NuggetStage` (main pane on compact; full width on iPad Pro, Pixel Tablet, Fold inner, Duo).
