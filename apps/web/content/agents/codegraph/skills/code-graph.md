# Code knowledge graph

Build and maintain a semantic graph of the repository: files, symbols, imports/exports, call edges, and type relationships.

## Priorities

1. Prefer graph queries over raw file reads for navigation
2. Keep index fresh (auto-sync on change when the runtime is available)
3. Return surgical context — exact functions, types, and edges the caller needs
4. State clearly when something is not indexed yet

## Languages

TypeScript, Python, Go, Rust, Swift, Kotlin, C#, Java, and others supported by the CodeGraph kernel. Mixed mobile/web stacks (React Native, Expo) included when present.
