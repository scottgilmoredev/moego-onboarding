# Postmortem — esbuild CJS Output Format: Runtime Failure on First Deployment

**Date:** 2026-03-26
**Severity:** P2 — High
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

The initial esbuild compilation target was CommonJS (`cjs`). GAS V8 does not support the CommonJS `module` global — the compiled bundle failed immediately on first deployment. Switched to `iife` format, which compiles to a self-executing function with no module system dependency.

---

## Timeline

| Time        | Event                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Milestone 0 | esbuild configured with CJS output format — local build succeeding                                                                                                 |
| Milestone 6 | First deployment to GAS — webhook delivery attempted                                                                                                               |
| 2026-03-26  | Response body decoded to runtime error referencing `module` global not defined                                                                                     |
| 2026-03-26  | GAS V8 runtime confirmed to not support CommonJS module system                                                                                                     |
| 2026-03-26  | esbuild output format changed to `iife`                                                                                                                            |
| 2026-03-26  | `doPost` exposed on `globalThis` explicitly to ensure GAS runtime can locate the entrypoint — `(globalThis as unknown as Record<string, unknown>).doPost = doPost` |
| 2026-03-26  | Redeployed — runtime error resolved                                                                                                                                |

---

## Root Cause

GAS V8 does not support the CommonJS `module` global. The esbuild CJS output format produces a bundle that references `module`, which throws immediately in the GAS runtime. This is a documented GAS constraint that was not verified before the output format was selected.

---

## Contributing Factors

- esbuild output format was selected based on familiarity with Node.js targets without verifying GAS V8 runtime requirements
- The constraint is not surfaced during local development or CI — it only manifests at runtime in GAS
- No prior GAS projects existed as reference for the correct compilation approach

---

## Impact

The full flow was non-functional from first deployment until the format was corrected. All webhook deliveries during this window failed at the module level before any application code executed.

---

## Action Items

| Action                                                                                                           | Owner           | Due           |
| ---------------------------------------------------------------------------------------------------------------- | --------------- | ------------- |
| Document esbuild `iife` format requirement and `globalThis` entrypoint exposure pattern in `docs/clasp-setup.md` | scottgilmoredev | Next doc pass |

---

## Lessons Learned

GAS V8 does not support CommonJS. Any esbuild-based compilation targeting GAS must use `iife` format. The compiled entrypoint function must be explicitly exposed on `globalThis` for the GAS runtime to locate it. Both requirements should be established in Milestone 0 on any future GAS project.
