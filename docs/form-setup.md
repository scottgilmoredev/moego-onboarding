# Form Setup — moego-onboarding

> **Deprecated.** The Google Form dependency was removed in Milestone 10.
> moego-onboarding no longer constructs pre-filled form URLs. The
> onboarding flow now uses a token-based client landing page served
> directly by the GAS web app. This document is retained for historical
> reference only and does not reflect the current implementation.
>
> See [Sheet & Drive Setup](sheet-setup.md) for current setup
> instructions.

---

## Overview

moego-onboarding constructs a pre-filled Google Form URL for each new client and delivers it to the business owner for distribution. The form itself must be created and configured manually before the app can function. This doc covers creating the form, identifying the field entry IDs required for pre-filling, and configuring the project to use it.

Form URL: `<placeholder>`

---

## Creating the Form

1. Go to [forms.google.com](https://forms.google.com)
2. Click **Blank form**
3. Name the form `moego-onboarding`
4. Add the following fields in order:

| Field                     | Type         | Required |
| ------------------------- | ------------ | -------- |
| First Name                | Short answer | Yes      |
| Last Name                 | Short answer | Yes      |
| Phone Number              | Short answer | Yes      |
| Service Agreement         | Short answer | Yes      |
| SMS Agreement             | Short answer | Yes      |
| Card on File              | Short answer | Yes      |
| Rabies Vaccination Record | File upload  | Yes      |

5. Once the form is complete, click **Send** and copy the form URL — you will need this in the Configuration step

---

## Identifying Field Entry IDs

Google Form pre-filled URLs use entry IDs to map values to fields. To find the entry IDs for each field:

1. Open the form in a browser
2. Right-click anywhere on the page and select **Inspect** to open browser developer tools
3. Use **Ctrl+F** (or **Cmd+F** on Mac) to search for `entry.` in the page source
4. Each pre-fillable field will have a corresponding `entry.XXXXXXXXXX` identifier
5. Record the entry ID for each field — you will need these in the Configuration step

Alternatively:

1. Open the form
2. Click the three-dot menu in the top right and select **Get pre-filled link**
3. Enter a test value in each field
4. Click **Get link** — the generated URL will contain the entry IDs for each field in the format `entry.XXXXXXXXXX=<test-value>`

---

## Configuration

Add the form URL and field entry IDs to the project environment:

```
GOOGLE_FORM_URL=<your-form-url>
FORM_ENTRY_FIRST_NAME=entry.XXXXXXXXXX
FORM_ENTRY_LAST_NAME=entry.XXXXXXXXXX
FORM_ENTRY_PHONE=entry.XXXXXXXXXX
FORM_ENTRY_SERVICE_AGREEMENT=entry.XXXXXXXXXX
FORM_ENTRY_SMS_AGREEMENT=entry.XXXXXXXXXX
FORM_ENTRY_COF=entry.XXXXXXXXXX
```

See the Configuration section in the [Development Plan](development-plan.md) for the full list of required environment variables.

---

## Privacy Settings

After creating the form, disable response summaries to prevent clients from seeing other clients' responses:

1. Open the form in Google Forms
2. Click the gear icon (Settings)
3. Under **Presentation**, ensure **View results summary** is toggled off

---

## Manually Constructing a Pre-filled URL

In the event of a partial API failure, the business owner may need to manually construct a complete pre-filled URL. A pre-filled Google Form URL follows this format:

```
<GOOGLE_FORM_URL>?entry.XXXXXXXXXX=<value>&entry.XXXXXXXXXX=<value>...
```

**Steps:**

1. Start with the base form URL
2. Append `?` followed by each field's entry ID and value in the format `entry.XXXXXXXXXX=<value>`
3. Separate each field with `&`
4. URL-encode any special characters in the values — spaces become `%20`, `+` becomes `%2B`, etc.

**Example:**

```
https://docs.google.com/forms/d/e/<form-id>/viewform?entry.111111111=John&entry.222222222=Doe&entry.333333333=%2B12125551234&entry.444444444=https%3A%2F%2Fclient.moego.pet%2Fagreement%2Fsign%2F<hash>&entry.555555555=https%3A%2F%2Fclient.moego.pet%2Fagreement%2Fsign%2F<hash>&entry.666666666=https%3A%2F%2Fclient.moego.pet%2Fpayment%2Fcof%2Fclient%3Fc%3D<hash>
```

> **Note:** Only the Service Agreement link, SMS Agreement link, and card-on-file link are pre-filled. Client name and phone number are intentionally excluded to minimize personally identifiable information embedded in the URL.

For further reference see [Google's documentation on pre-filled form URLs](https://support.google.com/docs/answer/2839588).
