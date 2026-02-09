---
command: commit
description: Create a commit using repo conventions
---
To commit staged changes using our repo conventions:

1. Confirm current branch:
   - Run: git branch --show-current
   - If branch is "main": STOP and tell me to create a branch first.
   - Extract INV code from branch name (example: feature/INV-101-dcf-engine → INV-101).
   - If no INV code exists: use INV-000 and warn me to rename the branch.

2. Analyze staged changes:
   - Run: git diff --staged
   - If there are NO staged changes: DO NOT create a commit.

3. Create commit message:

<INV-CODE> | <Short title>

What:
- ...

Why:
- ...

Rules:
- Title under 72 characters.
- Present tense.
- Do not invent changes.
- Be precise and technical.