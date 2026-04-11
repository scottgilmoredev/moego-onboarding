# Postmortem — GAS Globals Not Exposed via esbuild IIFE Banner

**Date:** 2026-04-02
**Severity:** P2 — High
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

After adding `doGet` and `uploadVaccinationRecord` to the codebase, both functions were unreachable from the GAS runtime. `doGet` failed silently and `uploadVaccinationRecord` threw "uploadVaccinationRecord is not a function" when called via `google.script.run` from the landing page client. The root cause was that neither function was declared as a top-level GAS global — they were only assigned to `globalThis`, which is insufficient for `google.script.run` which requires genuine top-level function declarations.

---

## Timeline

| Time       | Event                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-04-02 | `doGet` and `uploadVaccinationRecord` implemented and deployed                                                    |
| 2026-04-02 | Landing page loaded — `uploadVaccinationRecord is not a function` thrown on upload attempt                        |
| 2026-04-02 | Both functions confirmed assigned to `globalThis` in `server.ts` — assumed sufficient                             |
| 2026-04-02 | Root cause identified: `google.script.run` requires top-level function declarations, not `globalThis` assignments |
| 2026-04-02 | esbuild `banner` option used to inject top-level function declarations that delegate to `exports.*`               |
| 2026-04-02 | Redeployed — both functions accessible                                                                            |

---

## Root Cause

The esbuild `iife` format wraps all compiled code in a self-executing function. `globalThis` assignments inside the bundle expose values on the global object, but `google.script.run` specifically requires functions to be declared at the top level of the script file — not just present on `globalThis`. The esbuild `banner` option injects raw JavaScript before the IIFE wrapper, making it the correct place for top-level GAS function declarations.

---

## Contributing Factors

- The `globalThis` pattern worked for `doPost` (called by the GAS runtime directly as a web app entrypoint) but the same pattern does not work for `google.script.run` (which requires genuine top-level declarations)
- The distinction between GAS web app entrypoints and `google.script.run` callable functions was not known upfront
- The failure mode (`is not a function`) gave no indication that the function existed on `globalThis` but was not a top-level declaration

---

## Impact

`uploadVaccinationRecord` was non-functional from the landing page on all calls via `google.script.run`. The failure was caught during E2E testing and did not affect real client traffic.

---

## Action Items

| Action                                                                                     | Owner           | Due               |
| ------------------------------------------------------------------------------------------ | --------------- | ----------------- |
| Add all `google.script.run`-callable functions to esbuild banner as top-level declarations | scottgilmoredev | Done — 2026-04-02 |
| Document banner pattern in `docs/clasp-setup.md`                                           | scottgilmoredev | Next doc pass     |

---

## Lessons Learned

In a GAS project compiled via esbuild `iife`, any function callable via `google.script.run` must be declared at the top level of the script — not just assigned to `globalThis`. The esbuild `banner` option is the correct mechanism for injecting these declarations. Any new function intended for `google.script.run` must be added to the banner explicitly. `globalThis` assignment alone is sufficient only for GAS web app entrypoints (`doPost`, `doGet`) called directly by the runtime.
