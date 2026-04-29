/**
 * MoeGo API Client
 *
 * @module
 * @description Handles authentication and communication with the MoeGo REST API.
 * Retrieves customer details and per-client agreement sign links and card-on-file link.
 * Agreement sign link retrieval handles both Service Agreement and SMS Agreement via
 * {@link getAgreementSignLink}.
 */

import type { MoeGoCustomer } from '#/types/moego.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base URL for the MoeGo API.
 *
 * @constant {string}
 */
const MOEGO_BASE_URL = 'https://openapi.moego.pet';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Parameters for making a request to the MoeGo API.
 *
 * @interface FetchFromMoeGoParams
 * @property {string} path - The API endpoint path (e.g. '/v1/agreements/{id}/sign_link').
 * @property {Record<string, string>} [params] - Optional query parameters.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface FetchFromMoeGoParams {
  path: string;
  params?: Record<string, string>;
  apiKey: string;
}

/**
 * Parameters for retrieving an agreement sign link.
 *
 * @interface GetAgreementSignLinkParams
 * @property {string} agreementId - The MoeGo agreement ID. Use
 * `config.moegoServiceAgreementId` for the Service Agreement or
 * `config.moegoSmsAgreementId` for the SMS Agreement.
 * @property {string} customerId - The MoeGo customer ID.
 * @property {string} businessId - The MoeGo business ID.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface GetAgreementSignLinkParams {
  agreementId: string;
  customerId: string;
  businessId: string;
  apiKey: string;
}

/**
 * Parameters for retrieving a card-on-file link.
 *
 * @interface GetCofLinkParams
 * @property {string} customerId - The MoeGo customer ID.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface GetCofLinkParams {
  customerId: string;
  apiKey: string;
}

/**
 * Parameters for retrieving a customer.
 *
 * @interface GetCustomerParams
 * @property {string} customerId - The MoeGo customer ID.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface GetCustomerParams {
  customerId: string;
  apiKey: string;
}

/**
 * Parameters for checking whether a customer has finished appointments.
 *
 * @interface HasFinishedAppointmentsParams
 * @property {string} customerId - The MoeGo customer ID.
 * @property {string} companyId - The MoeGo company ID.
 * @property {string} businessId - The MoeGo business ID.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface HasFinishedAppointmentsParams {
  customerId: string;
  companyId: string;
  businessId: string;
  apiKey: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Build the Authorization header for MoeGo API requests.
 *
 * @function buildAuthHeader
 * @description Constructs a Basic auth header using the API key
 * per the MoeGo API authentication specification.
 *
 * @param {string} apiKey - The MoeGo API key secret.
 * @returns {string} The formatted Authorization header value.
 *
 * @example
 * const authHeader = buildAuthHeader(config.moegoApiKey);
 * // Returns: "Basic <api-key>"
 */
export function buildAuthHeader(apiKey: string): string {
  // Base64-encode the API key and prepend the Basic auth scheme
  return `Basic ${apiKey}`;
}

/**
 * Retry a UrlFetchApp call once after 2 seconds on transient bandwidth quota errors.
 *
 * @function fetchWithBandwidthRetry
 * @param {() => GoogleAppsScript.URL_Fetch.HTTPResponse} fn - The fetch call to execute.
 * @returns {GoogleAppsScript.URL_Fetch.HTTPResponse} The HTTP response.
 * @throws {Error} If both attempts fail or the error is not a bandwidth quota error.
 */
function fetchWithBandwidthRetry(
  fn: () => GoogleAppsScript.URL_Fetch.HTTPResponse
): GoogleAppsScript.URL_Fetch.HTTPResponse {
  try {
    return fn();
  } catch (err) {
    if (!String(err).includes('Bandwidth quota exceeded')) throw err;

    Utilities.sleep(2000);

    return fn();
  }
}

/**
 * Make an authenticated GET request to the MoeGo API.
 *
 * @function fetchFromMoeGo
 * @description Constructs and executes an authenticated GET request to the
 * MoeGo API. Handles query parameter construction, authentication headers,
 * response code validation, and JSON parsing.
 *
 * @template T - The expected response body type.
 * @param {FetchFromMoeGoParams} params - The request parameters.
 * @returns {T} The parsed response body.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 *
 * @example
 * const result = fetchFromMoeGo<{ signUrl: string }>({
 *   path: '/v1/agreements/agr_001/sign_link',
 *   params: { customer_id: 'cus_001', business_id: 'biz_001' },
 *   apiKey: config.moegoApiKey,
 * });
 */
export function fetchFromMoeGo<T>({ path, params, apiKey }: FetchFromMoeGoParams): T {
  // Construct query string from params if provided
  const queryString = params
    ? `?${Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`
    : '';

  // Construct the full URL
  const url = `${MOEGO_BASE_URL}${path}${queryString}`;

  const response = fetchWithBandwidthRetry(() =>
    UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        Authorization: buildAuthHeader(apiKey),
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true,
    })
  );

  // Throw a clear error if the response is not successful
  const responseCode = response.getResponseCode();
  if (responseCode !== 200) {
    throw new Error(
      `MoeGo API error: GET ${path} returned ${responseCode} — ${response.getContentText()}`
    );
  }

  // Parse and return the response body
  return JSON.parse(response.getContentText()) as T;
}

