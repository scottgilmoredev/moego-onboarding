/**
 * MoeGo API Types
 *
 * @module
 * @description TypeScript type definitions for MoeGo API entities including
 * webhook events, customers, and related data structures.
 */

/**
 * Supported MoeGo webhook event types.
 */
export enum MoeGoEventType {
  HEALTH_CHECK = 'HEALTH_CHECK',
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_FINISHED = 'APPOINTMENT_FINISHED',
  APPOINTMENT_CANCELED = 'APPOINTMENT_CANCELED',
  APPOINTMENT_DELETED = 'APPOINTMENT_DELETED',
  CUSTOMER_CREATED = 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED = 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED = 'CUSTOMER_DELETED',
}

// ============================================================================
// ENTITIES
// ============================================================================

/**
 * Appointment entity as included in APPOINTMENT_CREATED webhook events.
 *
 * @interface MoeGoAppointment
 * @property {string} id - Unique identifier for the appointment.
 * @property {string} businessId - ID of the business location where the appointment is scheduled.
 * @property {string} customerId - ID of the customer who booked the appointment.
 */
export interface MoeGoAppointment {
  id: string;
  businessId: string;
  customerId: string;
}

/**
 * Customer communication and marketing preference settings.
 *
 * @interface MoeGoCustomerPreference
 * @property {boolean} receiveAutoMessage - Whether the customer wants to receive automated SMS messages.
 * @property {boolean} receiveAutoEmail - Whether the customer wants to receive automated emails.
 * @property {boolean} subscribeToMarketingEmails - Whether the customer has opted in to marketing emails.
 * @property {boolean} receiveAppointmentReminder - Whether the customer wants appointment reminders.
 */
export interface MoeGoCustomerPreference {
  receiveAutoMessage: boolean;
  receiveAutoEmail: boolean;
  subscribeToMarketingEmails: boolean;
  receiveAppointmentReminder: boolean;
}

/**
 * Customer entity as returned by the MoeGo API.
 *
 * @interface MoeGoCustomer
 * @property {string} id - Unique identifier for the customer.
 * @property {string} firstName - Customer's first name.
 * @property {string} lastName - Customer's last name.
 * @property {string} phone - Customer's phone number in E.164 format (e.g. +12125551234).
 * @property {string} [email] - Customer's email address.
 * @property {string} companyId - ID of the company this customer belongs to.
 * @property {string} [preferredBusinessId] - ID of the customer's preferred business location.
 * @property {string} [status] - Current status of the customer.
 * @property {string} [source] - How the customer was acquired.
 * @property {MoeGoCustomerPreference} [preference] - Customer's communication and marketing preferences.
 * @property {string} [createdTime] - When this customer was created.
 * @property {string} [lastUpdatedTime] - When this customer was last modified.
 */
export interface MoeGoCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  companyId: string;
  preferredBusinessId?: string;
  status?: string;
  source?: string;
  preference?: MoeGoCustomerPreference;
  createdTime?: string;
  lastUpdatedTime?: string;
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Base MoeGo webhook event.
 *
 * @interface MoeGoEvent
 * @property {string} id - Unique identifier for the event (format: "evt_" followed by random chars).
 * @property {MoeGoEventType} type - Category of the event determining payload type and processing rules.
 * @property {string} timestamp - When this event occurred (for ordering and processing).
 * @property {string} companyId - ID of the company associated with the event.
 */
export interface MoeGoEvent {
  id: string;
  type: MoeGoEventType;
  timestamp: string;
  companyId: string;
}

/**
 * MoeGo APPOINTMENT_CREATED webhook event.
 *
 * @interface MoeGoAppointmentCreatedEvent
 * @extends MoeGoEvent
 * @property {MoeGoEventType.APPOINTMENT_CREATED} type - Event type discriminant.
 * @property {MoeGoAppointment} appointment - The appointment associated with the event.
 */
export interface MoeGoAppointmentCreatedEvent extends MoeGoEvent {
  type: MoeGoEventType.APPOINTMENT_CREATED;
  appointment: MoeGoAppointment;
}

/**
 * MoeGo CUSTOMER_CREATED webhook event.
 *
 * @interface MoeGoCustomerCreatedEvent
 * @extends MoeGoEvent
 * @property {MoeGoEventType.CUSTOMER_CREATED} type - Event type discriminant.
 * @property {MoeGoCustomer} customer - Full customer details from the MoeGo customer data model.
 */
export interface MoeGoCustomerCreatedEvent extends MoeGoEvent {
  type: MoeGoEventType.CUSTOMER_CREATED;
  customer: MoeGoCustomer;
}
