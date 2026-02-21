// ============================================================
// Google Cloud Vision OCR + Label/Logo detection
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
    labelAnnotations?: {
      description: string;
      score: number;
    }[];
    logoAnnotations?: {
      description: string;
      score: number;
    }[];
    error?: {
      code: number;
      message: string;
    };
  }[];
}

export interface OCRResult {
  success: boolean;
  raw_text: string;
  labels: string[];
  logos: string[];
  error?: string;
}

/**
 * Extract text, labels, and logos from an image using Google Cloud Vision API.
 */
export async function extractTextFromImage(
  base64Image: string
): Promise<OCRResult> {
  const apiKey = process.env.GOOGLE_VISION;

  if (!apiKey) {
    return { success: false, raw_text: "", labels: [], logos: [], error: "GOOGLE_VISION API key not configured" };
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
              { type: "LABEL_DETECTION", maxResults: 10 },
              { type: "LOGO_DETECTION", maxResults: 3 },
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
        labels: [],
        logos: [],
        error: `Vision API error (${response.status}): ${errorBody}`,
      };
    }

    const data: VisionResponse = await response.json();
    const result = data.responses[0];

    if (result.error) {
      return {
        success: false,
        raw_text: "",
        labels: [],
        logos: [],
        error: `Vision API: ${result.error.message}`,
      };
    }

    const rawText =
      result.fullTextAnnotation?.text ??
      result.textAnnotations?.[0]?.description ??
      "";

    // Extract label descriptions (e.g., "Food", "Nut", "Almond")
    const labels = (result.labelAnnotations ?? [])
      .filter((l) => l.score > 0.5)
      .map((l) => l.description);

    // Extract logo descriptions (e.g., "Yupik", "Heinz")
    const logos = (result.logoAnnotations ?? [])
      .filter((l) => l.score > 0.3)
      .map((l) => l.description);

    return {
      success: true,
      raw_text: rawText.trim(),
      labels,
      logos,
    };
  } catch (err) {
    return {
      success: false,
      raw_text: "",
      labels: [],
      logos: [],
      error: `OCR request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * Extract text from an image URL.
 */
export async function extractTextFromUrl(imageUrl: string): Promise<OCRResult> {
  const apiKey = process.env.GOOGLE_VISION;

  if (!apiKey) {
    return { success: false, raw_text: "", labels: [], logos: [], error: "GOOGLE_VISION API key not configured" };
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
              { type: "LABEL_DETECTION", maxResults: 10 },
              { type: "LOGO_DETECTION", maxResults: 3 },
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
        labels: [],
        logos: [],
        error: `Vision API error (${response.status}): ${errorBody}`,
      };
    }

    const data: VisionResponse = await response.json();
    const result = data.responses[0];

    if (result.error) {
      return {
        success: false,
        raw_text: "",
        labels: [],
        logos: [],
        error: `Vision API: ${result.error.message}`,
      };
    }

    const rawText =
      result.fullTextAnnotation?.text ??
      result.textAnnotations?.[0]?.description ??
      "";

    const labels = (result.labelAnnotations ?? [])
      .filter((l) => l.score > 0.5)
      .map((l) => l.description);

    const logos = (result.logoAnnotations ?? [])
      .filter((l) => l.score > 0.3)
      .map((l) => l.description);

    return { success: true, raw_text: rawText.trim(), labels, logos };
  } catch (err) {
    return {
      success: false,
      raw_text: "",
      labels: [],
      logos: [],
      error: `OCR request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
