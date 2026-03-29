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

**Goal:** Implement Short.io API integration for URL shortening with full URL fallback.

**Planned issues:**

- Implement Short.io API client
- Implement full URL fallback on Short.io failure
- Unit tests: successful shortening, Short.io API failure with fallback

---

## Milestone 5 — Email Delivery

**Goal:** Implement email composition and delivery to the business owner for all cases.

**Planned issues:**

- Implement success email composition and delivery via `MailApp`
- Implement partial failure email composition and delivery
- Implement full failure email composition and delivery
- Implement Short.io fallback email composition and delivery
- Unit tests: success email, partial failure email, full failure email, Short.io fallback email

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

## Milestone 7 — Token Generation & Storage

**Goal:** Implement per-client token generation and storage to support the client landing page URL.

**Planned issues:**

- Implement token generation (random, URL-safe)
- Implement token storage and retrieval via PropertiesService
- Implement token expiry (7-day TTL) and invalidation
- Unit tests: token generation, storage/retrieval, expiry, invalidation

---

## Milestone 8 — Client Landing Page

**Goal:** Implement the per-client GAS landing page served via `doGet`, including link rendering and file upload.

**Planned issues:**

- Implement `doGet` entrypoint with token validation
- Implement HTML landing page template
- Implement dynamic link rendering from token data (service agreement, SMS agreement, COF)
- Implement file upload handler (vaccination record → Google Drive)
- Unit tests: valid token, expired token, invalid token, link rendering, file upload

---

## Milestone 9 — Sheet Integration

**Goal:** Implement Google Sheet row write as the primary delivery mechanism for the client landing page URL.

**Planned issues:**

- Implement Google Sheets client (append row)
- Implement sheet row write with token URL and client metadata
- Implement Short.io integration for token URL shortening
- Implement sheet failure handling (email fallback with token URL and manual recovery steps)
- Unit tests: successful write, Short.io failure, sheet write failure, failure email content

---

## Milestone 10 — Transition & Cleanup

**Goal:** Retire the Google Form dependency, update configuration, and finalize documentation for the landing page phase.

**Planned issues:**

- Remove Google Form URL builder and related config/env vars
- Update `doPost` flow to generate token and write sheet row (replacing form URL build + email)
- Update environment variable documentation and `.env.example`
- Update end-user setup docs (sheet creation, column configuration, branding)
- End-to-end test with live MoeGo sandbox and real landing page

---

## Notes

- This file should always match GitHub milestones.
- Use it for planning/communication; use GitHub milestones for execution tracking.
- See [Enhancements](enhancements.md) for planned and potential post-MVP improvements.
