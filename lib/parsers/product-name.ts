// ============================================================
// Product name extraction from raw OCR text
// Strips label noise and extracts a clean, short product name
// ============================================================

// ── Dictionary of common food / product words for segmentation ──
const DICTIONARY = new Set([
  // Condiments & sauces
  "honey", "sriracha", "sauce", "hot", "chili", "garlic", "soy", "teriyaki",
  "bbq", "barbecue", "ranch", "buffalo", "sweet", "spicy", "mild", "original",
  "classic", "ketchup", "mustard", "mayo", "mayonnaise", "salsa", "vinegar",
  "dressing", "marinade", "glaze", "relish", "pesto", "gravy", "aioli",
  "chimichurri", "tahini", "hummus", "guacamole", "wasabi", "ponzu", "hoisin",
  "oyster", "fish", "worcestershire", "tabasco", "franks", "cholula",
  // Dairy & fats
  "butter", "cream", "cheese", "milk", "yogurt", "sour", "whipped",
  "cheddar", "mozzarella", "parmesan", "provolone", "swiss", "brie",
  "gouda", "feta", "ricotta", "cottage", "jack", "colby", "american",
  // Oils
  "oil", "olive", "canola", "vegetable", "coconut", "sesame", "avocado",
  "peanut", "sunflower", "corn", "palm", "truffle",
  // Proteins
  "chicken", "beef", "pork", "lamb", "turkey", "duck", "salmon", "tuna",
  "shrimp", "crab", "lobster", "fish", "steak", "ground", "breast",
  "thigh", "wing", "rib", "loin", "tenderloin", "fillet", "boneless",
  "skinless", "smoked", "grilled", "roasted", "fried", "baked",
  // Grains & staples
  "flour", "rice", "noodle", "noodles", "pasta", "bread", "tortilla",
  "wrap", "pita", "bagel", "roll", "bun", "croissant", "cracker",
  "crackers", "chip", "chips", "cereal", "oat", "oats", "granola",
  "quinoa", "barley", "couscous", "wheat", "rye", "sourdough",
  // Baking
  "sugar", "salt", "pepper", "flour", "baking", "powder", "soda",
  "yeast", "vanilla", "extract", "cinnamon", "nutmeg", "cocoa",
  "chocolate", "syrup", "molasses", "corn", "starch",
  // Spices & seasonings
  "spice", "seasoning", "paste", "mix", "cumin", "paprika", "turmeric",
  "oregano", "basil", "thyme", "rosemary", "sage", "dill", "parsley",
  "cilantro", "chive", "bay", "leaf", "cayenne", "black", "white",
  "red", "green", "yellow", "crushed", "flakes", "whole", "ground",
  // Produce
  "tomato", "tomatoes", "onion", "onions", "potato", "potatoes",
  "lettuce", "spinach", "kale", "carrot", "carrots", "celery",
  "cucumber", "pepper", "peppers", "jalapeno", "habanero", "bell",
  "mushroom", "mushrooms", "broccoli", "cauliflower", "cabbage",
  "corn", "bean", "beans", "pea", "peas", "lentil", "lentils",
  "avocado", "lime", "lemon", "orange", "apple", "banana", "berry",
  "mango", "pineapple", "coconut", "ginger", "garlic", "shallot",
  // Beverages
  "juice", "water", "tea", "coffee", "soda", "lemonade", "smoothie",
  // Canned / packaged
  "soup", "broth", "stock", "stew", "chowder", "bisque",
  "jam", "jelly", "preserve", "preserves", "marmalade",
  "can", "canned", "dried", "frozen", "fresh", "organic",
  // Descriptors
  "extra", "virgin", "light", "dark", "thick", "thin", "chunky",
  "smooth", "creamy", "crispy", "crunchy", "roasted", "toasted",
  "seasoned", "flavored", "infused", "premium", "natural", "style",
  // Common product qualifiers
  "large", "small", "medium", "mini", "jumbo", "family", "size",
  "pack", "value",
]);

