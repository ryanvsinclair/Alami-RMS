// ============================================================
// Prisma → Client serialization utility
// ============================================================
//
// Prisma returns `Decimal` instances for columns defined as
// `Decimal @db.Decimal(...)`. These are NOT plain JS numbers —
// they are objects from the decimal.js library.
//
// Next.js App Router forbids passing non-serializable objects
// across the Server Component → Client Component boundary.
// This module converts Prisma results into plain JSON-safe
// objects before they cross that boundary.
//
// **Why `number`, not `string`, for money?**
//
// Our schema uses `Decimal(10, 2)` — max 99,999,999.99.
// JavaScript `number` (IEEE 754 double) has 53 bits of integer
// precision, handling exact cent values up to ~$90 trillion.
// For a restaurant inventory system, `number` is safe and
// avoids the ergonomic cost of stringified money on every
// client component. The database remains the source of truth
// for arbitrary-precision arithmetic.
//
// Lat/lng use `Decimal(10, 7)` — also well within `number`
// precision (7 decimal places ≈ 1 cm accuracy).
//
// ============================================================

/**
 * Recursively convert a Prisma result into a plain,
 * JSON-serializable object. Decimal → number, Date → ISO string,
 * arrays and nested objects are walked recursively.
 *
 * Usage:
 *   return serialize(await prisma.shoppingSession.findUnique(...));
 */
export function serialize<T>(value: T): Serialized<T> {
  return _serialize(value) as Serialized<T>;
}

// --------------- internal ---------------

function isDecimal(value: unknown): value is { toNumber(): number } {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  // Prisma Decimal exposes `toNumber()` and `d` (digit array).
  // Checking constructor name avoids importing the Decimal class.
  const ctor = (value as Record<string, unknown>).constructor;
  if (ctor && typeof (ctor as { name?: string }).name === "string") {
    if ((ctor as { name: string }).name === "Decimal") return true;
  }
  return (
    typeof (value as Record<string, unknown>).toNumber === "function" &&
    typeof (value as Record<string, unknown>).toFixed === "function" &&
    "d" in value
  );
}

function _serialize(value: unknown): unknown {
  // null / undefined
  if (value == null) return value;

  // Prisma Decimal → number
  if (isDecimal(value)) return value.toNumber();

  // Date → ISO string
  if (value instanceof Date) return value.toISOString();

  // Array → recurse
  if (Array.isArray(value)) return value.map(_serialize);

  // Plain object → recurse each key
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = _serialize(v);
    }
    return out;
  }

  // Primitives (string, number, boolean) pass through
  return value;
}

// --------------- type-level ---------------

/**
 * Maps a Prisma result type to its serialized (JSON-safe) shape.
 *
 * - `Prisma.Decimal | null` → `number | null`
 * - `Date`                  → `string`
 * - Arrays and nested objects are mapped recursively
 * - Primitives pass through unchanged
 */
export type Serialized<T> =
  T extends { toNumber(): number }
    ? number
    : T extends Date
      ? string
      : T extends Array<infer U>
        ? Serialized<U>[]
        : T extends Record<string, unknown>
          ? { [K in keyof T]: Serialized<T[K]> }
          : T;
