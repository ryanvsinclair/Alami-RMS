"use client";

interface LineItem {
  id: string;
  line_number: number;
  raw_text: string;
  parsed_name: string | null;
  quantity: number | string | null;
  unit: string | null;
  line_cost: number | string | null;
  unit_cost: number | string | null;
  matched_item: { id: string; name: string; unit: string } | null;
}

interface ParsedData {
  establishment?: string;
  date?: string;
  currency?: string;
  paymentMethod?: string;
  source?: string;
  [key: string]: unknown;
}

interface DigitalReceiptProps {
  storeName: string | null;
  date: string | null;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency?: string;
  paymentMethod?: string | null;
}

function formatMoney(v: number | string | null | undefined): string {
  const n = Number(v) || 0;
  return n.toFixed(2);
}

export function DigitalReceipt({
  storeName,
  date,
  lineItems,
  subtotal,
  tax,
  total,
  currency,
  paymentMethod,
}: DigitalReceiptProps) {
  return (
    <div className="mx-auto max-w-sm">
      {/* Receipt paper */}
      <div
        className="relative rounded-2xl px-5 py-6 font-mono text-[13px] leading-relaxed"
        style={{
          background: "linear-gradient(180deg, #1a1f2e 0%, #151923 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {/* Store header */}
        <div className="text-center mb-4 pb-3 border-b border-dashed border-white/10">
          <p className="text-sm font-bold text-white tracking-wide uppercase">
            {storeName || "Receipt"}
          </p>
          {date && (
            <p className="text-[11px] text-white/40 mt-1">{date}</p>
          )}
        </div>

        {/* Column headers */}
        <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-wider mb-2 px-0.5">
          <span className="flex-1">Item</span>
          <span className="w-10 text-center">Qty</span>
          <span className="w-16 text-right">Amount</span>
        </div>

        {/* Separator */}
        <div className="border-t border-white/8 mb-2" />

        {/* Line items */}
        <div className="space-y-1.5">
          {lineItems.map((item) => {
            const name = item.matched_item?.name || item.parsed_name || item.raw_text;
            const qty = Number(item.quantity) || 1;
            const cost = Number(item.line_cost) || 0;

            return (
              <div key={item.id} className="flex items-start gap-1">
                <span className="flex-1 text-white/80 break-words leading-tight">
                  {name}
                </span>
                <span className="w-10 text-center text-white/50 shrink-0">
                  {qty}
                </span>
                <span className="w-16 text-right text-white/80 shrink-0 tabular-nums">
                  ${formatMoney(cost)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="mt-4 pt-3 border-t border-dashed border-white/10 space-y-1">
          {subtotal != null && (
            <div className="flex justify-between text-white/50">
              <span>Subtotal</span>
              <span className="tabular-nums">${formatMoney(subtotal)}</span>
            </div>
          )}
          {tax != null && (
            <div className="flex justify-between text-white/50">
              <span>Tax</span>
              <span className="tabular-nums">${formatMoney(tax)}</span>
            </div>
          )}
          {total != null && (
            <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-white/10">
              <span>Total</span>
              <span className="tabular-nums">
                {currency && currency !== "CAD" && currency !== "USD" ? `${currency} ` : "$"}
                {formatMoney(total)}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        {paymentMethod && (
          <div className="mt-3 pt-2 border-t border-dashed border-white/10 text-center">
            <p className="text-[11px] text-white/30 uppercase tracking-wide">
              Paid via {paymentMethod}
            </p>
          </div>
        )}

        {/* Items count */}
        <div className="mt-3 text-center">
          <p className="text-[10px] text-white/20">
            {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Extract display props from a receipt record's parsed_data and raw_text.
 * Call this on the server and pass the result to <DigitalReceipt />.
 */
export function extractReceiptTotals(rawText: string | null, parsedData: ParsedData | null) {
  let subtotal: number | null = null;
  let tax: number | null = null;
  let total: number | null = null;

  // Try to pull from raw text lines (TabScanner format)
  if (rawText) {
    const lines = rawText.split("\n");
    for (const line of lines) {
      const subtotalMatch = line.match(/^Subtotal\s+\$?([\d,.]+)/i);
      const taxMatch = line.match(/^Tax\s+\$?([\d,.]+)/i);
      const totalMatch = line.match(/^Total\s+\$?([\d,.]+)/i);

      if (subtotalMatch) subtotal = parseFloat(subtotalMatch[1].replace(",", ""));
      if (taxMatch) tax = parseFloat(taxMatch[1].replace(",", ""));
      if (totalMatch) total = parseFloat(totalMatch[1].replace(",", ""));
    }
  }

  return {
    storeName: parsedData?.establishment ?? null,
    date: parsedData?.date ?? null,
    currency: (parsedData?.currency as string) ?? null,
    paymentMethod: (parsedData?.paymentMethod as string) ?? null,
    subtotal,
    tax,
    total,
  };
}
