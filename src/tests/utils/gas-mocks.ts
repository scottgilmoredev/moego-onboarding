/**
 * GAS Mock Utilities
 *
 * @module
 * @description Shared test utilities for mocking Google Apps Script globals
 * in Vitest tests. Provides a shared mock config, mock response factories,
 * and UrlFetchApp stubs for use across test files.
 */

import type { Config } from '#/utils/config.js';

/**
 * Shared mock configuration for use across all test files.
 *
 * @constant mockConfig
 * @description Covers all required Config fields. Import and pass to
 * `vi.mock('#/utils/config.js', () => ({ getConfig: () => mockConfig }))`.
 */
export const mockConfig: Config = {
  moegoApiKey: 'test-api-key',
  moegoCompanyId: 'cmp_001',
  moegoBusinessId: 'test-business-id',
  moegoServiceAgreementId: 'agr_service',
  moegoSmsAgreementId: 'agr_sms',
  moegoWebhookSecret: 'test-webhook-secret',
  shortIoApiKey: 'test-shortio-key',
  shortIoDomain: 'abc.short.gy',
  businessOwnerEmails: ['owner@example.com', 'another-owner@example.com'],
  landingPageUrl: 'https://script.google.com/macros/s/abc/exec',
  driveFolderId: 'test-folder-id',
  spreadsheetId: 'test-spreadsheet-id',
  businessName: 'Test Business',
  businessLogoUrl: 'https://example.com/logo.png',
  businessPhone: '555-555-5555',
};

/**
 * Mock UrlFetchApp response object.
 *
 * @interface MockFetchResponse
 * @property {() => number} getResponseCode - Returns the mock HTTP response code.
 * @property {() => string} getContentText - Returns the mock response body as a string.
 */
export interface MockFetchResponse {
  getResponseCode: () => number;
  getContentText: () => string;
}

/**
 * Create a mock UrlFetchApp response.
 *
 * @function createMockFetchResponse
 * @description Factory for creating mock UrlFetchApp fetch responses for use
 * in tests.
 *
 * @param {number} responseCode - The HTTP response code to return.
 * @param {unknown} body - The response body to serialize and return.
 * @returns {MockFetchResponse} A mock UrlFetchApp response object.
 */
export function createMockFetchResponse(responseCode: number, body: unknown): MockFetchResponse {
  return {
    getResponseCode: () => responseCode,
    getContentText: () => JSON.stringify(body),
  };
}

/**
 * Stub UrlFetchApp with a mock response.
 *
 * @function stubUrlFetchApp
 * @description Stubs the UrlFetchApp global with a mock fetch implementation
 * returning the provided response.
 *
 * @param {MockFetchResponse} response - The mock response to return.
 * @returns {void}
 */
export function stubUrlFetchApp(response: MockFetchResponse): void {
  vi.stubGlobal('UrlFetchApp', {
    fetch: vi.fn().mockReturnValue(response),
  });
}

/**
 * Stub UrlFetchApp with a sequence of mock responses.
 *
 * @function stubUrlFetchAppSequence
 * @description Stubs the UrlFetchApp global with a mock fetch implementation
 * that returns each response in order, one per call.
 *
 * @param {MockFetchResponse[]} responses - The ordered mock responses to return.
 * @returns {void}
 */
export function stubUrlFetchAppSequence(responses: MockFetchResponse[]): void {
  const mock = vi.fn();
  for (const response of responses) {
    mock.mockReturnValueOnce(response);
  }
  vi.stubGlobal('UrlFetchApp', { fetch: mock });
}

/**
 * Stub UrlFetchApp to simulate a network error.
 *
 * @function stubUrlFetchAppNetworkError
 * @description Stubs the UrlFetchApp global to throw a network error on fetch.
 *
 * @returns {void}
 */
export function stubUrlFetchAppNetworkError(): void {
  vi.stubGlobal('UrlFetchApp', {
    fetch: vi.fn().mockImplementation(() => {
      throw new Error('Network error');
    }),
  });
}
