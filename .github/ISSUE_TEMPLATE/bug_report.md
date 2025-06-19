---
name: Bug report
about: Create a report to help us improve
title: ''
labels: bug
assignees: ''
---

**Describe the bug**

A clear and concise description of what the bug is.

**To Reproduce**

Steps to reproduce the behavior:

```typescript
// Minimal code example that reproduces the issue
import { readTags } from "taglib-wasm";

const tags = await readTags("file.mp3");
// What happens vs what you expected
```

**Expected behavior**

A clear and concise description of what you expected to happen.

**Actual behavior**

What actually happened, including any error messages.

**Environment:**

- taglib-wasm version: [e.g., 0.3.6]
- Runtime: [e.g., Node.js 22.6, Deno 2.0, Bun 1.0, Chrome 120]
- OS: [e.g., macOS 14, Ubuntu 22.04, Windows 11]

**Audio file details:**

- Format: [e.g., MP3, FLAC, M4A]
- Size: [e.g., 5MB]
- Special characteristics: [e.g., VBR, high bitrate, Unicode tags]

**Additional context**

Add any other context about the problem here. If possible, attach a sample file
that reproduces the issue (ensure no copyright issues).

**Logs**

```
// Any relevant error messages or console output
```
