# Short.io Setup — moego-onboarding

## Overview

Short.io is used in moego-onboarding to shorten the pre-filled Google Form URL before it is delivered to the business owner for distribution to the client via SMS. This keeps the URL within a manageable length for SMS delivery.

Full API documentation: developers.short.io

---

## Creating a Short.io Account

1. Go to short.io
2. Click Sign Up
3. Specify your email address and click Create Account button.
4. Connect a type of domain: Free domain, Buy a domain via Short.io. Existing spare domain or Subdomain.
5. Continue the registration depending on the selected type.

---

## Generating an API Key

1. Log in to your Short.io account
2. Click your profile avatar and select **Integrations & API**
3. Under **API Keys** click **Create API key**
4. Configure the key:
   - **Key type** — select **Private** — required for server-side link creation
   - **Key description** — optionally add a description (e.g. `moego-onboarding`)
   - **Expiration date** — leave empty for no expiration
   - **Access restrictions** — select **All domains (no restriction)**
5. Click **Create**
6. Copy the key immediately — this is the only time it will be visible

> **Note:** Private keys cannot be recovered after creation. If lost, create a new key.

---

## Setting the API Key in GAS

Once deployed, add the API key to the GAS script properties:

1. Open the Apps Script project at [script.google.com](https://script.google.com)
2. Go to **Project Settings** → **Script properties**
3. Click **Add script property**
4. Set the property name to `SHORTIO_API_KEY` and paste the value
5. Click **Save**

---

## Configuration

Add your Short.io API access token to the project environment:

```
SHORTIO_API_KEY=<your-access-token>
```

See the Configuration section in the [Development Plan](development-plan.md) for the full list of required environment variables.

---

## Free Tier Limits

The Short.io free tier includes 1,000 total links annually. For a single-location pet service business onboarding new clients, this should be sufficient for the foreseeable future — each onboarded client consumes one link. If usage approaches the limit, old links may be deleted in order to stay within this limit. You may also consider upgrading to a paid Short.io plan at short.io/pricing, or evaluate an alternative shortener — see Enhancements for options.
