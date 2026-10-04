---
name: GitHub authentication
description: Distinguishing Git CLI authentication from the connected GitHub account.
---

Treat Git CLI authentication failures separately from GitHub connection health.

**Why:** This environment rejected Git's saved login while the connected GitHub account could still write to the repository. Reconnecting a working integration would not address that independent login state.

**How to apply:** Only request integration reauthorization after a failure from the integration itself; use its authenticated API for repository operations when the Git transport cannot authenticate, without extracting credentials.