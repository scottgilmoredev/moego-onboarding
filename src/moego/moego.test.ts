/**
 * MoeGo API Client Tests
 *
 * @module
 * @description Unit tests for the MoeGo API client. Covers authentication
 * header construction, shared API request utility, and agreement sign link
 * retrieval. Agreement sign link retrieval is used for both Service Agreement
 * and SMS Agreement sign links via `getAgreementSignLink`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { buildAuthHeader, fetchFromMoeGo, getAgreementSignLink, getCofLink } from './moego.js';

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

/**
 * buildAuthHeader
 *
 * @description Tests for authentication header construction.
 */
describe('buildAuthHeader', () => {
  /**
   * @test
   * @description Confirms the Authorization header is correctly constructed
   * with Base64-encoded API key using Basic auth scheme.
   */
  it('returns a correctly formatted Basic auth header', () => {
    const apiKey = 'test-api-key';
    const expected = `Basic ${btoa(apiKey)}`;

    expect(buildAuthHeader(apiKey)).toBe(expected);
  });

  /**
   * @test
   * @description Confirms different API keys produce different headers.
   */
  it('produces unique headers for different API keys', () => {
    const header1 = buildAuthHeader('key-one');
    const header2 = buildAuthHeader('key-two');

    expect(header1).not.toBe(header2);
  });
});

/**
 * fetchFromMoeGo
 *
 * @description Tests for the shared MoeGo API request utility. Covers
 * successful response parsing, non-200 error handling, and network errors.
 */
describe('fetchFromMoeGo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms a successful request returns the parsed response body.
   */
  it('returns parsed response body on success', async () => {
    stubUrlFetchApp(
      createMockFetchResponse(200, { signUrl: 'https://client.moego.pet/agreement/sign/abc123' })
    );

    const result = await fetchFromMoeGo<{ signUrl: string }>({
      path: '/v1/agreements/agr_001/sign_link',
      params: { customer_id: 'cus_001', business_id: 'biz_001' },
      apiKey: 'test-api-key',
    });

    expect(result.signUrl).toBe('https://client.moego.pet/agreement/sign/abc123');
  });

  /**
   * @test
   * @description Confirms an error is thrown on a non-200 response.
   */
  it('throws on non-200 response', async () => {
    stubUrlFetchApp(createMockFetchResponse(404, { message: 'Not found' }));

    await expect(
      fetchFromMoeGo({
        path: '/v1/agreements/agr_001/sign_link',
        params: { customer_id: 'cus_001', business_id: 'biz_001' },
        apiKey: 'test-api-key',
      })
    ).rejects.toThrow();
  });

  /**
   * @test
   * @description Confirms an error is thrown on a network error.
   */
  it('throws on network error', async () => {
    stubUrlFetchAppNetworkError();

    await expect(
      fetchFromMoeGo({
        path: '/v1/agreements/agr_001/sign_link',
        params: { customer_id: 'cus_001', business_id: 'biz_001' },
        apiKey: 'test-api-key',
      })
    ).rejects.toThrow();
  });
});

/**
 * getAgreementSignLink
 *
 * @description Tests for agreement sign link retrieval. Covers successful
 * retrieval, non-200 error handling, and network errors. Used for both
 * Service Agreement and SMS Agreement sign links.
 */
describe('getAgreementSignLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the agreement sign link is successfully retrieved
   * and the signUrl is returned.
   */
  it('returns the signUrl for a valid request', async () => {
    stubUrlFetchApp(
      createMockFetchResponse(200, { signUrl: 'https://client.moego.pet/agreement/sign/abc123' })
    );

    const result = await getAgreementSignLink({
      agreementId: 'agr_001',
      customerId: 'cus_001',
      businessId: 'biz_001',
      apiKey: 'test-api-key',
    });

    expect(result).toBe('https://client.moego.pet/agreement/sign/abc123');
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API returns a non-200 response.
   */
  it('throws on non-200 response', async () => {
    stubUrlFetchApp(createMockFetchResponse(404, { message: 'Not found' }));

    await expect(
      getAgreementSignLink({
        agreementId: 'agr_001',
        customerId: 'cus_001',
        businessId: 'biz_001',
        apiKey: 'test-api-key',
      })
    ).rejects.toThrow();
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API call fails.
   */
  it('throws on network error', async () => {
    stubUrlFetchAppNetworkError();

    await expect(
      getAgreementSignLink({
        agreementId: 'agr_001',
        customerId: 'cus_001',
        businessId: 'biz_001',
        apiKey: 'test-api-key',
      })
    ).rejects.toThrow();
  });
});

/**
 * getCofLink
 *
 * @description Tests for card-on-file link retrieval. Covers successful
 * retrieval, non-200 error handling, and network errors.
 */
describe('getCofLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the card-on-file link is successfully retrieved
   * and returned.
   */
  it('returns the link for a valid request', async () => {
    stubUrlFetchApp(
      createMockFetchResponse(200, {
        link: 'https://client.moego.pet/payment/cof/client?c=abc123',
      })
    );

    const result = await getCofLink({
      customerId: 'cus_001',
      apiKey: 'test-api-key',
    });

    expect(result).toBe('https://client.moego.pet/payment/cof/client?c=abc123');
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API returns a non-200 response.
   */
  it('throws on non-200 response', async () => {
    stubUrlFetchApp(createMockFetchResponse(404, { message: 'Not found' }));

    await expect(
      getCofLink({
        customerId: 'cus_001',
        apiKey: 'test-api-key',
      })
    ).rejects.toThrow();
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API call fails.
   */
  it('throws on network error', async () => {
    stubUrlFetchAppNetworkError();

    await expect(
      getCofLink({
        customerId: 'cus_001',
        apiKey: 'test-api-key',
      })
    ).rejects.toThrow();
  });
});
