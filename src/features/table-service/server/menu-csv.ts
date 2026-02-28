export interface ParsedMenuCsvRow {
  lineNumber: number;
  name: string;
  categoryName: string | null;
  description: string | null;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface MenuCsvParseResult {
  rows: ParsedMenuCsvRow[];
  errors: string[];
}

function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        currentValue += "\"";
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      currentRow.push(currentValue.trim());
      currentValue = "";
      const hasNonEmpty = currentRow.some((entry) => entry.length > 0);
      if (hasNonEmpty) rows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue.trim());
  if (currentRow.some((entry) => entry.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function canonicalHeader(header: string): string {
  const normalized = header.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["name", "item", "item_name", "menu_item"].includes(normalized)) return "name";
  if (["category", "menu_category"].includes(normalized)) return "category";
  if (["description", "desc", "notes"].includes(normalized)) return "description";
  if (["price", "unit_price", "amount"].includes(normalized)) return "price";
  if (["is_available", "available", "active", "enabled"].includes(normalized)) return "is_available";
  if (["sort_order", "sort", "position", "display_order"].includes(normalized)) return "sort_order";
  return normalized;
}

function parseBoolean(value: string | null): boolean | null {
  if (value == null || value.trim().length === 0) return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  return null;
}

export function parseMenuCsv(csvText: string): MenuCsvParseResult {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length === 0) {
    return { rows: [], errors: ["CSV is empty"] };
  }

  const headers = matrix[0].map(canonicalHeader);
  const errors: string[] = [];
  const rows: ParsedMenuCsvRow[] = [];

  const nameIndex = headers.indexOf("name");
  const priceIndex = headers.indexOf("price");
  if (nameIndex < 0 || priceIndex < 0) {
    return {
      rows: [],
      errors: ["CSV requires at least 'name' and 'price' headers"],
    };
  }

  const categoryIndex = headers.indexOf("category");
  const descriptionIndex = headers.indexOf("description");
  const availabilityIndex = headers.indexOf("is_available");
  const sortOrderIndex = headers.indexOf("sort_order");

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    const lineNumber = rowIndex + 1;

    const name = (row[nameIndex] ?? "").trim();
    if (!name) {
      errors.push(`Line ${lineNumber}: missing item name`);
      continue;
    }

    const rawPrice = (row[priceIndex] ?? "").trim();
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Line ${lineNumber}: invalid price '${rawPrice}'`);
      continue;
    }

    const rawAvailability =
      availabilityIndex >= 0 ? (row[availabilityIndex] ?? "").trim() : "";
    const parsedAvailability = parseBoolean(rawAvailability);
    if (rawAvailability.length > 0 && parsedAvailability == null) {
      errors.push(`Line ${lineNumber}: invalid availability '${rawAvailability}'`);
      continue;
    }

    const rawSortOrder = sortOrderIndex >= 0 ? (row[sortOrderIndex] ?? "").trim() : "";
    let sortOrder = 0;
    if (rawSortOrder.length > 0) {
      const parsedSort = Number(rawSortOrder);
      if (!Number.isInteger(parsedSort) || parsedSort < 0) {
        errors.push(`Line ${lineNumber}: invalid sort_order '${rawSortOrder}'`);
        continue;
      }
      sortOrder = parsedSort;
    }

    const categoryName =
      categoryIndex >= 0 ? (row[categoryIndex] ?? "").trim() || null : null;
    const description =
      descriptionIndex >= 0 ? (row[descriptionIndex] ?? "").trim() || null : null;

    rows.push({
      lineNumber,
      name,
      categoryName,
      description,
      price,
      isAvailable: parsedAvailability ?? true,
      sortOrder,
    });
  }

  return { rows, errors };
}
