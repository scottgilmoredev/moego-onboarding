/**
 * Google Sheets Client Tests
 *
 * @module
 * @description Unit tests for the Google Sheets client. Covers successful
 * row append and writeClientRow row assembly, SpreadsheetApp errors, and
 * sheet-not-found errors.
 */

import { appendSheetRow, writeClientRow } from './sheet.js';

const mockConfig = {
  spreadsheetId: 'test-spreadsheet-id',
};

vi.mock('#/utils/config.js', () => ({
  getConfig: () => mockConfig,
}));

/**
 * appendSheetRow
 *
 * @description Tests for the appendSheetRow function. Covers successful
 * append, SpreadsheetApp errors, and sheet-not-found errors.
 */
describe('appendSheetRow', () => {
  const mockSheet = { appendRow: vi.fn() };
  const mockSpreadsheet = { getActiveSheet: vi.fn().mockReturnValue(mockSheet) };

  beforeEach(() => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue(mockSpreadsheet),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms appendRow is called with the provided values.
   */
  it('appends a row with the provided values', () => {
    const values = ['2026-03-30', 'John Doe', 'https://abc.short.gy/xyz123'];

    appendSheetRow(values);

    expect(SpreadsheetApp.openById).toHaveBeenCalledWith('test-spreadsheet-id');
    expect(mockSpreadsheet.getActiveSheet).toHaveBeenCalled();
    expect(mockSheet.appendRow).toHaveBeenCalledWith(values);
  });

  /**
   * @test
   * @description Confirms SpreadsheetApp errors propagate to the caller.
   */
  it('propagates SpreadsheetApp errors', () => {
    SpreadsheetApp.openById = vi.fn().mockImplementation(() => {
      throw new Error('Spreadsheet not found');
    });

    expect(() => appendSheetRow(['value'])).toThrow('Spreadsheet not found');
  });

  /**
   * @test
   * @description Confirms appendRow errors propagate to the caller.
   */
  it('propagates appendRow errors', () => {
    mockSheet.appendRow = vi.fn().mockImplementation(() => {
      throw new Error('Write failed');
    });

    expect(() => appendSheetRow(['value'])).toThrow('Write failed');
  });
});

/**
 * writeClientRow
 *
 * @description Tests for the writeClientRow orchestration function. Covers
 * correct row assembly from customer metadata, shortened URL, and Drive link.
 */
describe('writeClientRow', () => {
  const mockSheet = { appendRow: vi.fn() };
  const mockSpreadsheet = { getActiveSheet: vi.fn().mockReturnValue(mockSheet) };

  const mockCustomer = {
    id: 'cus_001',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+14045551234',
    companyId: 'cmp_001',
  };

  beforeEach(() => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue(mockSpreadsheet),
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms the row includes the customer name, phone, shortened
   * URL, and Drive link in the correct column order.
   */
  it('appends a row with customer metadata, shortened URL, and Drive link', () => {
    writeClientRow({
      customer: mockCustomer,
      shortUrl: 'https://abc.short.gy/xyz123',
      driveFileUrl: 'https://drive.google.com/file/d/abc/view',
    });

    expect(mockSheet.appendRow).toHaveBeenCalledWith([
      'Jane',
      'Smith',
      '+14045551234',
      'https://abc.short.gy/xyz123',
      'https://drive.google.com/file/d/abc/view',
    ]);
  });

  /**
   * @test
   * @description Confirms the Drive link column is empty string when not provided.
   */
  it('uses empty string for Drive link when not provided', () => {
    writeClientRow({
      customer: mockCustomer,
      shortUrl: 'https://abc.short.gy/xyz123',
    });

    expect(mockSheet.appendRow).toHaveBeenCalledWith([
      'Jane',
      'Smith',
      '+14045551234',
      'https://abc.short.gy/xyz123',
      '',
    ]);
  });

  /**
   * @test
   * @description Confirms SpreadsheetApp errors propagate to the caller.
   */
  it('propagates SpreadsheetApp errors', () => {
    SpreadsheetApp.openById = vi.fn().mockImplementation(() => {
      throw new Error('Spreadsheet not found');
    });

    expect(() =>
      writeClientRow({ customer: mockCustomer, shortUrl: 'https://abc.short.gy/xyz123' })
    ).toThrow('Spreadsheet not found');
  });
});
