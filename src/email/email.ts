/**
 * Email Module
 *
 * @module
 * @description Composes and delivers email to the business owner via MailApp.
 * Handles success, partial failure, full failure, and Short.io fallback cases.
 */

import { getConfig } from '#/utils/config.js';

/**
 * Parameters for sending a success email.
 *
 * @interface SendSuccessEmailParams
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {string} shortUrl - The shortened landing page URL.
 */
export interface SendSuccessEmailParams {
  firstName: string;
  lastName: string;
  shortUrl: string;
}

/**
 * Parameters for sending a full failure email.
 *
 * @interface SendFullFailureEmailParams
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {string} customerId - The client's MoeGo customer ID for manual recovery.
 */
export interface SendFullFailureEmailParams {
  firstName: string;
  lastName: string;
  customerId: string;
}

/**
 * Parameters for sending a partial failure email.
 *
 * @interface SendPartialFailureEmailParams
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {string} customerId - The client's MoeGo customer ID for manual recovery.
 * @property {string} partialUrl - The partial pre-filled Google Form URL with available fields populated.
 * @property {string[]} missingFields - Names of fields that could not be populated due to API failures.
 */
export interface SendPartialFailureEmailParams {
  firstName: string;
  lastName: string;
  customerId: string;
  partialUrl: string;
  missingFields: string[];
}

/**
 * Send a success email to the business owner.
 *
 * @function sendSuccessEmail
 * @description Composes and delivers an email to the business owner containing
 * the client's onboarding form URL for review and distribution via SMS. Includes
 * an advisory note if URL shortening failed.
 *
 * @param {SendSuccessEmailParams} params - The email parameters.
 * @returns {void}
 *
 * @example
 * sendSuccessEmail({
 *   firstName: customer.firstName,
 *   lastName: customer.lastName,
 *   shortUrl: 'https://abc.short.gy/xyz123',
 * });
 */
export function sendSuccessEmail({ firstName, lastName, shortUrl }: SendSuccessEmailParams): void {
  const { businessOwnerEmails } = getConfig();

  // Construct subject with first name and last initial
  const subject = `New Client Onboarding — ${firstName} ${lastName.charAt(0)}.`;

  // Compose the email body
  const body = `A new appointment has been created in MoeGo for ${firstName} ${lastName.charAt(0)}. Please send the following onboarding link via SMS.\n\n${shortUrl}`;

  // Deliver the email via MailApp
  MailApp.sendEmail(businessOwnerEmails.join(', '), subject, body);
}

/**
 * Send a full failure email to the business owner.
 *
 * @function sendFullFailureEmail
 * @description Composes and delivers an email to the business owner when all
 * MoeGo API calls fail during onboarding. Contains the customer's MoeGo ID
 * and inline manual recovery steps. No pre-filled URL is included.
 *
 * @param {SendFullFailureEmailParams} params - The email parameters.
 * @returns {void}
 *
 * @example
 * sendFullFailureEmail({
 *   firstName: customer.firstName,
 *   lastName: customer.lastName,
 *   customerId: customer.id,
 * });
 */
export function sendFullFailureEmail({
  firstName,
  lastName,
  customerId,
}: SendFullFailureEmailParams): void {
  const { businessOwnerEmails } = getConfig();

  // Construct subject with first name and last initial
  const subject = `Action Required — Onboarding Links Unavailable for ${firstName} ${lastName.charAt(0)}.`;

  // Compose the email body with customer ID and manual recovery steps
  const body = `The onboarding links could not be automatically retrieved for ${firstName} ${lastName.charAt(0)}. All MoeGo API calls failed and no onboarding link could be generated.

    Customer MoeGo ID: ${customerId}

    Manual recovery steps:
    1. Log in to MoeGo and locate the client using the customer ID above.
    2. Retrieve the following links manually from the client's profile in MoeGo:
      - Service Agreement link
      - SMS Agreement link
      - Card-on-file link
    3. Construct the pre-filled onboarding form URL manually using the form entry IDs
      from your environment configuration and the links retrieved from MoeGo.
    4. Shorten the completed link using Short.io before sending to the client.
    5. Send the completed link to the client via SMS.`;

  // Deliver the email via MailApp
  MailApp.sendEmail(businessOwnerEmails.join(', '), subject, body);
}

/**
 * Parameters for sending a Short.io failure email.
 *
 * @interface SendShortIoFailureEmailParams
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {string} customerId - The client's MoeGo customer ID for manual recovery.
 * @property {string} fullUrl - The full unshortened token URL.
 */
export interface SendShortIoFailureEmailParams {
  firstName: string;
  lastName: string;
  customerId: string;
  fullUrl: string;
}

/**
 * Parameters for sending a sheet write failure email.
 *
 * @interface SendSheetWriteFailureEmailParams
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {string} customerId - The client's MoeGo customer ID for manual recovery.
 * @property {string} shortUrl - The shortened token URL.
 */
