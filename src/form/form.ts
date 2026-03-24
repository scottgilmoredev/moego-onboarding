/**
 * Form URL Builder
 *
 * @module
 * @description Constructs pre-filled Google Form URLs from customer data and
 * retrieved MoeGo links. Handles partial field population when one or more
 * links are unavailable, returning both the partial URL and a list of missing
 * fields for failure email handling.
 */

import { getConfig } from '#/utils/config.js';

/**
 * Input fields for constructing a pre-filled Google Form URL.
 *
 * @interface FormFields
 * @property {string | null} serviceAgreementUrl - The Service Agreement sign link, or null if retrieval failed.
 * @property {string | null} smsAgreementUrl - The SMS Agreement sign link, or null if retrieval failed.
 * @property {string | null} cofUrl - The card-on-file link, or null if retrieval failed.
 */
export interface FormFields {
  serviceAgreementUrl: string | null;
  smsAgreementUrl: string | null;
  cofUrl: string | null;
}

/**
 * Result of constructing a pre-filled Google Form URL.
 *
 * @interface FormUrlResult
 * @property {string} url - The pre-filled Google Form URL, with available fields populated.
 * @property {string[]} missingFields - Names of fields that could not be populated due to retrieval failures.
 */
export interface FormUrlResult {
  url: string;
  missingFields: string[];
}

/**
 * Append a pre-filled entry parameter to a URL.
 *
 * @function appendEntry
 * @description Appends a Google Form entry parameter to the URL if the value
 * is present. Returns the URL unchanged if the value is null.
 *
 * @param {string} url - The current URL string.
 * @param {string} entryId - The Google Form entry ID (e.g. 'entry.111').
 * @param {string | null} value - The value to append, or null to skip.
 * @param {string[]} missingFields - Array to push the field name to if value is null.
 * @param {string} fieldName - The field name to record if value is null.
 * @returns {string} The updated URL string.
 * @private
 */
function appendEntry(
  url: string,
  entryId: string,
  value: string | null,
  missingFields: string[],
  fieldName: string
): string {
  // Skip and record missing field if value is null
  if (value === null) {
    missingFields.push(fieldName);
    return url;
  }

  // Append the URL-encoded entry parameter
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}${entryId}=${encodeURIComponent(value)}`;
}

/**
 * Build a pre-filled Google Form URL from customer data and retrieved links.
 *
 * @function buildFormUrl
 * @description Constructs a pre-filled Google Form URL by mapping customer
 * data and MoeGo links to their corresponding form entry IDs. Fields with
 * null values are omitted from the URL and recorded in the missingFields array.
 *
 * @param {FormFields} fields - The customer data and retrieved links.
 * @returns {FormUrlResult} The pre-filled URL and list of missing fields.
 *
 * @example
 * const { url, missingFields } = buildFormUrl({
 *   serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
 *   smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
 *   cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
 * });
 */
export function buildFormUrl(fields: FormFields): FormUrlResult {
  const config = getConfig();
  const missingFields: string[] = [];

  // Start with the base form URL and append each pre-fillable field
  let url = config.googleFormUrl;

  // Append link fields — these may be null if MoeGo API calls failed
  url = appendEntry(
    url,
    config.formEntryServiceAgreement,
    fields.serviceAgreementUrl,
    missingFields,
    'serviceAgreementUrl'
  );
  url = appendEntry(
    url,
    config.formEntrySmsAgreement,
    fields.smsAgreementUrl,
    missingFields,
    'smsAgreementUrl'
  );
  url = appendEntry(url, config.formEntryCof, fields.cofUrl, missingFields, 'cofUrl');

  return { url, missingFields };
}
