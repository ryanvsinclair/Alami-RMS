export interface ReceiveItemCategory {
  name: string;
}

export interface ReceiveInventoryItemOption {
  id: string;
  name: string;
  unit: string;
  category?: ReceiveItemCategory | null;
}

export interface ReceiveMatchedItemRef {
  id: string;
  name: string;
  unit: string;
}

export interface ReceiveParseCorrectionAction {
  type: string;
  before: string | number | null;
  after: string | number | null;
  confidence: number;
  reason: string;
}

export interface ReceiveReceiptReviewLineItem {
  id: string;
  line_number: number;
  raw_text: string;
  parsed_name: string | null;
  quantity: number | string | null;
  unit: string | null;
  line_cost: number | string | null;
  unit_cost: number | string | null;
  confidence: string;
  parse_confidence_score: number | string | null;
  parse_confidence_band: string | null;
  parse_flags: string[] | null;
  parse_corrections: ReceiveParseCorrectionAction[] | null;
  plu_code?: number | null;
  inventory_decision?:
    | "pending"
    | "add_to_inventory"
    | "expense_only"
    | "resolve_later";
  inventory_decided_at?: string | null;
  status: string;
  matched_item: ReceiveMatchedItemRef | null;
}

export interface ReceiveReceiptReviewData {
  id: string;
  line_items: ReceiveReceiptReviewLineItem[];
}

export interface ReceiveReceiptDetailLineItem {
  id: string;
  line_number: number;
  raw_text: string;
  parsed_name: string | null;
  quantity: number | string | null;
  unit: string | null;
  line_cost: number | string | null;
  unit_cost: number | string | null;
  parse_confidence_score: number | string | null;
  parse_confidence_band: string | null;
  parse_flags: string[] | null;
  parse_corrections: ReceiveParseCorrectionAction[] | null;
  plu_code?: number | null;
  inventory_decision?:
    | "pending"
    | "add_to_inventory"
    | "expense_only"
    | "resolve_later";
  inventory_decided_at?: string | null;
  matched_item: ReceiveMatchedItemRef | null;
}

export interface ReceiveReceiptParsedData {
  establishment?: string;
  date?: string;
  currency?: string;
  paymentMethod?: string;
  [key: string]: unknown;
}

export interface ReceiveReceiptDetail {
  id: string;
  image_path: string | null;
  raw_text: string | null;
  parsed_data: ReceiveReceiptParsedData | null;
  status: string;
  created_at: string;
  supplier: { id: string; name: string } | null;
  shopping_session: { id: string; store_name: string | null } | null;
  line_items: ReceiveReceiptDetailLineItem[];
  signed_image_url: string | null;
}