/**
 * Make an authenticated POST request to the MoeGo API.
 *
 * @function postToMoeGo
 * @description Constructs and executes an authenticated POST request to the
 * MoeGo API. Handles authentication headers, response code validation, and
 * JSON parsing.
 *
 * @template T - The expected response body type.
 * @param {string} path - The API endpoint path.
 * @param {unknown} body - The request body to serialize as JSON.
 * @param {string} apiKey - The MoeGo API key.
 * @returns {T} The parsed response body.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 */
function postToMoeGo<T>(path: string, body: unknown, apiKey: string): T {
  const response = fetchWithBandwidthRetry(() =>
    UrlFetchApp.fetch(`${MOEGO_BASE_URL}${path}`, {
      method: 'post',
      headers: {
        Authorization: buildAuthHeader(apiKey),
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    })
  );

  const responseCode = response.getResponseCode();
  if (responseCode !== 200) {
    throw new Error(
      `MoeGo API error: POST ${path} returned ${responseCode} — ${response.getContentText()}`
    );
  }

  return JSON.parse(response.getContentText()) as T;
}

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Retrieve an agreement sign link for a given customer.
 *
 * @function getAgreementSignLink
 * @description Calls the MoeGo Agreement API to generate a unique signing URL
 * for the specified agreement and customer.
 *
 * @param {GetAgreementSignLinkParams} params - The request parameters.
 * @returns {string} The unique signing URL.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 *
 * @example
 * // Retrieve Service Agreement sign link
 * const serviceAgreementUrl = getAgreementSignLink({
 *   agreementId: config.moegoServiceAgreementId,
 *   customerId: customer.id,
 *   businessId: config.moegoBusinessId,
 *   apiKey: config.moegoApiKey,
 * });
 *
 * // Retrieve SMS Agreement sign link
 * const smsAgreementUrl = getAgreementSignLink({
 *   agreementId: config.moegoSmsAgreementId,
 *   customerId: customer.id,
 *   businessId: config.moegoBusinessId,
 *   apiKey: config.moegoApiKey,
 * });
 */
export function getAgreementSignLink({
  agreementId,
  customerId,
  businessId,
  apiKey,
}: GetAgreementSignLinkParams): string {
  // Retrieve the agreement sign link via the MoeGo API
  const result = fetchFromMoeGo<{ signUrl: string }>({
    path: `/v1/agreements/${agreementId}/sign_link`,
    params: { customer_id: customerId, business_id: businessId },
    apiKey,
  });

  return result.signUrl;
}

/**
 * Retrieve a card-on-file link for a given customer.
 *
 * @function getCofLink
 * @description Calls the MoeGo Customer API to generate a unique card-on-file
 * link for the specified customer.
 *
 * @param {GetCofLinkParams} params - The request parameters.
 * @returns {string} The unique card-on-file link.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 *
 * @example
 * const cofLink = getCofLink({
 *   customerId: customer.id,
 *   apiKey: config.moegoApiKey,
 * });
 */
export function getCofLink({ customerId, apiKey }: GetCofLinkParams): string {
  // Retrieve the card-on-file link via the MoeGo Customer API
  const result = fetchFromMoeGo<{ link: string }>({
    path: `/v1/customers/${customerId}/cof/link`,
    apiKey,
  });

  return result.link;
}

/**
 * Retrieve a customer by ID.
 *
 * @function getCustomer
 * @description Calls the MoeGo Customer API to retrieve full customer details
 * for the specified customer ID.
 *
 * @param {GetCustomerParams} params - The request parameters.
 * @returns {MoeGoCustomer} The customer details.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 *
 * @example
 * const customer = getCustomer({
 *   customerId: event.appointment.customerId,
 *   apiKey: config.moegoApiKey,
 * });
 */
export function getCustomer({ customerId, apiKey }: GetCustomerParams): MoeGoCustomer {
  return fetchFromMoeGo<MoeGoCustomer>({
    path: `/v1/customers/${customerId}`,
    apiKey,
  });
}

/**
 * Check whether a customer has any finished appointments at a business.
 *
 * @function hasFinishedAppointments
 * @description Calls the MoeGo Appointments API to determine whether the given
 * customer has at least one completed appointment at the specified business.
 * Used to distinguish new clients from returning clients in `doPost`.
 *
 * @param {HasFinishedAppointmentsParams} params - The request parameters.
 * @returns {boolean} True if the customer has at least one finished appointment.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 */
export function hasFinishedAppointments({
  customerId,
  companyId,
  businessId,
  apiKey,
}: HasFinishedAppointmentsParams): boolean {
  const result = postToMoeGo<{ appointments: unknown[] }>(
    '/v1/appointments:list',
    {
      pagination: { pageSize: 1, pageToken: '1' },
      companyId,
      businessIds: [businessId],
      filter: {
        customerIds: [customerId],
        statuses: ['FINISHED'],
      },
    },
    apiKey
  );

  return (result.appointments?.length ?? 0) > 0;
}
