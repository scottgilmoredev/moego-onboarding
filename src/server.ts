/* eslint-disable no-console */

/**
 * Server
 *
 * @module
 * @description Apps Script doPost entrypoint. Receives incoming MoeGo webhook
 * requests and orchestrates the full client onboarding flow by delegating to
 * the webhook, MoeGo API client, form URL builder, URL shortener, and email
 * delivery modules.
 *
 * @see {@link https://developers.google.com/apps-script/guides/web} Google Apps Script Web Apps
 */

import type { MoeGoAppointmentCreatedEvent, MoeGoCustomer } from './types/moego.js';

import { parseWebhookPayload } from '#/webhook/webhook.js';
import { getAgreementSignLink, getCofLink, getCustomer } from '#/moego/moego.js';
import { buildFormUrl } from '#/form/form.js';
import { shortenUrl } from '#/shortener/shortener.js';
import { sendSuccessEmail, sendPartialFailureEmail, sendFullFailureEmail } from '#/email/email.js';
import { getConfig } from '#/utils/config.js';
import { SUPPORTED_EVENT_TYPES } from '#/utils/constants.js';

/**
 * Handle incoming HTTP POST requests from MoeGo webhooks.
 *
 * @function doPost
 * @description Entry point for the Apps Script web app. Receives the raw
 * webhook payload from MoeGo, parses and validates it, retrieves per-client
 * onboarding links from the MoeGo API, constructs a pre-filled Google Form
 * URL, shortens it via Short.io, and delivers the result to the business
 * owner via email.
 *
 * @param {GoogleAppsScript.Events.DoPost} e - The Apps Script POST event object.
 * @returns {GoogleAppsScript.Content.TextOutput} HTTP response.
 */
export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  // Parse and validate the incoming webhook payload
  const event = parseWebhookPayload(e.postData.contents) as MoeGoAppointmentCreatedEvent;
  const {
    moegoApiKey,
    moegoBusinessId,
    moegoCompanyId,
    moegoServiceAgreementId,
    moegoSmsAgreementId,
  } = getConfig();

  // Ignore events for other companies (in case company scoping fails or the webhook secret is compromised)
  if (event.companyId !== moegoCompanyId) {
    return ContentService.createTextOutput('OK');
  }

  // Ignore unsupported event types
  const isSupportedEvent = SUPPORTED_EVENT_TYPES.includes(
    event.type as (typeof SUPPORTED_EVENT_TYPES)[number]
  );

  if (!isSupportedEvent) {
    return ContentService.createTextOutput('OK');
  }

  const { appointment } = event;

  // Retrieve customer details — required for email delivery and identification
  let customer: MoeGoCustomer | null = null;

  try {
    customer = getCustomer({
      customerId: appointment.customerId,
      apiKey: moegoApiKey,
    });
  } catch (err) {
    console.log(`doPost: getCustomer failed — ${String(err)}`);
  }

  // Customer lookup failed — send full failure email with manual recovery steps
  if (!customer) {
    sendFullFailureEmail({
      firstName: 'Unknown',
      lastName: 'Unknown',
      customerId: appointment.customerId,
    });
    return ContentService.createTextOutput('OK');
  }

  // Retrieve onboarding links from MoeGo API — each call is wrapped individually
  // to support partial success: if one fails, the others proceed
  let serviceAgreementUrl: string | null = null;
  let smsAgreementUrl: string | null = null;
  let cofUrl: string | null = null;

  try {
    serviceAgreementUrl = getAgreementSignLink({
      agreementId: moegoServiceAgreementId,
      customerId: appointment.customerId,
      businessId: moegoBusinessId,
      apiKey: moegoApiKey,
    });
  } catch (err) {
    console.log(`doPost: serviceAgreementUrl failed — ${String(err)}`);
  }

  try {
    smsAgreementUrl = getAgreementSignLink({
      agreementId: moegoSmsAgreementId,
      customerId: appointment.customerId,
      businessId: moegoBusinessId,
      apiKey: moegoApiKey,
    });
  } catch (err) {
    console.log(`doPost: smsAgreementUrl failed — ${String(err)}`);
  }

  try {
    cofUrl = getCofLink({
      customerId: appointment.customerId,
      apiKey: moegoApiKey,
    });
  } catch (err) {
    console.log(`doPost: cofUrl failed — ${String(err)}`);
  }

  // Construct the pre-filled Google Form URL from whatever links were retrieved
  const { url: formUrl, missingFields } = buildFormUrl({
    serviceAgreementUrl,
    smsAgreementUrl,
    cofUrl,
  });

  // All three API calls failed — send full failure email with manual recovery steps
  if (missingFields.length === 3) {
    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
    });
    return ContentService.createTextOutput('OK');
  }

  // Shorten the form URL via Short.io — falls back to full URL on failure
  const { url: shortUrl, shortened } = shortenUrl(formUrl);

  // One or more API calls failed — send partial failure email with the partial URL
  if (missingFields.length > 0) {
    sendPartialFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
      partialUrl: shortUrl,
      missingFields,
    });
    return ContentService.createTextOutput('OK');
  }

  // All API calls succeeded — send success email with the full onboarding link
  sendSuccessEmail({
    firstName: customer.firstName,
    lastName: customer.lastName,
    url: shortUrl,
    shortened,
  });

  return ContentService.createTextOutput('OK');
}

// Expose doPost as a global for the GAS runtime
(globalThis as unknown as Record<string, unknown>).doPost = doPost;
