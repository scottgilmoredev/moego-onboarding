/**
 * Constants
 *
 * @module
 * @description Shared constants used across modules.
 */

import { MoeGoEventType } from '#/types/moego.js';

/**
 * Whether the current runtime is Google Apps Script.
 * Detected by checking for the presence of the PropertiesService global.
 */
export const IS_GAS_RUNTIME = typeof PropertiesService !== 'undefined';

/**
 * Required fields on the appointment object in an APPOINTMENT_CREATED payload.
 */
export const REQUIRED_APPOINTMENT_FIELDS = ['customerId'] as const;

/**
 * Required fields on the customer object in a CUSTOMER_CREATED payload.
 */
export const REQUIRED_CUSTOMER_FIELDS = ['id', 'firstName', 'lastName', 'phone'] as const;

/**
 * The MoeGo webhook event type this application handles.
 */
export const SUPPORTED_EVENT_TYPES = [MoeGoEventType.APPOINTMENT_CREATED];
