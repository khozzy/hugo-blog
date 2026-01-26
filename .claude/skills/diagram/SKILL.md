---
name: diagram
description: |
  Generate Mermaid.js diagrams for Hugo blog posts using the {{< mermaid >}} shortcode.
  Use when: (1) user asks for a diagram, flowchart, or visualization, (2) explaining a process,
  workflow, or state machine, (3) showing data flow, system architecture, or entity relationships,
  (4) illustrating sequences, timelines, or decision trees in blog content.
---

# Mermaid Diagram Generator

Generate diagrams for Hugo posts using the LoveIt theme's mermaid shortcode.

## Output Format

```hugo
{{< mermaid >}}
<mermaid code>
{{< /mermaid >}}
```

## Diagram Type Selection

| Concept | Diagram Type | Keyword |
|---------|--------------|---------|
| Pipeline/workflow states | `stateDiagram-v2` | States with transitions |
| System architecture | `graph LR` or `graph TB` | Boxes and arrows |
| API/event sequences | `sequenceDiagram` | Actor interactions over time |
| Data models | `erDiagram` | Tables with relationships |
| Project timelines | `gantt` | Tasks with dates |
| Decision trees | `flowchart` | Conditions and branches |

## Examples

**State diagram** (user journey, pipeline stages):
```
stateDiagram-v2
    [*] --> Raw
    Raw --> Staged: validate
    Staged --> Curated: transform
    Curated --> [*]
```

**Flowchart** (architecture, data flow):
```
graph LR
    A[Source] --> B{Validate}
    B -->|Pass| C[Transform]
    B -->|Fail| D[DLQ]
    C --> E[(Warehouse)]
```

**Sequence** (API calls, message flow):
```
sequenceDiagram
    Producer->>Kafka: publish
    Kafka->>Consumer: poll
    Consumer->>DB: write
```

**ER diagram** (schema relationships):
```
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ITEM : contains
```

## Guidelines

1. Choose diagram type based on what's being illustrated, not user's exact words
2. Keep diagrams simple: 5-10 nodes max
3. Use short, clear labels
4. Direction: `LR` for processes, `TB` for hierarchies
5. No titles in diagram - post context provides it