export interface SendSheetWriteFailureEmailParams {
  firstName: string;
  lastName: string;
  customerId: string;
  shortUrl: string;
}

/**
 * Send a Short.io failure email to the business owner.
 *
 * @function sendShortIoFailureEmail
 * @description Composes and delivers an email to the business owner when URL
 * shortening fails. Includes the full token URL so the owner can shorten it
 * manually before forwarding to the client.
 *
 * @param {SendShortIoFailureEmailParams} params - The email parameters.
 * @returns {void}
 */
export function sendShortIoFailureEmail({
  firstName,
  lastName,
  customerId,
  fullUrl,
}: SendShortIoFailureEmailParams): void {
  const { businessOwnerEmails } = getConfig();

  const subject = `Action Required — URL Shortening Failed for ${firstName} ${lastName.charAt(0)}.`;

  const body = `URL shortening failed for ${firstName} ${lastName.charAt(0)}. The onboarding link could not be written to the sheet.

    Customer MoeGo ID: ${customerId}

    Full token URL (shorten manually before sending to the client):
    ${fullUrl}

    Manual recovery steps:
    1. Copy the full token URL above.
    2. Shorten it using Short.io or another URL shortener.
    3. Send the shortened link to the client via SMS.`;

  MailApp.sendEmail(businessOwnerEmails.join(', '), subject, body);
}

/**
 * Send a sheet write failure email to the business owner.
 *
 * @function sendSheetWriteFailureEmail
 * @description Composes and delivers an email to the business owner when the
 * Google Sheet write fails. Includes the shortened token URL so the owner can
 * forward it to the client manually.
 *
 * @param {SendSheetWriteFailureEmailParams} params - The email parameters.
 * @returns {void}
 */
export function sendSheetWriteFailureEmail({
  firstName,
  lastName,
  customerId,
  shortUrl,
}: SendSheetWriteFailureEmailParams): void {
  const { businessOwnerEmails } = getConfig();

  const subject = `Action Required — Sheet Write Failed for ${firstName} ${lastName.charAt(0)}.`;

  const body = `The sheet row could not be written for ${firstName} ${lastName.charAt(0)}. The shortened onboarding link is below — please forward it to the client via SMS manually.

    Customer MoeGo ID: ${customerId}

    Shortened token URL:
    ${shortUrl}

    Manual recovery steps:
    1. Copy the shortened token URL above.
    2. Send it to the client via SMS.`;

  MailApp.sendEmail(businessOwnerEmails.join(', '), subject, body);
}

/**
 * Send a partial failure email to the business owner.
 *
 * @function sendPartialFailureEmail
 * @description Composes and delivers an email to the business owner when one
 * or more MoeGo API calls fail. Contains the partial pre-filled URL with
 * available fields, identifies which fields failed, the customer's MoeGo ID,
 * and inline manual recovery steps.
 *
 * @param {SendPartialFailureEmailParams} params - The email parameters.
 * @returns {void}
 *
 * @example
 * sendPartialFailureEmail({
 *   firstName: customer.firstName,
 *   lastName: customer.lastName,
 *   customerId: customer.id,
 *   partialUrl: formUrlResult.url,
 *   missingFields: formUrlResult.missingFields,
 * });
 */
export function sendPartialFailureEmail({
  firstName,
  lastName,
  customerId,
  partialUrl,
  missingFields,
}: SendPartialFailureEmailParams): void {
  const { businessOwnerEmails } = getConfig();

  // Construct subject with first name and last initial
  const subject = `Action Required — Onboarding Links Partially Unavailable for ${firstName} ${lastName.charAt(0)}.`;

  // Build the missing fields list
  const missingFieldsList = missingFields.map(field => `  - ${field}`).join('\n');

  // Compose the email body with partial URL, missing fields, customer ID, and manual recovery steps
  const body = `Some onboarding links could not be automatically retrieved for ${firstName} ${lastName.charAt(0)}. The partial onboarding link below is missing the following fields:

    ${missingFieldsList}

    Partial onboarding link (missing fields not included):
    ${partialUrl}

    Customer MoeGo ID: ${customerId}

    Manual recovery steps:
    1. Log in to MoeGo and locate the client using the customer ID above.
    2. Retrieve the missing link(s) manually from the client's profile in MoeGo.
    3. Append each missing link to the partial URL above using the following format:
      &entry.ENTRY_ID=LINK_VALUE
      Replace ENTRY_ID with the corresponding form entry ID from your environment
      configuration and LINK_VALUE with the URL-encoded link retrieved from MoeGo.
    4. Shorten the completed link using Short.io before sending to the client.
    5. Send the completed link to the client via SMS.`;

  // Deliver the email via MailApp
  MailApp.sendEmail(businessOwnerEmails.join(', '), subject, body);
}
