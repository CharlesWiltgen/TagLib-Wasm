---
description: Run the taglib-wasm release preflight checklist
---

Run the taglib-wasm release preflight: read the `taglib-wasm-preflight` skill
(skill://taglib-wasm-preflight) and execute its checklist end to end — semver
classification from the diff (verify any supplied version, don't trust it),
public API diff vs the last tag, knip triage, coverage threshold (80%), wasm
size delta, beads state, and release notes. Complete every section; report the
version recommendation plus a readiness verdict, or the blocking findings with
evidence.

$ARGUMENTS
