// ============================================================
// Structured product info extraction from OCR text via Gemini
// ============================================================

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface ProductInfo {
  product_name: string;
  brand: string;
  category: string;
  quantity_description: string;
  weight: string;
}

const EXTRACTION_PROMPT = `You are a product label parser for a restaurant inventory system.
Extract: product_name, brand, category, quantity_description, weight.
The source text may be Arabic or multilingual. Return everything in English.
Return ONLY valid JSON with this schema:
{
  "product_name": "2-4 words max",
  "brand": "",
  "category": "one of: Nuts & Seeds, Condiments & Sauces, Oils, Dairy, Proteins, Grains & Staples, Spices & Seasonings, Produce, Beverages, Baking, Canned & Packaged, Snacks, Other",
  "quantity_description": "",
  "weight": ""
}`;

export async function extractProductInfo(
  rawText: string,
  labels: string[] = [],
  logos: string[] = []
): Promise<ProductInfo> {
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GOOGLE_VISION;

  if (geminiKey) {
    try {
      const result = await callGemini(geminiKey, rawText);
      if (result) return result;
    } catch {
      // Fall through to deterministic fallback.
    }
  }

  return labelBasedExtraction(rawText, labels, logos);
}

async function callGemini(apiKey: string, ocrText: string): Promise<ProductInfo | null> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `${EXTRACTION_PROMPT}\n\nOCR Text:\n${ocrText.slice(0, 2500)}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 250,
      },
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  return sanitizeProductInfo({
    product_name: parsed.product_name,
    brand: parsed.brand,
    category: parsed.category,
    quantity_description: parsed.quantity_description,
    weight: parsed.weight,
  });
}

function sanitizeProductInfo(input: Partial<ProductInfo>): ProductInfo {
  return {
    product_name: String(input.product_name || "Unknown Product").slice(0, 80).trim() || "Unknown Product",
    brand: String(input.brand || "").slice(0, 50).trim(),
    category: String(input.category || "Other").slice(0, 40).trim() || "Other",
    quantity_description: String(input.quantity_description || "").slice(0, 40).trim(),
    weight: String(input.weight || "").slice(0, 24).trim(),
  };
}

const LABEL_CATEGORY_MAP: Record<string, string> = {
  nut: "Nuts & Seeds",
  almond: "Nuts & Seeds",
  cashew: "Nuts & Seeds",
  peanut: "Nuts & Seeds",
  pistachio: "Nuts & Seeds",
  seed: "Nuts & Seeds",
  sauce: "Condiments & Sauces",
  condiment: "Condiments & Sauces",
  ketchup: "Condiments & Sauces",
  mustard: "Condiments & Sauces",
  vinegar: "Condiments & Sauces",
  dressing: "Condiments & Sauces",
  oil: "Oils",
  dairy: "Dairy",
  milk: "Dairy",
  cheese: "Dairy",
  butter: "Dairy",
  meat: "Proteins",
  chicken: "Proteins",
  beef: "Proteins",
  fish: "Proteins",
  seafood: "Proteins",
  rice: "Grains & Staples",
  flour: "Grains & Staples",
  pasta: "Grains & Staples",
  spice: "Spices & Seasonings",
  seasoning: "Spices & Seasonings",
  beverage: "Beverages",
  tea: "Beverages",
  coffee: "Beverages",
  juice: "Beverages",
  baking: "Baking",
  chocolate: "Baking",
  canned: "Canned & Packaged",
  snack: "Snacks",
  chips: "Snacks",
  crackers: "Snacks",
};

const NON_PRODUCT_LABELS = new Set([
  "food",
  "ingredient",
  "product",
  "packaging",
  "label",
  "text",
  "font",
  "recipe",
  "cuisine",
  "plant",
  "superfood",
  "tin can",
  "can",
  "container",
  "aluminum",
  "metal",
  "steel",
  "cylinder",
]);

function labelBasedExtraction(rawText: string, labels: string[], logos: string[]): ProductInfo {
  const weightMatch = rawText.match(
    /(?:NET\s*W(?:T|EIGHT)\.?\s*)?(\d+(?:\.\d+)?\s*(?:oz|g|kg|lb|ml|mL|l|L|gal|fl\.?\s*oz|جم|غ|مل|لتر))/i
  );
  const quantityMatch = rawText.match(
    /(\d+)\s*(?:pack|packs|x)\s*(?:of\s*)?(\d+\s*(?:oz|g|kg|lb|ml|l)?)/i
  );

  const brand = detectBrandFromText(rawText, logos);

  let category = "Other";
  for (const label of labels) {
    const lower = label.toLowerCase();
    if (LABEL_CATEGORY_MAP[lower]) {
      category = LABEL_CATEGORY_MAP[lower];
      break;
    }
    for (const [key, mapped] of Object.entries(LABEL_CATEGORY_MAP)) {
      if (lower.includes(key) || key.includes(lower)) {
        category = mapped;
        break;
      }
    }
    if (category !== "Other") break;
  }

  const extractedName = extractProductName(rawText);
  const safeLabel = labels.find((label) => {
    const lower = label.toLowerCase();
    if (NON_PRODUCT_LABELS.has(lower)) return false;
    return !/(tin|can|container|packaging|label|font|metal|aluminum|steel|cylinder)/i.test(
      lower
    );
  });

  const productName =
    extractedName !== "Unknown Product"
      ? extractedName
      : safeLabel
        ? titleCase(safeLabel)
        : "Unknown Product";

  return sanitizeProductInfo({
    product_name: productName,
    brand,
    category,
    quantity_description: quantityMatch ? `${quantityMatch[1]} x ${quantityMatch[2]}` : "",
    weight: weightMatch ? weightMatch[1] : "",
  });
}

function detectBrandFromText(rawText: string, logos: string[]): string {
  if (logos[0]?.trim()) return logos[0].trim();

  if (/(foster\s*clark'?s|fosterclarks)/i.test(rawText) || /فوستر\s*كلاركس/u.test(rawText)) {
    return "Foster Clark's";
  }

  return "";
}

const PRODUCT_WORDS = new Set([
  "almond",
  "almonds",
  "nuts",
  "seeds",
  "tahini",
  "sauce",
  "oil",
  "milk",
  "rice",
  "flour",
  "coffee",
  "tea",
  "sugar",
  "spice",
  "seasoning",
  "custard",
  "powder",
  "chocolate",
  "pasta",
  "honey",
  "juice",
  "water",
  "cheese",
  "butter",
]);

const DESCRIPTOR_WORDS = new Set([
  "raw",
  "roasted",
  "natural",
  "organic",
  "fresh",
  "ground",
  "fine",
  "sweet",
  "classic",
]);

const ARABIC_PRODUCT_MAP: Record<string, string> = {
  "مسحوق الكاسترد": "Custard Powder",
  "بودرة الكاسترد": "Custard Powder",
  كاسترد: "Custard",
  مسحوق: "Powder",
  بودرة: "Powder",
  طحينة: "Tahini",
  "زيت زيتون": "Olive Oil",
  زيت: "Oil",
  أرز: "Rice",
  رز: "Rice",
  سكر: "Sugar",
  ملح: "Salt",
  بهارات: "Spices",
  قهوة: "Coffee",
  شاي: "Tea",
  حليب: "Milk",
  عسل: "Honey",
  "ماء ورد": "Rose Water",
};

const ARABIC_DESCRIPTOR_MAP: Record<string, string> = {
  طبيعي: "Natural",
  عضوي: "Organic",
  طازج: "Fresh",
  مطحون: "Ground",
  ناعم: "Fine",
};

export function extractProductName(rawText: string): string {
  const arabicName = tryArabicExtraction(rawText);
  if (arabicName) return arabicName;

  const text = rawText
    .replace(/[^\u0000-\u007F\u00C0-\u024F]/g, " ")
    .replace(/[.,;:!?()[\]{}"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "Unknown Product";

  const words = text.split(/\s+/);
  let bestScore = -Infinity;
  let best: string[] = [];

  for (let size = 1; size <= Math.min(5, words.length); size++) {
    for (let start = 0; start <= words.length - size; start++) {
      const window = words.slice(start, start + size);
      let score = 0;
      let hasProduct = false;

      for (const word of window) {
        const w = word.toLowerCase().replace(/[^a-z]/g, "");
        if (PRODUCT_WORDS.has(w)) {
          score += 10;
          hasProduct = true;
        } else if (DESCRIPTOR_WORDS.has(w)) {
          score += 4;
        } else if (/^\d+$/.test(word) || w.length <= 1) {
          score -= 5;
        } else {
          score -= 1;
        }
      }

      if (!hasProduct) continue;
      if (size === 2 || size === 3) score += 3;
      score += Math.round((1 - start / words.length) * 2);

      if (score > bestScore) {
        bestScore = score;
        best = window.filter((word) => {
          const w = word.toLowerCase().replace(/[^a-z]/g, "");
          return w.length > 1 && !/^\d+$/.test(word);
        });
      }
    }
  }

  if (best.length === 0) return "Unknown Product";
  return titleCase(best.join(" "));
}

function tryArabicExtraction(rawText: string): string | null {
  if (!/[\u0600-\u06FF]/.test(rawText)) return null;

  const normalized = normalizeArabicForLookup(rawText);
  const phraseEntries = Object.entries(ARABIC_PRODUCT_MAP)
    .filter(([k]) => k.includes(" "))
    .sort((a, b) => b[0].length - a[0].length);

  const products: string[] = [];
  const descriptors: string[] = [];
  let remaining = normalized;

  for (const [phrase, english] of phraseEntries) {
    if (remaining.includes(phrase)) {
      products.push(english);
      remaining = remaining.replace(phrase, " ");
    }
  }

  for (const token of remaining.split(/\s+/)) {
    const cleaned = normalizeArabicForLookup(token).replace(/[^\u0600-\u06FF]/g, "");
    if (!cleaned) continue;
    if (ARABIC_PRODUCT_MAP[cleaned]) {
      products.push(ARABIC_PRODUCT_MAP[cleaned]);
      continue;
    }
    if (ARABIC_DESCRIPTOR_MAP[cleaned]) {
      descriptors.push(ARABIC_DESCRIPTOR_MAP[cleaned]);
    }
  }

  if (products.length === 0) return null;
  const merged = [...new Set([...descriptors, ...products])].slice(0, 4).join(" ");
  return merged.replace(/\bPowder Custard\b/i, "Custard Powder");
}

function normalizeArabicForLookup(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0600-\u06FF0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  if (!value.trim()) return "";
  const small = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with"]);
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (index > 0 && small.has(word) ? word : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}