// ── Noise patterns to remove (work with and without spaces) ──
const NOISE_PATTERNS = [
  // Weight / volume with optional missing spaces
  /NET\s*W(?:T|EIGHT)\.?\s*[\d.]+\s*(?:oz|g|kg|lb|ml|l|fl\.?\s*oz)\b[^a-z]*/gi,
  /\b\d+\s*(?:oz|g|kg|lb|ml|l|gal|fl\.?\s*oz)\b\s*\([\d\w\s]+\)/gi,
  /\b\d+\s*(?:oz|g|kg|lb|ml|l|gal|fl\.?\s*oz)\b/gi,
  /\(\s*\d+\s*(?:lb|oz|g|kg)\s*\d*\s*(?:oz|g)?\s*\)/gi,

  // Label boilerplate (with optional missing spaces)
  /SERVING\s*SUGGEST(?:ION|IONS?)/gi,
  /NUTRITION(?:AL)?\s*FACTS?/gi,
  /INGREDIENTS?\s*:?/gi,
  /BEST\s*(?:BY|BEFORE|IF\s*USED\s*BY)/gi,
  /USE\s*BY/gi,
  /SELL\s*BY/gi,
  /MFG\s*(?:DATE|BY)/gi,
  /EXP(?:IRY|IRES?)?\s*(?:DATE)?/gi,
  /DIST(?:RIBUTED)?\s*BY/gi,
  /MANUFACTURED\s*BY/gi,
  /PRODUCT\s*OF\s+\w+/gi,
  /MADE\s*IN\s+\w+/gi,
  /KEEP\s*REFRIGERATED/gi,
  /SHAKE\s*WELL/gi,
  /STORE\s*IN\s*A?\s*COOL/gi,
  /GLUTEN\s*FREE/gi,
  /NON?\s*-?\s*GMO/gi,
  /KOSHER/gi,
  /HALAL/gi,
  /ALL\s*NATURAL/gi,
  /NO\s*(?:ARTIFICIAL|ADDED|PRESERV)/gi,
  /CONTAINS?\s*:?/gi,

  // Barcodes / codes
  /\b\d{8,13}\b/g,
  /UPC\s*[\d-]+/gi,
  /SKU\s*[\d-]+/gi,
  /LOT\s*#?\s*[\w-]+/gi,

  // URLs and contact
  /(?:www\.|http)[^\s]+/gi,
  /\S+@\S+\.\S+/gi,
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
];

// Brand names to strip (added as full words or prefixes)
const BRAND_NAMES = [
  "LEE KUM KEE", "HEINZ", "KRAFT", "KIKKOMAN", "TABASCO", "FRANKS",
  "HERSHEY", "HERSHEYS", "NESTLE", "CAMPBELLS", "HUNTS", "DELMONTE",
  "DEL MONTE", "BARILLA", "RAGU", "PREGO", "CLASSICO", "BERTOLLI",
  "KIKUYA", "MAGGI", "KNORR", "MCCORMICK", "OLD BAY", "LAWRYS",
  "HIDDEN VALLEY", "BEST FOODS", "HELLMANNS", "SMUCKER", "SMUCKERS",
  "JIF", "SKIPPY", "PETER PAN", "PACE", "TOSTITOS", "LAYS", "DORITOS",
  "PRINGLES", "FRITO LAY", "GENERAL MILLS", "KELLOGG", "KELLOGGS",
  "POST", "QUAKER", "PILLSBURY", "BETTY CROCKER", "DUNCAN HINES",
];

// Location words
const LOCATION_WORDS = /\b(HONG\s*KONG|USA|CHINA|THAILAND|JAPAN|CANADA|MEXICO|ITALY|FRANCE|TAIWAN|KOREA|INDIA|VIETNAM|PHILIPPINES)\b/gi;

// Non-latin character ranges
const NON_LATIN_PATTERN = /[^\u0000-\u007F\u00C0-\u024F]/g;

/**
 * Attempt to segment a concatenated string into dictionary words.
 * Uses greedy longest-match from left to right.
 *
 * "HONEYSRIRACHASAUCE" → "HONEY SRIRACHA SAUCE"
 */
function segmentWords(text: string): string {
  const lower = text.toLowerCase();
  const result: string[] = [];
  let i = 0;

  while (i < lower.length) {
    let bestLen = 0;
    let bestWord = "";

    // Try longest match first (max word length ~15 chars)
    const maxLen = Math.min(15, lower.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const candidate = lower.slice(i, i + len);
      if (DICTIONARY.has(candidate)) {
        bestLen = len;
        bestWord = candidate;
        break;
      }
    }

    if (bestLen > 0) {
      result.push(bestWord.toUpperCase());
      i += bestLen;
    } else {
      // No dictionary match — consume one character
      // Accumulate non-matched chars into a buffer
      let buf = lower[i];
      i++;
      while (i < lower.length) {
        // Peek ahead to see if a dictionary word starts here
        let found = false;
        const peekMax = Math.min(15, lower.length - i);
        for (let len = peekMax; len >= 2; len--) {
          if (DICTIONARY.has(lower.slice(i, i + len))) {
            found = true;
            break;
          }
        }
        if (found) break;
        buf += lower[i];
        i++;
      }
      result.push(buf.toUpperCase());
    }
  }

  return result.join(" ");
}

