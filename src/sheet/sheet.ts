/**
 * Google Sheets Client
 *
 * @module
 * @description Reads from and writes to a configured Google Sheet via SpreadsheetApp.
 */

import type { MoeGoCustomer } from '#/types/moego.js';
import { getConfig } from '#/utils/config.js';

type SheetCellValue = string | number | boolean;

/**
 * Append a row to the configured Google Sheet.
 *
 * @function appendSheetRow
 * @description Opens the configured spreadsheet and appends the provided
 * values as a new row to the active sheet. Throws on any SpreadsheetApp
 * or write failure.
 *
 * @param {SheetCellValue[]} values - The cell values to append, in column order.
 * @throws {Error} If the spreadsheet cannot be opened or the row cannot be written.
 */
export function appendSheetRow(values: SheetCellValue[]): void {
  const { spreadsheetId } = getConfig();
  const sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();

  sheet.appendRow(values);
}

/**
 * Format a timestamp as a human-readable string for sheet display.
 *
 * @function formatTimestamp
 * @description Returns a UTC timestamp string in `YYYY-MM-DD HH:MM` format.
 *
 * @param {number} ms - Unix timestamp in milliseconds.
 * @returns {string} Formatted timestamp string.
 */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * Write a client onboarding row to the configured Google Sheet.
 *
 * @function writeClientRow
 * @description Assembles a row from client metadata, the shortened token URL,
 * and a sentAt timestamp, then inserts it in alphabetical order by last name.
 * If the last name sorts after all existing rows, the row is appended.
 *
 * @param {object} params - The row parameters.
 * @param {MoeGoCustomer} params.customer - The client's MoeGo customer record.
 * @param {string} params.shortUrl - The shortened token URL to forward to the client.
 * @throws {Error} If the sheet write fails.
 */
export function writeClientRow({
  customer,
  shortUrl,
}: {
  customer: MoeGoCustomer;
  shortUrl: string;
}): void {
  const { spreadsheetId } = getConfig();
  const sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();

  const sentAt = formatTimestamp(Date.now());
  const row: SheetCellValue[] = [
    customer.lastName,
    customer.firstName,
    customer.phone,
    customer.id,
    shortUrl,
    sentAt,
    '',
  ];

  // Find alphabetical insert position by last name, skipping the header row
  const allRows = sheet.getDataRange().getValues() as string[][];
  const dataRows = allRows.slice(1);
  const insertIndex = dataRows.findIndex(r => r[0].toLowerCase() > customer.lastName.toLowerCase());

  if (insertIndex === -1) {
    // Last name sorts after all existing rows — append
    sheet.appendRow(row);
  } else {
    // Insert before the first row with a greater last name (+ 2: 1 for header, 1 for 1-based index)
    const targetRow = insertIndex + 2;
    sheet.insertRowBefore(targetRow);
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }
}
