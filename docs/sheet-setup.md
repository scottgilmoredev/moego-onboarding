# Sheet & Drive Setup — moego-onboarding

## Overview

moego-onboarding writes one row per new client to a Google Sheet and
stores uploaded vaccination records in a Google Drive folder. Both must
be created manually before the app can function. This doc covers
creating and configuring each, finding their IDs, and setting the
required environment variables.

---

## Google Sheet

### Creating the Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **Blank spreadsheet**
3. Rename the spreadsheet to `moego-onboarding`
4. Add the following column headers in row 1, in order:

| Column | Header          |
| ------ | --------------- |
| A      | First Name      |
| B      | Last Name       |
| C      | Phone           |
| D      | Onboarding Link |
| E      | Customer ID     |
| F      | Sent At         |

### Getting the Spreadsheet ID

The spreadsheet ID is in the URL when the sheet is open:

```
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
```

Copy the value between `/d/` and `/edit`. Set it in your environment:

```
SPREADSHEET_ID=<your-spreadsheet-id>
```

---

## Google Drive Folder

### Creating the Folder

1. Go to [drive.google.com](https://drive.google.com)
2. Click **New** → **New folder**
3. Name the folder `moego-onboarding-uploads`

### Getting the Folder ID

Open the folder. The folder ID is in the URL:

```
https://drive.google.com/drive/folders/<DRIVE_FOLDER_ID>
```

Copy the value after `/folders/`. Set it in your environment:

```
DRIVE_FOLDER_ID=<your-folder-id>
```

---

## Business Branding

The client landing page displays your business name, logo, and phone
number. These are sourced from environment variables — not hardcoded.

| Variable            | Description                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `BUSINESS_NAME`     | Your business name as it should appear on the landing page                                          |
| `BUSINESS_PHONE`    | Your business phone number displayed on the error page for clients to call if their link is invalid |
| `BUSINESS_LOGO_URL` | Public URL of your business logo image — displayed as a circular avatar on the landing page         |

**Logo URL note:** The logo must be publicly accessible (no login
required). If your logo is hosted in Google Drive, use the direct
download URL format rather than the sharing page URL. A CDN or image
hosting service is recommended.

---

## Landing Page URL

After deploying the GAS web app, you need the public URL of the
deployment to construct client token links.

1. In the GAS editor, click **Deploy** → **Manage deployments**
2. Copy the **Web app URL** for your active deployment
3. Set it in your environment:

```
LANDING_PAGE_URL=https://script.google.com/macros/s/<deployment-id>/exec
```

This URL is used by `doPost` to construct the per-client token URL:

```
https://script.google.com/macros/s/<deployment-id>/exec?token=<token>
```

If you create a new deployment (e.g. after a code update), the
deployment URL changes and `LANDING_PAGE_URL` must be updated in Script
Properties.

---

## Required OAuth Scopes

The `appsscript.json` in `dist/` must include the following scopes for
SpreadsheetApp and DriveApp to function:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ]
}
```

---

## Environment Variable Reference

Full list of required Script Properties for this project:

| Variable                     | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `MOEGO_API_KEY`              | MoeGo API key                                                   |
| `MOEGO_COMPANY_ID`           | MoeGo company ID                                                |
| `MOEGO_BUSINESS_ID`          | MoeGo business ID                                               |
| `MOEGO_SERVICE_AGREEMENT_ID` | MoeGo Service Agreement ID                                      |
| `MOEGO_SMS_AGREEMENT_ID`     | MoeGo SMS Agreement ID                                          |
| `MOEGO_WEBHOOK_SECRET`       | MoeGo webhook secret for payload validation                     |
| `SHORTIO_API_KEY`            | Short.io API access token                                       |
| `SHORTIO_DOMAIN`             | Short.io domain assigned to your account                        |
| `BUSINESS_OWNER_EMAILS`      | Comma-separated list of owner email addresses for notifications |
| `BUSINESS_NAME`              | Business name displayed on the landing page                     |
| `BUSINESS_PHONE`             | Business phone displayed on the error page                      |
| `BUSINESS_LOGO_URL`          | Public URL of the business logo image                           |
| `DRIVE_FOLDER_ID`            | Google Drive folder ID for vaccination record uploads           |
| `SPREADSHEET_ID`             | Google Sheet spreadsheet ID for client row writes               |
| `LANDING_PAGE_URL`           | Deployed GAS web app URL used to construct client token links   |

See `.env.example` at the project root for the variable names and
placeholder values. Set all of these in the GAS editor under **Project
Settings → Script Properties** before deploying.
