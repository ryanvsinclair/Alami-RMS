export interface LegalContactProfile {
  appName: string;
  legalEntityName: string;
  websiteUrl: string;
  privacyEmail: string;
  supportEmail: string;
  legalAddress: string;
  effectiveDateLabel: string;
  minimumAge: number;
  governingLaw: string;
  disputeVenue: string;
  businessJurisdictions: string;
}

/**
 * Replace placeholder values before publishing legal pages to production.
 * These fields are centralized so privacy/terms stay in sync.
 */
export const LEGAL_PROFILE: LegalContactProfile = {
  appName: "Vynance",
  legalEntityName: "CarlyOS Inc.",
  websiteUrl: "https://www.vynance.ca",
  privacyEmail: "support@vynance.ca",
  supportEmail: "support@vynance.ca",
  legalAddress: "[INSERT LEGAL MAILING ADDRESS]",
  effectiveDateLabel: "March 2, 2026",
  minimumAge: 18,
  governingLaw: "[INSERT GOVERNING LAW]",
  disputeVenue: "[INSERT DISPUTE VENUE]",
  businessJurisdictions: "[INSERT PRIMARY SALES/USER JURISDICTIONS]",
};
