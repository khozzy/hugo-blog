---
name: content-review
description: Run critic panel on draft content.
---

## Critic Roles (Sub-Agents)

### 1. Persona Fit Critic
Role: Skeptical Staff Engineer matching The Stuck Senior profile
Task: Would you actually read this? Share it? Why or why not?
Output: Fit score (1-10) + specific friction points

### 2. Differentiation Critic  
Role: Content strategist who's seen everything
Task: Is this generic? Could anyone write this? What makes it Norbert's?
Output: Differentiation score (1-10) + suggestions to sharpen

### 3. Engagement Bait Detector
Role: Quality guardian
Task: Flag any hollow hooks, missing examples, or hype language
Output: List of violations with line references

### 4. C-Level Translator
Role: Engineering leader who reports to executives
Task: Could a reader use this to justify a decision to leadership?
Output: Business applicability score (1-10) + suggested "pitch this as" angle

## Output Format
| Critic | Score | Key Feedback |
|--------|-------|--------------|
| Persona Fit | X/10 | ... |
| Differentiation | X/10 | ... |
| Bait Detector | Pass/Fail | ... |
| C-Level | X/10 | ... |

**Consensus**: [Publish / Revise / Kill]
**Priority Fixes**: [Numbered list]