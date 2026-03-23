/**
 * URL Shortener Tests
 *
 * @module
 * @description Unit tests for the Short.io URL shortener. Covers successful
 * URL shortening, API failure with full URL fallback, and network errors
 * with full URL fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { shortenUrl } from './shortener.js';

/**
 * Mock UrlFetchApp response object.
 *
 * @interface MockFetchResponse
 * @property {() => number} getResponseCode - Returns the mock HTTP response code.
 * @property {() => string} getContentText - Returns the mock response body as a string.
 */
interface MockFetchResponse {
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
 * @private
 */
function createMockFetchResponse(responseCode: number, body: unknown): MockFetchResponse {
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
 * @private
 */
function stubUrlFetchApp(response: MockFetchResponse): void {
  vi.stubGlobal('UrlFetchApp', {
    fetch: vi.fn().mockReturnValue(response),
  });
}

/**
 * Stub UrlFetchApp to simulate a network error.
 *
 * @function stubUrlFetchAppNetworkError
 * @description Stubs the UrlFetchApp global to throw a network error on fetch.
 *
 * @returns {void}
 * @private
 */
function stubUrlFetchAppNetworkError(): void {
  vi.stubGlobal('UrlFetchApp', {
    fetch: vi.fn().mockImplementation(() => {
      throw new Error('Network error');
    }),
  });
}

const mockConfig = {
  shortIoApiKey: 'test-api-key',
  shortIoDomain: 'abc.short.gy',
};

vi.mock('#/utils/config.js', () => ({
  getConfig: () => mockConfig,
}));

/**
 * shortenUrl
 *
 * @description Tests for URL shortening via Short.io. Covers successful
 * shortening, API failure fallback, and network error fallback.
 */
describe('shortenUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the URL is successfully shortened and the
   * shortURL is returned.
   */
  it('returns the shortened URL on success', async () => {
    stubUrlFetchApp(createMockFetchResponse(200, { shortURL: 'https://abc.short.gy/xyz123' }));

    const result = await shortenUrl(
      'https://docs.google.com/forms/d/e/test/viewform?entry.111=John'
    );

    expect(result.url).toBe('https://abc.short.gy/xyz123');
    expect(result.shortened).toBe(true);
  });

  /**
   * @test
   * @description Confirms the full URL is returned as fallback when the
   * Short.io API returns a non-200 response.
   */
  it('returns the full URL as fallback on non-200 response', async () => {
    stubUrlFetchApp(createMockFetchResponse(402, { message: 'Payment required' }));

    const longUrl = 'https://docs.google.com/forms/d/e/test/viewform?entry.111=John';
    const result = await shortenUrl(longUrl);

    expect(result.url).toBe(longUrl);
    expect(result.shortened).toBe(false);
  });

  /**
   * @test
   * @description Confirms the full URL is returned as fallback when the
   * Short.io API call fails due to a network error.
   */
  it('returns the full URL as fallback on network error', async () => {
    stubUrlFetchAppNetworkError();

    const longUrl = 'https://docs.google.com/forms/d/e/test/viewform?entry.111=John';
    const result = await shortenUrl(longUrl);

    expect(result.url).toBe(longUrl);
    expect(result.shortened).toBe(false);
  });
});
