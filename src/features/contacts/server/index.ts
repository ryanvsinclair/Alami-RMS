/**
 * Contacts feature server barrel export.
 * Canonical entry point for contacts services/repositories.
 */

export type { CreateContactInput, UpdateContactInput } from "./contacts.service";

export {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
} from "./contacts.service";

export {
  findContacts,
  findContactById,
  createContactRecord,
  updateContactForBusiness,
  deleteContactForBusiness,
} from "./contacts.repository";
