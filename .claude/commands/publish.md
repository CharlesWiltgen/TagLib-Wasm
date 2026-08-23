---
description: Ship a taglib-wasm release to JSR/npm/GitHub Packages
---

Ship a taglib-wasm release: read the `publish` skill
(skill://publish) and drive it end to end. First verify you are on `main`
with a clean tree in sync with origin — do not pipe `yes` past the branch
prompt unexamined. If an argument supplies the version, use it; otherwise use
the most recent preflight recommendation (run `/taglib-wasm-preflight` first
if no classification exists yet). Then run the REQUIRED post-publish
verification — `npm view taglib-wasm@<version> version` plus the
both-backend instantiate check — and report completion only after npm
confirms the version landed. Recover failures per the skill's failure table;
a red `verify-jsr` is a corrupt shipped binary, never flake.

$ARGUMENTS
