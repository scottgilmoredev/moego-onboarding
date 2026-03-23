/**
 * Server Tests
 *
 * @module
 * @description Tests for the Apps Script doPost entrypoint. Stub tests confirm
 * the entrypoint exists and is callable
 *
 * // TODO: Full integration tests covering the complete onboarding flow are added in Milestone 6
 */

import { doPost } from '#/server.js';

// Mock GAS globals
const mockTextOutput = { getContent: vi.fn() };

vi.stubGlobal('ContentService', {
  createTextOutput: vi.fn().mockReturnValue(mockTextOutput),
});

vi.stubGlobal('console', {
  log: vi.fn(),
});

describe('doPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms doPost handles a valid CUSTOMER_CREATED payload
   * without throwing.
   */
  it('handles a valid CUSTOMER_CREATED payload without throwing', () => {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({
          id: 'evt_001',
          type: 'CUSTOMER_CREATED',
          timestamp: '2024-08-01T12:10:00Z',
          companyId: 'cmp_001',
          customer: {
            id: 'cus_001',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+12125551234',
          },
        }),
        type: 'application/json',
        length: 0,
        name: '',
      },
    } as GoogleAppsScript.Events.DoPost;

    expect(() => doPost(mockEvent)).not.toThrow();
    expect(ContentService.createTextOutput).toHaveBeenCalledWith('OK');
  });
});
