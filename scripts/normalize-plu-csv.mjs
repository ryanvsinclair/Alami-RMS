/**
 * normalize-plu-csv.mjs
 *
 * Processes public/fruitsandvegetables.csv → public/produce_items_clean.csv
 * Pure local transformation — no DB, no SQL, no network.
 * Does NOT modify the original file.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const INPUT = resolve(ROOT, "public/fruitsandvegetables.csv");
const OUTPUT = resolve(ROOT, "public/produce_items_clean.csv");

// ─── CSV parser (handles quoted fields) ──────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Trim + collapse internal whitespace */
function cleanStr(s) {
  if (!s) return "";
  return s.trim().replace(/\s{2,}/g, " ");
}

/** Title Case: first letter of each word uppercase, rest lowercase */
function titleCase(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (m) => m.toUpperCase());
}

/** Escape a CSV field if needed */
function csvField(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Map "SP" → "ES" for standard ISO 639-1
const LANG_MAP = { EN: "EN", FR: "FR", SP: "ES" };
const ACCEPTED_LANGS = new Set(["EN", "FR", "SP"]);

// ─── Main ────────────────────────────────────────────────────────────────────

const raw = readFileSync(INPUT, "utf-8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim());

if (lines.length < 2) {
  console.error("ERROR: CSV file has no data rows.");
  process.exit(1);
}

const header = parseCSVLine(lines[0]);
console.log("Header columns:", header.length);
console.log("Columns:", header.map((h) => h.trim()).join(" | "));

// Resolve column indices
const COL = {};
const EXPECTED = [
  "id", "Plu", "Type", "Category", "Commodity", "Variety", "Size",
  "Measures_na", "Measures_row", "Restrictions", "Botanical", "Aka",
  "Status", "Link", "Notes", "Updated_by", "Updated_at", "Created_at",
  "Deleted_at", "Language",
];
for (const name of EXPECTED) {
  const idx = header.findIndex((h) => h.trim() === name);
  if (idx === -1) {
    console.error(`ERROR: Missing expected column "${name}".`);
    process.exit(1);
  }
  COL[name] = idx;
}

// ─── Step 2+3: Parse, filter, validate ───────────────────────────────────────

const totalRaw = lines.length - 1;
let filteredOutStatus = 0;
let filteredOutDeleted = 0;
let filteredOutLang = 0;
let filteredOutPlu = 0;
let duplicatesRemoved = 0;

// Keyed by "plu|lang" → { row, updatedAt }
const deduped = new Map();

for (let i = 1; i < lines.length; i++) {
  const fields = parseCSVLine(lines[i]);

  const status = cleanStr(fields[COL.Status]);
  const deletedAt = cleanStr(fields[COL.Deleted_at]);
  const language = cleanStr(fields[COL.Language]).toUpperCase();
  const pluRaw = cleanStr(fields[COL.Plu]);

  // Step 2: Filter
  if (status !== "Approved") { filteredOutStatus++; continue; }
  if (deletedAt !== "") { filteredOutDeleted++; continue; }
  if (!ACCEPTED_LANGS.has(language)) { filteredOutLang++; continue; }

  // Step 3: Validate PLU is numeric
  if (!/^\d+$/.test(pluRaw)) { filteredOutPlu++; continue; }

  const plu = parseInt(pluRaw, 10);
  const updatedAt = cleanStr(fields[COL.Updated_at]);

  const key = `${plu}|${LANG_MAP[language]}`;
  const existing = deduped.get(key);

  if (existing) {
    // Keep most recently updated
    if (updatedAt > existing.updatedAt) {
      deduped.set(key, { fields, updatedAt, plu, language });
      duplicatesRemoved++;
    } else {
      duplicatesRemoved++;
    }
  } else {
    deduped.set(key, { fields, updatedAt, plu, language });
  }
}

// ─── Steps 4-6: Normalize + derive columns ──────────────────────────────────

const outputRows = [];

for (const [, { fields, plu, language }] of deduped) {
  const category = titleCase(cleanStr(fields[COL.Category]));
  const commodity = titleCase(cleanStr(fields[COL.Commodity]));
  const variety = titleCase(cleanStr(fields[COL.Variety]));
  const sizeLabel = cleanStr(fields[COL.Size]);
  const botanical = cleanStr(fields[COL.Botanical]); // preserve original case
  const langCode = LANG_MAP[language];

  // Display name
  let displayName;
  if (variety) {
    displayName = `${variety} ${commodity}`;
  } else {
    displayName = commodity;
  }

  outputRows.push({
    plu_code: plu,
    language_code: langCode,
    category,
    commodity,
    variety,
    size_label: sizeLabel,
    scientific_name: botanical,
    display_name: displayName,
  });
}

// Sort for deterministic output: by plu_code, then language_code
outputRows.sort((a, b) => {
  if (a.plu_code !== b.plu_code) return a.plu_code - b.plu_code;
  return a.language_code.localeCompare(b.language_code);
});

// ─── Step 7: Write CSV ──────────────────────────────────────────────────────

const CSV_HEADER = "plu_code,language_code,category,commodity,variety,size_label,scientific_name,display_name";

const csvLines = [CSV_HEADER];
for (const row of outputRows) {
  csvLines.push([
    row.plu_code,
    csvField(row.language_code),
    csvField(row.category),
    csvField(row.commodity),
    csvField(row.variety),
    csvField(row.size_label),
    csvField(row.scientific_name),
    csvField(row.display_name),
  ].join(","));
}

writeFileSync(OUTPUT, csvLines.join("\n") + "\n", "utf-8");

// ─── Step 8: Validation summary ─────────────────────────────────────────────

const uniquePlus = new Set(outputRows.map((r) => r.plu_code));
const enCount = outputRows.filter((r) => r.language_code === "EN").length;
const frCount = outputRows.filter((r) => r.language_code === "FR").length;
const esCount = outputRows.filter((r) => r.language_code === "ES").length;
const totalFiltered = filteredOutStatus + filteredOutDeleted + filteredOutLang + filteredOutPlu + duplicatesRemoved;

console.log("\n══════════════════════════════════════════════════════");
console.log("  VALIDATION SUMMARY");
console.log("══════════════════════════════════════════════════════");
console.log(`  Total raw rows read:          ${totalRaw}`);
console.log(`  Rows filtered out:            ${totalFiltered}`);
console.log(`    - Non-Approved status:       ${filteredOutStatus}`);
console.log(`    - Non-empty Deleted_at:      ${filteredOutDeleted}`);
console.log(`    - Language not EN/FR/SP:      ${filteredOutLang}`);
console.log(`    - Invalid (non-numeric) PLU: ${filteredOutPlu}`);
console.log(`    - Duplicate PLU-lang removed: ${duplicatesRemoved}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  Final row count:              ${outputRows.length}`);
console.log(`  Unique PLU count:             ${uniquePlus.size}`);
console.log(`  EN rows:                      ${enCount}`);
console.log(`  FR rows:                      ${frCount}`);
console.log(`  ES rows:                      ${esCount}`);
console.log("══════════════════════════════════════════════════════");
console.log(`\n  Output: ${OUTPUT}`);
