import crypto from "node:crypto";
import { INCOME_TOKEN_ENCRYPTION_CONTRACT } from "@/features/integrations/shared";

const TOKEN_PREFIX = "v1";

function resolveTokenKeyMaterial(): Buffer {
  const envVar = INCOME_TOKEN_ENCRYPTION_CONTRACT.keyEnvVar;
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(`Missing required env var: ${envVar}`);
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Candidate = Buffer.from(raw, "base64");
  if (base64Candidate.length === INCOME_TOKEN_ENCRYPTION_CONTRACT.keyBytes) {
    return base64Candidate;
  }

  const utf8Candidate = Buffer.from(raw, "utf8");
  if (utf8Candidate.length === INCOME_TOKEN_ENCRYPTION_CONTRACT.keyBytes) {
    return utf8Candidate;
  }

  throw new Error(
    `${envVar} must decode to ${INCOME_TOKEN_ENCRYPTION_CONTRACT.keyBytes} bytes (hex, base64, or raw)`
  );
}

export function encryptIncomeSecret(plainText: string): string {
  const key = resolveTokenKeyMaterial();
  const iv = crypto.randomBytes(INCOME_TOKEN_ENCRYPTION_CONTRACT.ivBytes);
  const cipher = crypto.createCipheriv(INCOME_TOKEN_ENCRYPTION_CONTRACT.algorithm, key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    cipherText.toString("base64url"),
  ].join(":");
}

export function decryptIncomeSecret(encryptedPayload: string): string {
  const [prefix, ivEncoded, authTagEncoded, payloadEncoded] = encryptedPayload.split(":");
  if (prefix !== TOKEN_PREFIX || !ivEncoded || !authTagEncoded || !payloadEncoded) {
    throw new Error("Invalid encrypted payload format");
  }

  const key = resolveTokenKeyMaterial();
  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const payload = Buffer.from(payloadEncoded, "base64url");

  const decipher = crypto.createDecipheriv(INCOME_TOKEN_ENCRYPTION_CONTRACT.algorithm, key, iv);
  decipher.setAuthTag(authTag);
  const plainText = Buffer.concat([decipher.update(payload), decipher.final()]);
  return plainText.toString("utf8");
}
