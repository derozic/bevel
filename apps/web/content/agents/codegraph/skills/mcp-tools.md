# MCP tool server

Expose code intelligence via MCP so fleet agents and external IDEs can query the graph without ad-hoc grepping.

## Tool posture

- Prefer MCP tools for symbol lookup, references, and dependency walks
- Keep payloads token-efficient
- Fail closed with a clear message when the graph or MCP server is unavailable
- Never invent symbols; only report what the index knows

## Consumers

Hermes, Cadence reports (Lego, Brain), Claude Code, Cursor, Codex, and any MCP-capable agent in the workspace.
