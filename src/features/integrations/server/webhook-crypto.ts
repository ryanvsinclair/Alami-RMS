import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies an HMAC-SHA256 signature from a webhook payload.
 *
 * Providers typically send:
 *   X-Signature-256: sha256=<hex_digest>   (Uber Eats style)
 *   X-DoorDash-Signature: <hex_digest>     (DoorDash style)
 *
 * Both are HMAC-SHA256 over the raw request body using the provider's
 * webhook signing secret.
 */
export function verifyHmacSha256Signature(params: {
  secret: string;
  payload: Buffer;
  receivedSignature: string;
  /** Strip a leading prefix like "sha256=" if present */
  stripPrefix?: string;
}): boolean {
  const { secret, payload, receivedSignature, stripPrefix } = params;

  const normalized = stripPrefix
    ? receivedSignature.replace(new RegExp(`^${stripPrefix}`), "")
    : receivedSignature;

  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(normalized, "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Reads the raw request body as a Buffer.
 * Next.js App Router does not expose the raw body directly — we read
 * from the Request.arrayBuffer() which preserves the exact bytes needed
 * for signature verification.
 */
export async function readRawBody(request: Request): Promise<Buffer> {
  const arrayBuffer = await request.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
