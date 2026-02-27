/**
 * seed-produce-items.mjs
 *
 * Reads public/produce_items_clean.csv and bulk-inserts into the
 * produce_items table in Supabase via direct pg.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-produce-items.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CSV_PATH = resolve(ROOT, "public/produce_items_clean.csv");

const BATCH_SIZE = 500;

// ─── CSV parser ──────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Read CSV
    const raw = readFileSync(CSV_PATH, "utf-8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const header = parseCSVLine(lines[0]);

    console.log(`Read ${lines.length - 1} data rows from CSV`);
    console.log(`Columns: ${header.join(" | ")}`);

    // Build column index map
    const colIdx = {};
    for (let i = 0; i < header.length; i++) {
      colIdx[header[i].trim()] = i;
    }

    // Parse all rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i]);
      rows.push([
        parseInt(fields[colIdx.plu_code], 10),        // plu_code
        fields[colIdx.language_code] || "",             // language_code
        fields[colIdx.category] || "",                  // category
        fields[colIdx.commodity] || "",                 // commodity
        fields[colIdx.variety] || null,                 // variety
        fields[colIdx.size_label] || null,              // size_label
        fields[colIdx.scientific_name] || null,         // scientific_name
        fields[colIdx.display_name] || "",              // display_name
      ]);
    }

    // Clear existing data
    const delResult = await client.query("DELETE FROM produce_items");
    console.log(`Cleared ${delResult.rowCount} existing rows`);

    // Insert in batches using parameterized multi-row INSERT
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const row of batch) {
        const placeholders = [];
        for (const val of row) {
          placeholders.push(`$${paramIdx}`);
          params.push(val);
          paramIdx++;
        }
        values.push(`(${placeholders.join(",")})`);
      }

      const sql = `
        INSERT INTO produce_items (plu_code, language_code, category, commodity, variety, size_label, scientific_name, display_name)
        VALUES ${values.join(",")}
        ON CONFLICT (plu_code, language_code) DO NOTHING
      `;

      const result = await client.query(sql, params);
      inserted += result.rowCount;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${result.rowCount} rows (total: ${inserted})`);
    }

    console.log(`\nDone. ${inserted} rows inserted into produce_items.`);

    // Verification
    const totalResult = await client.query("SELECT count(*) FROM produce_items");
    const total = parseInt(totalResult.rows[0].count, 10);

    const langResult = await client.query(
      "SELECT language_code, count(*) as cnt FROM produce_items GROUP BY language_code ORDER BY language_code"
    );

    console.log("\n── Verification ──");
    console.log(`  Total rows in DB: ${total}`);
    for (const row of langResult.rows) {
      console.log(`  ${row.language_code}: ${row.cnt}`);
    }

    const pluResult = await client.query("SELECT count(DISTINCT plu_code) as cnt FROM produce_items");
    console.log(`  Unique PLUs: ${pluResult.rows[0].cnt}`);

    if (total !== rows.length) {
      console.warn(`  WARNING: Expected ${rows.length} but got ${total}`);
    } else {
      console.log("  All rows verified.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
