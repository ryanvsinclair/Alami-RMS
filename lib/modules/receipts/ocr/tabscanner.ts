// ============================================================
// TabScanner Receipt OCR API Client
// Asynchronous cloud OCR service specialized for receipts.
// Upload image → get token → poll for structured result.
// ============================================================

const TABSCANNER_API_URL = "https://api.tabscanner.com";

export interface TabScannerLineItem {
  desc: string;
  descClean: string;
  qty: number;
  price: number;
  lineTotal: number;
  unit?: string;
  productCode?: string;
}

export interface TabScannerResult {
  establishment: string | null;
  date: string | null;
  total: number | null;
  subTotal: number | null;
  tax: number | null;
  lineItems: TabScannerLineItem[];
  currency: string | null;
  address: string | null;
  paymentMethod: string | null;
}

export interface TabScannerResponse {
  success: boolean;
  result: TabScannerResult | null;
  error?: string;
}

/**
 * Upload a receipt image to TabScanner and poll for structured result.
 * Returns parsed receipt data including line items, totals, and merchant info.
 */
export async function scanReceipt(
  base64Image: string
): Promise<TabScannerResponse> {
  const apiKey = process.env.TABSCANNER_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      result: null,
      error: "TABSCANNER_API_KEY not configured",
    };
  }

  // Strip data URI prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  // Determine image type from data URI or default to jpeg
  const mimeMatch = base64Image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const ext = mimeType.split("/")[1] || "jpg";

  try {
    // Step 1: Upload image to TabScanner
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buffer], { type: mimeType }),
      `receipt.${ext}`
    );

    const uploadResponse = await fetch(
      `${TABSCANNER_API_URL}/api/2/process`,
      {
        method: "POST",
        headers: { apikey: apiKey },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text();
      return {
        success: false,
        result: null,
        error: `TabScanner upload failed (${uploadResponse.status}): ${body}`,
      };
    }

    const uploadData = await uploadResponse.json();

    if (!uploadData.token) {
      return {
        success: false,
        result: null,
        error: "No processing token received from TabScanner",
      };
    }

    // Step 2: Poll for result
    const token: string = uploadData.token;
    const maxAttempts = 15;
    let attempt = 0;

    // Wait 3 seconds before first poll (per TabScanner recommendation)
    await delay(3000);

    while (attempt < maxAttempts) {
      attempt++;

      const resultResponse = await fetch(
        `${TABSCANNER_API_URL}/api/result/${token}`,
        { headers: { apikey: apiKey } }
      );

      const resultData = await resultResponse.json();

      if (resultData.status === "done" && resultData.result) {
        return {
          success: true,
          result: normalizeResult(resultData.result),
        };
      }

      if (
        resultData.status === "error" ||
        resultData.status_code >= 500
      ) {
        return {
          success: false,
          result: null,
          error: "TabScanner failed to process the receipt image",
        };
      }

      // Wait 2 seconds between polls
      await delay(2000);
    }

    return {
      success: false,
      result: null,
      error: "TabScanner processing timed out after polling",
    };
  } catch (err) {
    return {
      success: false,
      result: null,
      error: `TabScanner request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

function normalizeResult(raw: Record<string, unknown>): TabScannerResult {
  const lineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems.map(
        (item: Record<string, unknown>): TabScannerLineItem => ({
          desc: String(item.desc ?? ""),
          descClean: String(item.descClean ?? item.desc ?? ""),
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
          lineTotal: Number(item.lineTotal) || 0,
          unit: item.unit ? String(item.unit) : undefined,
          productCode: item.productCode
            ? String(item.productCode)
            : undefined,
        })
      )
    : [];

  return {
    establishment: raw.establishment ? String(raw.establishment) : null,
    date: raw.date ? String(raw.date) : null,
    total: raw.total != null ? Number(raw.total) : null,
    subTotal: raw.subTotal != null ? Number(raw.subTotal) : null,
    tax: raw.tax != null ? Number(raw.tax) : null,
    lineItems,
    currency: raw.currency ? String(raw.currency) : null,
    address: raw.address ? String(raw.address) : null,
    paymentMethod: raw.paymentMethod ? String(raw.paymentMethod) : null,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
