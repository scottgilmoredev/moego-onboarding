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

  // Compose the email body with customer ID and retrigger instructions
  const body = `The onboarding links could not be automatically retrieved for ${firstName} ${lastName.charAt(0)}. No onboarding link was generated and no sheet row was written.

Customer ID: ${customerId}

To send this client an onboarding link, use the re-trigger tool from the GAS editor once the issue is resolved. You will need the Customer ID above. See the retrigger guide for instructions.`;

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

  const body = `URL shortening failed for ${firstName} ${lastName.charAt(0)}. The onboarding link was generated but could not be shortened.

Customer ID: ${customerId}

Full onboarding link:
${fullUrl}

Options:
- Send the full link above directly to the client via SMS
- Shorten it manually in Short.io to get the branded link, then send to the client
- Use the re-trigger tool from the GAS editor once Short.io is restored to generate a new shortened link`;

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

  const body = `The sheet row could not be written for ${firstName} ${lastName.charAt(0)}. The onboarding link was generated and shortened successfully — please send it to the client via SMS manually.

Customer ID: ${customerId}

Shortened onboarding link:
${shortUrl}`;

  MailApp.sendEmail(businessOwnerEmails.join(', '), subject, body);
}

/**
 * Parameters for sending an upload notification email.
 *
 * @interface SendUploadNotificationEmailParams
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {string[]} fileUrls - The Google Drive URLs of all uploaded files in the batch.
 */
export interface SendUploadNotificationEmailParams {
  firstName: string;
  lastName: string;
  fileUrls: string[];
}

/**
 * Send an upload notification email to the business owner.
 *
 * @function sendUploadNotificationEmail
 * @description Composes and delivers a single email to the business owner after
 * a client completes a batch upload. Lists all Drive file URLs in one message
 * so multiple uploads do not produce multiple inbox notifications.
 *
 * @param {SendUploadNotificationEmailParams} params - The email parameters.
 * @returns {void}
 */
export function sendUploadNotificationEmail({
  firstName,
  lastName,
  fileUrls,
}: SendUploadNotificationEmailParams): void {
  const { businessOwnerEmails } = getConfig();

  const subject = `Vaccination Record Uploaded — ${firstName} ${lastName.charAt(0)}.`;

  const fileList = fileUrls.join('\n');
  const body = `${firstName} ${lastName.charAt(0)}. has uploaded their vaccination record.\n\nView the files in Google Drive:\n${fileList}`;

  MailApp.sendEmail(businessOwnerEmails.join(', '), subject, body);
}
