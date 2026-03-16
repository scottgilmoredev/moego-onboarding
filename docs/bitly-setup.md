# Bitly Setup — moego-onboarding

## Overview

Bitly is used in moego-onboarding to shorten the pre-filled Google Form URL before it is delivered to the business owner for distribution to the client via SMS. This keeps the URL within a manageable length for SMS delivery.

Full API documentation: [dev.bitly.com](https://dev.bitly.com)

---

## Creating a Bitly Account

1. Go to [bitly.com](https://bitly.com)
2. Click **Get started for free**
3. Sign up with an email address or Google/Apple account
4. Verify your email address if prompted

---

## Generating an API Access Token

1. Log in to your Bitly account
2. Click your profile avatar in the top right and select **Settings**
3. Navigate to **API** in the left sidebar
4. Enter your account password and click **Generate token**
5. Copy the token — you will need this in the next step

---

## Configuration

Add your Bitly API access token to the project environment:

```
BITLY_API_KEY=<your-access-token>
```

See the Configuration section in the [Development Plan](development-plan.md) for the full list of required environment variables.

---

## Free Tier Limits

The Bitly free tier includes 1,000 short links per month. For a single-location pet service business, this should be sufficient for new client onboarding volume. If usage approaches the limit, consider upgrading to a paid Bitly plan at [bitly.com/pricing](https://bitly.com/pricing), or evaluate an alternative shortener — see [Enhancements](enhancements.md) for options.