/**
 * Extract a clean, short product name from raw OCR text.
 *
 * Strategy:
 * 1. Strip non-latin characters
 * 2. Remove brand names
 * 3. Remove label noise (weights, boilerplate, barcodes)
 * 4. Segment concatenated words using dictionary lookup
 * 5. Score segments and pick the best product name
 * 6. Title-case it
 */
export function extractProductName(rawText: string): string {
  let text = rawText;

  // Step 1: Remove non-latin characters
  text = text.replace(NON_LATIN_PATTERN, " ");

  // Step 2: Remove brand names (case-insensitive)
  for (const brand of BRAND_NAMES) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}(?:'?S?)?\\b`, "gi"), " ");
  }

  // Step 3: Remove location words
  text = text.replace(LOCATION_WORDS, " ");

  // Step 4: Remove noise patterns
  for (const pattern of NOISE_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    text = text.replace(pattern, " ");
  }

  // Step 5: Remove remaining standalone numbers and short noise
  text = text
    .replace(/[^\w\s&'-]/g, " ")
    .replace(/\b\d+\b/g, " ")       // remove standalone numbers
    .replace(/\b\w\b/g, " ")         // remove single characters
    .replace(/\s+/g, " ")
    .trim();

  // Step 6: Segment any long concatenated tokens
  const tokens = text.split(/\s+/);
  const segmented = tokens.map((token) => {
    // If a token is long and all-alpha, try to segment it
    if (token.length > 10 && /^[a-zA-Z]+$/.test(token)) {
      const result = segmentWords(token);
      // Only use segmented version if it produced multiple words
      if (result.includes(" ")) return result;
    }
    return token;
  });
  text = segmented.join(" ").replace(/\s+/g, " ").trim();

  // Step 7: Split into segments and score them
  const segments = text
    .split(/\s{2,}|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (segments.length === 0) return titleCase(text.slice(0, 60));

  const PRODUCT_WORDS = /\b(sauce|oil|vinegar|spice|seasoning|paste|powder|mix|butter|cream|cheese|milk|juice|water|tea|coffee|sugar|salt|pepper|flour|rice|noodle|noodles|bread|chip|chips|cracker|crackers|cookie|cookies|cereal|soup|broth|stock|dressing|mayo|mustard|ketchup|salsa|jam|jelly|honey|syrup|sriracha|hot|chili|garlic|onion|ginger|soy|teriyaki|bbq|barbecue|ranch|buffalo|sweet|spicy|mild|original|classic|chicken|beef|pork|lamb|salmon|tuna|shrimp|tomato|mushroom|olive|sesame|coconut|peanut|bean|beans|lemon|lime|mango|avocado)\b/gi;

  const BRAND_INDICATORS = /\b(brand|inc|corp|co|ltd|llc|tm|registered|\u00ae|\u2122)\b/gi;

  const scored = segments.map((seg) => {
    let score = 0;
    const productMatches = seg.match(PRODUCT_WORDS);
    score += (productMatches?.length ?? 0) * 3;
    const wordCount = seg.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 5) score += 2;
    if (wordCount === 1) score -= 1;
    if (wordCount > 8) score -= 2;
    if (BRAND_INDICATORS.test(seg)) score -= 3;
    if (seg === seg.toUpperCase() && wordCount === 1) score -= 1;

    return { segment: seg, score };
  });

  scored.sort((a, b) => b.score - a.score);
  let name = scored[0].segment;

  // Step 8: Clean up
  name = name.replace(/\s+/g, " ").trim();

  // Limit to ~5 words max
  const words = name.split(/\s+/);
  if (words.length > 5) {
    name = words.slice(0, 5).join(" ");
  }

  return titleCase(name) || titleCase(text.split(/\s+/).slice(0, 4).join(" "));
}

function titleCase(str: string): string {
  const SMALL_WORDS = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with"]);
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
