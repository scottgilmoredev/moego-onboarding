# Project Milestones — moego-onboarding

This document mirrors the milestones defined in GitHub and serves as a planning reference. Each milestone should be created in GitHub (Issues → Milestones) and linked to the issues/PRs that implement it.

---

## Milestone 0 — Foundations

**Goal:** Establish the project scaffold and development environment.

**Planned issues:**

- Initialize NodeNext TypeScript project
- Configure Vitest
- Configure ESLint with Airbnb config
- Set up Clasp for local Apps Script development
- Configure GitHub Actions CI (lint, test, build)
- Set up git hooks (lint, test)
- Smoke test passing

---

## Milestone 1 — MoeGo Webhook

**Goal:** Implement and validate the MoeGo webhook receiver.

**Planned issues:**

- Implement webhook payload receiver
- Implement payload validation (event type, required customer fields)
- Unit tests: valid payload, missing fields, wrong event type, malformed JSON

---

## Milestone 2 — MoeGo API Client

**Goal:** Implement authenticated MoeGo API client and retrieve all required per-client links.

**Planned issues:**

- Implement MoeGo API authentication
- Implement Service Agreement sign link retrieval
- Implement SMS Agreement sign link retrieval
- Implement card-on-file link retrieval
- Unit tests: success cases, individual failure cases, auth failure, network error

---

## Milestone 3 — Form URL Builder

**Goal:** Implement pre-filled Google Form URL construction from customer data and retrieved links.

**Planned issues:**

- Implement pre-filled Google Form URL builder
- Unit tests: all fields present, partial fields (each failure combination), empty/missing values

---

## Milestone 4 — URL Shortener

**Goal:** Implement Bitly API integration for URL shortening with full URL fallback.

**Planned issues:**

- Implement Bitly API client
- Implement full URL fallback on Bitly failure
- Unit tests: successful shortening, Bitly API failure with fallback

---

## Milestone 5 — Email Delivery

**Goal:** Implement email composition and delivery to the business owner for all cases.

**Planned issues:**

- Implement success email composition and delivery via `GmailApp`
- Implement partial failure email composition and delivery
- Implement full failure email composition and delivery
- Implement Bitly fallback email composition and delivery
- Unit tests: success email, partial failure email, full failure email, Bitly fallback email

---

## Milestone 6 — Integration & Apps Script Entrypoint

**Goal:** Wire all modules together into the Apps Script `doPost` entrypoint and validate the full onboarding flow end-to-end.

**Planned issues:**

- Implement `doPost` entrypoint
- Wire all modules into the full onboarding flow
- Integration tests with mocked globals and stubbed API responses
- End-to-end test with live MoeGo sandbox and real Google Form
- Deploy to Google Apps Script via Clasp

---

## Notes

- This file should always match GitHub milestones.
- Use it for planning/communication; use GitHub milestones for execution tracking.
- See [Enhancements](enhancements.md) for planned and potential post-MVP improvements.
