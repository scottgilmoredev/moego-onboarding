/**
 * MoeGo API Client Tests
 *
 * @module
 * @description Unit tests for the MoeGo API client. Covers authentication
 * header construction, shared API request utility, customer retrieval, agreement
 * sign link retrieval, and card-on-file link retrieval. Agreement sign link
 * retrieval is used for both Service Agreement and SMS Agreement sign links
 * via `getAgreementSignLink`.
 */

import {
  buildAuthHeader,
  fetchFromMoeGo,
  getAgreementSignLink,
  getCofLink,
  getCustomer,
} from './moego.js';

import {
  createMockFetchResponse,
  stubUrlFetchApp,
  stubUrlFetchAppNetworkError,
} from '#/tests/utils/gas-mocks.js';

/**
 * buildAuthHeader
 *
 * @description Tests for authentication header construction.
 */
describe('buildAuthHeader', () => {
  /**
   * @test
   * @description Confirms the Authorization header is correctly constructed
   * with API key using Basic auth scheme.
   */
  it('returns a correctly formatted Basic auth header', () => {
    const apiKey = 'test-api-key';

    expect(buildAuthHeader(apiKey)).toBe(`Basic ${apiKey}`);
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
  it('returns parsed response body on success', () => {
    stubUrlFetchApp(
      createMockFetchResponse(200, { signUrl: 'https://client.moego.pet/agreement/sign/abc123' })
    );

    const result = fetchFromMoeGo<{ signUrl: string }>({
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
  it('throws on non-200 response', () => {
    stubUrlFetchApp(createMockFetchResponse(404, { message: 'Not found' }));

    expect(() =>
      fetchFromMoeGo({
        path: '/v1/agreements/agr_001/sign_link',
        params: { customer_id: 'cus_001', business_id: 'biz_001' },
        apiKey: 'test-api-key',
      })
    ).toThrow();
  });

  /**
   * @test
   * @description Confirms an error is thrown on a network error.
   */
  it('throws on network error', () => {
    stubUrlFetchAppNetworkError();

    expect(() =>
      fetchFromMoeGo({
        path: '/v1/agreements/agr_001/sign_link',
        params: { customer_id: 'cus_001', business_id: 'biz_001' },
        apiKey: 'test-api-key',
      })
    ).toThrow();
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
  it('returns the signUrl for a valid request', () => {
    stubUrlFetchApp(
      createMockFetchResponse(200, { signUrl: 'https://client.moego.pet/agreement/sign/abc123' })
    );

    const result = getAgreementSignLink({
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
  it('throws on non-200 response', () => {
    stubUrlFetchApp(createMockFetchResponse(404, { message: 'Not found' }));

    expect(() =>
      getAgreementSignLink({
        agreementId: 'agr_001',
        customerId: 'cus_001',
        businessId: 'biz_001',
        apiKey: 'test-api-key',
      })
    ).toThrow();
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API call fails.
   */
  it('throws on network error', () => {
    stubUrlFetchAppNetworkError();

    expect(() =>
      getAgreementSignLink({
        agreementId: 'agr_001',
        customerId: 'cus_001',
        businessId: 'biz_001',
        apiKey: 'test-api-key',
      })
    ).toThrow();
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
  it('returns the link for a valid request', () => {
    stubUrlFetchApp(
      createMockFetchResponse(200, {
        link: 'https://client.moego.pet/payment/cof/client?c=abc123',
      })
    );

    const result = getCofLink({
      customerId: 'cus_001',
      apiKey: 'test-api-key',
    });

    expect(result).toBe('https://client.moego.pet/payment/cof/client?c=abc123');
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API returns a non-200 response.
   */
  it('throws on non-200 response', () => {
    stubUrlFetchApp(createMockFetchResponse(404, { message: 'Not found' }));

    expect(() =>
      getCofLink({
        customerId: 'cus_001',
        apiKey: 'test-api-key',
      })
    ).toThrow();
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API call fails.
   */
  it('throws on network error', () => {
    stubUrlFetchAppNetworkError();

    expect(() =>
      getCofLink({
        customerId: 'cus_001',
        apiKey: 'test-api-key',
      })
    ).toThrow();
  });
});

/**
 * getCustomer
 *
 * @description Tests for customer retrieval. Covers successful retrieval,
 * non-200 error handling, and network errors.
 */
describe('getCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the customer is successfully retrieved and returned.
   */
  it('returns the customer for a valid request', () => {
    stubUrlFetchApp(
      createMockFetchResponse(200, {
        id: 'cus_001',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+15550001234',
      })
    );

    const result = getCustomer({
      customerId: 'cus_001',
      apiKey: 'test-api-key',
    });

    expect(result.id).toBe('cus_001');
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Smith');
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API returns a non-200 response.
   */
  it('throws on non-200 response', () => {
    stubUrlFetchApp(createMockFetchResponse(404, { message: 'Not found' }));

    expect(() =>
      getCustomer({
        customerId: 'cus_001',
        apiKey: 'test-api-key',
      })
    ).toThrow();
  });

  /**
   * @test
   * @description Confirms an error is thrown when the API call fails.
   */
  it('throws on network error', () => {
    stubUrlFetchAppNetworkError();

    expect(() =>
      getCustomer({
        customerId: 'cus_001',
        apiKey: 'test-api-key',
      })
    ).toThrow();
  });
});
