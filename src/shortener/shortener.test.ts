/**
 * URL Shortener Tests
 *
 * @module
 * @description Unit tests for the Short.io URL shortener. Covers successful
 * URL shortening, API failure with full URL fallback, and network errors
 * with full URL fallback.
 */

import { shortenUrl, shortenUrlStrict } from './shortener.js';

import {
  createMockFetchResponse,
  stubUrlFetchApp,
  stubUrlFetchAppNetworkError,
} from '#/tests/utils/gas-mocks.js';

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
  it('returns the shortened URL on success', () => {
    stubUrlFetchApp(createMockFetchResponse(200, { shortURL: 'https://abc.short.gy/xyz123' }));

    const result = shortenUrl('https://docs.google.com/forms/d/e/test/viewform?entry.111=John');

    expect(result.url).toBe('https://abc.short.gy/xyz123');
    expect(result.shortened).toBe(true);
  });

  /**
   * @test
   * @description Confirms the full URL is returned as fallback when the
   * Short.io API returns a non-200 response.
   */
  it('returns the full URL as fallback on non-200 response', () => {
    stubUrlFetchApp(createMockFetchResponse(402, { message: 'Payment required' }));

    const longUrl = 'https://docs.google.com/forms/d/e/test/viewform?entry.111=John';
    const result = shortenUrl(longUrl);

    expect(result.url).toBe(longUrl);
    expect(result.shortened).toBe(false);
  });

  /**
   * @test
   * @description Confirms the full URL is returned as fallback when the
   * Short.io API call fails due to a network error.
   */
  it('returns the full URL as fallback on network error', () => {
    stubUrlFetchAppNetworkError();

    const longUrl = 'https://docs.google.com/forms/d/e/test/viewform?entry.111=John';
    const result = shortenUrl(longUrl);

    expect(result.url).toBe(longUrl);
    expect(result.shortened).toBe(false);
  });
});

/**
 * shortenUrlStrict
 *
 * @description Tests for strict URL shortening via Short.io. Covers successful
 * shortening, throwing on API failure, and throwing on network error.
 */
describe('shortenUrlStrict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the shortened URL is returned on success.
   */
  it('returns the shortened URL on success', () => {
    stubUrlFetchApp(createMockFetchResponse(200, { shortURL: 'https://abc.short.gy/xyz123' }));

    const result = shortenUrlStrict('https://script.google.com/macros/s/abc/exec?token=xyz');

    expect(result).toBe('https://abc.short.gy/xyz123');
  });

  /**
   * @test
   * @description Confirms an error is thrown when the Short.io API returns
   * a non-200 response, with the full URL included in the message.
   */
  it('throws with the full URL on non-200 response', () => {
    stubUrlFetchApp(createMockFetchResponse(402, { message: 'Payment required' }));

    const longUrl = 'https://script.google.com/macros/s/abc/exec?token=xyz';

    expect(() => shortenUrlStrict(longUrl)).toThrow(longUrl);
  });

  /**
   * @test
   * @description Confirms an error is thrown on network error, with the full
   * URL included in the message.
   */
  it('throws with the full URL on network error', () => {
    stubUrlFetchAppNetworkError();

    const longUrl = 'https://script.google.com/macros/s/abc/exec?token=xyz';

    expect(() => shortenUrlStrict(longUrl)).toThrow(longUrl);
  });
});
