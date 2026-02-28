import type { MatchConfidence } from "@/lib/generated/prisma/client";

export const DOCUMENT_INBOUND_CHANNELS = ["email", "webhook", "manual_upload"] as const;
export type DocumentInboundChannel = (typeof DOCUMENT_INBOUND_CHANNELS)[number];

export const DOCUMENT_DRAFT_STATUSES = [
  "received",
  "parsing",
  "draft",
  "pending_review",
  "posted",
  "rejected",
] as const;
export type DocumentDraftStatus = (typeof DOCUMENT_DRAFT_STATUSES)[number];

export const DOCUMENT_TERMINAL_STATUSES: ReadonlySet<DocumentDraftStatus> = new Set([
  "posted",
  "rejected",
]);

export const VENDOR_TRUST_STATES = [
  "unverified",
  "learning",
  "trusted",
  "blocked",
] as const;
export type VendorTrustState = (typeof VENDOR_TRUST_STATES)[number];

export const VENDOR_TRUST_THRESHOLD = 5 as const;
export const DOCUMENT_AUTO_POST_CONFIDENCE_MIN = 0.85 as const;
export const DOCUMENT_ANALYTICS_MIN_POSTED_DRAFTS = 20 as const;
export const POSTMARK_INBOUND_CHANNEL = "email" as const;

export interface ParsedLineItem {
  description: string;
  quantity: number | null;
  unit_cost: number | null;
  line_total: number | null;
}

export interface ParsedDocumentFields {
  vendor_name: string | null;
  date: string | null;
  total: number | null;
  tax: number | null;
  line_items: ParsedLineItem[];
}

export interface VendorProfileSummary {
  id: string;
  vendor_name: string;
  trust_state: VendorTrustState;
  total_posted: number;
  trust_threshold_override: number | null;
  auto_post_enabled: boolean;
  last_document_at: string | null;
}

export interface DocumentDraftSummary {
  id: string;
  status: DocumentDraftStatus;
  confidence_band: MatchConfidence | null;
  parsed_vendor_name: string | null;
  parsed_total: number | null;
  parsed_date: string | null;
  auto_posted: boolean;
  created_at: string;
  vendor_profile: {
    id: string;
    vendor_name: string;
  } | null;
}

export interface DocumentAnalyticsPeriodFilter {
  days?: 30 | 60 | 90;
  startDate?: string;
  endDate?: string;
}

export interface VendorSpendSummaryItem {
  vendorId: string;
  vendorName: string;
  totalSpend: number;
  draftCount: number;
}

export interface VendorSpendSummaryResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  postedDraftCount: number;
  totalPostedDraftCount: number;
  minimumPostedDraftsRequired: number;
  minimumDataSatisfied: boolean;
  summary: VendorSpendSummaryItem[];
}

export interface PriceTrendPoint {
  date: string;
  description: string;
  unitCost: number | null;
  lineTotal: number | null;
  quantity: number | null;
}

export interface PriceTrendResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  vendorProfileId: string;
  availableItemNames: string[];
  points: PriceTrendPoint[];
}

export interface ReorderSignal {
  inventoryItemId: string;
  inventoryItemName: string;
  lastPurchaseAt: string;
  avgPurchaseIntervalDays: number;
  daysSinceLastPurchase: number;
  estimatedDaysUntilReorder: number;
}

export interface ReorderSignalsResult {
  generatedAt: string;
  signals: ReorderSignal[];
}

export interface TaxSummaryByVendor {
  vendorId: string;
  vendorName: string;
  taxTotal: number;
  draftCount: number;
}

export interface TaxSummaryResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  postedDraftCount: number;
  totalTax: number;
  byVendor: TaxSummaryByVendor[];
}

export interface CogsSummaryCategory {
  categoryName: string;
  totalExpense: number;
}

export interface CogsSummaryResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalExpense: number;
  byCategory: CogsSummaryCategory[];
}

export type DocumentAnomalyFlag =
  | "large_total"
  | "new_format"
  | "vendor_name_mismatch"
  | "unusual_line_count"
  | "duplicate_suspected";

export interface PostmarkInboundRecipient {
  Email: string;
  Name: string;
  MailboxHash: string;
}

export interface PostmarkInboundHeader {
  Name: string;
  Value: string;
}

export interface PostmarkInboundAttachment {
  Name: string;
  Content: string;
  ContentType: string;
  ContentLength: number;
  ContentID: string;
}

export interface PostmarkInboundPayload {
  FromName: string;
  From: string;
  FromFull: PostmarkInboundRecipient;
  To: string;
  ToFull: PostmarkInboundRecipient[];
  Cc: string;
  CcFull: PostmarkInboundRecipient[];
  Bcc: string;
  BccFull: PostmarkInboundRecipient[];
  OriginalRecipient: string;
  ReplyTo: string;
  Subject: string;
  MessageID: string;
  Date: string;
  MailboxHash: string;
  TextBody: string;
  HtmlBody: string;
  StrippedTextReply: string;
  Tag: string;
  Headers: PostmarkInboundHeader[];
  Attachments: PostmarkInboundAttachment[];
  MessageStream: string;
}
