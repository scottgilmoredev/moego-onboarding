# moego-onboarding

<!-- [![CI](https://github.com/scottgilmoredev/moego-onboarding/actions/workflows/ci.yml/badge.svg)](https://github.com/scottgilmoredev/moego-onboarding/actions/workflows/ci.yml)  -->

## Overview

Automates the client onboarding process for MoeGo-based pet service businesses. When a new client is created in MoeGo, this tool automatically retrieves their unique agreement signing links and card-on-file link, constructs a pre-filled Google Form URL, and emails it to the business owner for review and distribution to the client — reducing manual link generation and delivery to a single step.

## Features

- Listens for `CUSTOMER_CREATED` webhook events from MoeGo
- Retrieves per-client agreement sign links and card-on-file link via MoeGo API
- Constructs a pre-filled Google Form URL with client data and links
- Emails the business owner with the pre-filled form URL for review and client delivery
- Graceful failure handling — partial failures email the business owner with the failed fields, partial URL, and customer MoeGo ID for manual recovery

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
- npm >= 9
- A Google account with Apps Script access and the Apps Script API enabled
- Clasp installed and configured — see [Clasp Setup](docs/clasp-setup.md)
- A MoeGo account with API access and a Customer Success Manager-issued API key
- A configured Google Form for client onboarding

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/moego-onboarding.git
   cd moego-onboarding
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Clasp — see [Clasp Setup](docs/clasp-setup.md)

### Running Tests

```bash
npm run test
```

### Development Build

```bash
npm run build
```

### Local Dev Server

```bash
npm run dev
```

## Project Structure

```
src/
 ┣ webhook/       # MoeGo webhook receiver and validation
 ┣ moego/         # MoeGo API client (agreements, customer COF link)
 ┣ form/          # Google Form pre-filled URL construction
 ┣ email/         # Email delivery to business owner
 ┣ types/         # Shared TypeScript types
 ┣ utils/         # Shared utilities and helpers
 ┣ server.ts      # Apps Script web app entrypoint (doPost)
```

## CI/CD

- GitHub Actions runs linting, tests, and build on every push and pull request

## Roadmap

See [Milestones](docs/milestones.md) for planned enhancements and future development.

## Documentation

- [Development Plan](docs/development-plan.md)
- [Milestones](docs/milestones.md)
- [Clasp Setup](docs/clasp-setup.md)
