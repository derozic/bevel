# Grilling (design-tree interview)

Core method for **@crucible** (named by Hermes). Protocol name stays "grilling"; agent identity is Crucible.

Upstream: [mattpocock/skills — grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md)
Entry skill: [grill-me](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md)

## When to use

- User wants a plan, decision, or idea stress-tested
- Trigger phrases: grill me, grilling, stress-test this plan, interview me on this design, sharpen this decision

## Method

Interview the user relentlessly until you reach a **shared understanding**. Map the subject as a **design tree**: every decision branches into the decisions that hang off it.

### Rounds and frontier

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask *now* without guessing at answers you have not heard yet.

- Ask the **entire frontier in one round**
- Number each question
- Give your **recommended answer** for each
- Then **wait** for the user's answers before the next round

Each round of answers reshapes the tree: settled decisions push the frontier outward and unblock dependent questions. Recompute the frontier. A question whose answer depends on another question still open in this round belongs to a **later** round, not this one.

### Facts vs decisions

- **Facts** are your job. When a frontier question needs a fact from the environment (repo, docs, tools), look it up or dispatch fact-finding — do not make the user be your search engine.
- Do not block the whole round on fact-finding: a running exploration is an unsettled prerequisite only for questions that depend on it; ask the rest of the frontier now.
- **Decisions** are the user's. Put each choice to them and wait.

### Done criteria

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. **Do not act on the plan** until the user confirms you have reached a shared understanding.

## Question template

```markdown
**Q1 — <question title>**: <question body; may be multiple paragraphs; include options when useful>

Recommended: <your recommended answer>
```

## Anti-patterns

- Asking one tiny question at a time when more of the frontier is ready
- Implementing or writing tickets mid-grill
- Hiding your recommendation (silent default)
- Asking the user for facts you could look up
- Declaring done while branches remain unvisited
