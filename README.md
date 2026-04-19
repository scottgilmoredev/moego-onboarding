# moego-onboarding

[![CI](https://github.com/scottgilmoredev/moego-onboarding/actions/workflows/ci.yml/badge.svg)](https://github.com/scottgilmoredev/moego-onboarding/actions/workflows/ci.yml)

## Overview

Automates the client onboarding process for MoeGo-based pet service businesses. When a new appointment is created in MoeGo, this tool retrieves the client's unique agreement signing links and card-on-file link, generates a personalized token-based landing page URL, and emails it to the business owner — reducing manual link generation and delivery to a single step.

## Features

- Listens for `APPOINTMENT_CREATED` webhook events from MoeGo
- Detects first-time clients via the MoeGo Appointments API — skips returning clients automatically
- Retrieves per-client agreement sign links and card-on-file link via MoeGo API
- Generates a unique, expiring token URL pointing to a personalized client landing page
- Shortens the token URL via Short.io and emails it to the business owner for delivery
- Landing page renders the client's onboarding steps — agreements, card on file, and vaccination record upload
- Vaccination records uploaded directly to Google Drive, prefixed with the client's name
- Graceful failure handling — partial failures email the business owner with recovery details and the customer's MoeGo ID

## Tech Stack

- **Runtime:** Node.js >= 20
- **Language:** TypeScript
- **Testing:** Vitest
- **Apps Script:** Google Apps Script via Clasp
- **Linting:** ESLint (Airbnb config)
- **CI/CD:** GitHub Actions

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- A Google account with Apps Script access and the Apps Script API enabled
- Clasp installed and configured — see [Clasp Setup](docs/clasp-setup.md)
- A MoeGo account with API access and a Customer Success Manager-issued API key
- A Google Sheet and Google Drive folder — see [Sheet & Drive Setup](docs/sheet-setup.md)
- A Short.io account with an API key and custom domain — see [Short.io Setup](docs/short-io-setup.md)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/scottgilmoredev/moego-onboarding.git
   cd moego-onboarding
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up Clasp — see [Clasp Setup](docs/clasp-setup.md)

### Running Tests

```bash
pnpm run test
```

### Development Build

```bash
pnpm run build
```

## Project Structure

```
src/
 ┣ webhook/       # MoeGo webhook receiver and validation
 ┣ moego/         # MoeGo API client (agreements, appointments, customer data)
 ┣ token/         # Per-client token generation, storage, and expiry
 ┣ sheet/         # Google Sheets client for client row writes
 ┣ shortener/     # Short.io URL shortening
 ┣ email/         # Email delivery to business owner
 ┣ types/         # Shared TypeScript types
 ┣ utils/         # Shared utilities and helpers
 ┣ templates/     # HTML templates for landing page and error page
 ┣ server.ts      # Apps Script web app entrypoint (doPost, doGet, uploadVaccinationRecord)
```

## CI/CD

- GitHub Actions runs linting, tests, and build on every push and pull request

## Roadmap

See [Milestones](docs/milestones.md) for planned enhancements and future development.

## Documentation

- [Development Plan](docs/development-plan.md)
- [Milestones](docs/milestones.md)
- [Clasp Setup](docs/clasp-setup.md)
- [Sheet & Drive Setup](docs/sheet-setup.md)
- [Short.io Setup](docs/short-io-setup.md)
- [E2E Testing Guide](docs/e2e-testing.md)
