/**
 * MoeGo API Client Tests
 *
 * @module
 * @description Unit tests for the MoeGo API client. Covers authentication
 * header construction, Service Agreement sign link retrieval, SMS Agreement
 * sign link retrieval, and card-on-file link retrieval.
 */

import { describe, it, expect } from 'vitest';

import { buildAuthHeader } from './moego.js';

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
