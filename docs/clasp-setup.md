# Clasp Setup — moego-onboarding

## Overview

This doc covers the project-specific Clasp configuration for moego-onboarding. For general Clasp installation, authentication, and workflow guidance see `gas-clasp-setup.md`.

---

## Creating the Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Rename the project to `moego-onboarding`
4. Go to **Project Settings** (gear icon) and copy the **Script ID** — you will need this in the next step

---

## Project Setup

Clone the Apps Script project locally:

```bash
clasp clone <script-id> --rootDir ./src
```

This creates a `.clasp.json` file at the project root:

```json
{
  "scriptId": "<script-id>",
  "rootDir": "./src"
}
```

---

## `appsscript.json`

Place in `src/`:

```json
{
  "timeZone": "America/New_York",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

The `gmail.send` scope is required for `GmailApp.sendEmail()`. The `script.external_request` scope is required for `UrlFetchApp` calls to the MoeGo and Bitly APIs.

---

## `.claspignore`

Create at the project root:

```
node_modules/
**/*.ts
!appsscript.json
.clasp.json
tsconfig.json
package.json
package-lock.json
.eslintrc*
.prettierrc*
README.md
dist/
docs/
```
