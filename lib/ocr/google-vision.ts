// ============================================================
// Google Cloud Vision OCR client
// Uses the REST API directly (no SDK dependency needed)
// ============================================================

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

interface VisionResponse {
  responses: {
    textAnnotations?: {
      description: string;
      locale?: string;
    }[];
    fullTextAnnotation?: {
      text: string;
    };
    error?: {
      code: number;
      message: string;
    };
  }[];
}

export interface OCRResult {
  success: boolean;
  raw_text: string;
  error?: string;
}

/**
 * Extract text from an image using Google Cloud Vision API.
 * Accepts a base64-encoded image (no data URI prefix).
 */
export async function extractTextFromImage(
  base64Image: string
): Promise<OCRResult> {
  const apiKey = process.env.GOOGLE_VISION;

  if (!apiKey) {
    return { success: false, raw_text: "", error: "GOOGLE_VISION API key not configured" };
  }

  // Strip data URI prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: cleanBase64 },
            features: [
              { type: "TEXT_DETECTION", maxResults: 1 },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        raw_text: "",
        error: `Vision API error (${response.status}): ${errorBody}`,
      };
    }

    const data: VisionResponse = await response.json();
    const result = data.responses[0];

    if (result.error) {
      return {
        success: false,
        raw_text: "",
        error: `Vision API: ${result.error.message}`,
      };
    }

    // fullTextAnnotation.text has the complete OCR output with line breaks preserved
    const rawText =
      result.fullTextAnnotation?.text ??
      result.textAnnotations?.[0]?.description ??
      "";

    return {
      success: true,
      raw_text: rawText.trim(),
    };
  } catch (err) {
    return {
      success: false,
      raw_text: "",
      error: `OCR request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * Extract text from an image URL (fetches the image, converts to base64, then OCRs).
 */
export async function extractTextFromUrl(imageUrl: string): Promise<OCRResult> {
  const apiKey = process.env.GOOGLE_VISION;

  if (!apiKey) {
    return { success: false, raw_text: "", error: "GOOGLE_VISION API key not configured" };
  }

  try {
    const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [
              { type: "TEXT_DETECTION", maxResults: 1 },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        raw_text: "",
        error: `Vision API error (${response.status}): ${errorBody}`,
      };
    }

    const data: VisionResponse = await response.json();
    const result = data.responses[0];

    if (result.error) {
      return {
        success: false,
        raw_text: "",
        error: `Vision API: ${result.error.message}`,
      };
    }

    const rawText =
      result.fullTextAnnotation?.text ??
      result.textAnnotations?.[0]?.description ??
      "";

    return { success: true, raw_text: rawText.trim() };
  } catch (err) {
    return {
      success: false,
      raw_text: "",
      error: `OCR request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
