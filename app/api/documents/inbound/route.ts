import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  computeContentHash,
  createDraft,
  findDraftByRawHash,
  findBusinessByAddressToken,
  parsePostmarkPayload,
  PostmarkPayloadError,
  storeRawDocument,
  updateDraftIngestArtifacts,
} from "@/features/documents/server";
import type { IngestableAttachment } from "@/features/documents/server";
import { DocumentStorageError } from "@/features/documents/server";

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const tokenRequestHistory = new Map<string, number[]>();

function parseBasicAuthHeader(authorizationHeader: string | null) {
  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
    return null;
  }

  const encoded = authorizationHeader.slice("Basic ".length).trim();
  if (!encoded) return null;

  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) return null;

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function timingSafeStringEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isWebhookAuthorized(request: NextRequest) {
  const expectedUser = process.env.POSTMARK_INBOUND_WEBHOOK_USER;
  const expectedPass = process.env.POSTMARK_INBOUND_WEBHOOK_PASS;
  if (!expectedUser || !expectedPass) {
    return { configured: false, authorized: false };
  }

  const credentials = parseBasicAuthHeader(request.headers.get("authorization"));
  if (!credentials) {
    return { configured: true, authorized: false };
  }

  const authorized =
    timingSafeStringEquals(credentials.username, expectedUser) &&
    timingSafeStringEquals(credentials.password, expectedPass);
  return { configured: true, authorized };
}

function inferAttachmentExtension(attachment: IngestableAttachment) {
  const name = attachment.name.trim();
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex >= 0 && dotIndex < name.length - 1) {
    const fromName = name.slice(dotIndex + 1).toLowerCase();
    if (/^[a-z0-9]+$/.test(fromName)) return fromName;
  }

  const normalizedContentType = attachment.contentType.toLowerCase().split(";")[0].trim();
  const extensionMap: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "text/plain": "txt",
    "application/json": "json",
  };

  return extensionMap[normalizedContentType] ?? "bin";
}

function isRateLimited(addressToken: string, now = Date.now()) {
  const existing = tokenRequestHistory.get(addressToken) ?? [];
  const recent = existing.filter((timestamp) => now - timestamp <= RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    tokenRequestHistory.set(addressToken, recent);
    return true;
  }

  recent.push(now);
  tokenRequestHistory.set(addressToken, recent);
  return false;
}

function enqueueParseAttempt(businessId: string, draftId: string) {
  setTimeout(() => {
    void (async () => {
      try {
        const documentsServer = await import("@/features/documents/server");
        const candidate = (documentsServer as Record<string, unknown>).parseAndSaveDraft;
        if (typeof candidate === "function") {
          await (candidate as (businessId: string, draftId: string) => Promise<unknown>)(
            businessId,
            draftId,
          );
        }
      } catch (error) {
        console.error("[documents/inbound] failed to enqueue parse", {
          businessId,
          draftId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, 0);
}

export async function POST(request: NextRequest) {
  const auth = isWebhookAuthorized(request);
  if (!auth.configured) {
    return NextResponse.json({ error: "Inbound webhook is not configured" }, { status: 503 });
  }

  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await request.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Unable to read request body" }, { status: 400 });
  }

  let parsed: ReturnType<typeof parsePostmarkPayload>;
  try {
    parsed = parsePostmarkPayload(rawBody);
  } catch (error) {
    if (error instanceof PostmarkPayloadError) {
      return NextResponse.json(
        { error: "Malformed Postmark payload", reason: error.reason },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  let stage = "mailbox_hash";
  try {
    const mailboxHash = parsed.mailboxHash.trim().toLowerCase();
    if (isRateLimited(mailboxHash)) {
      return NextResponse.json(
        { received: false, reason: "rate_limited" },
        { status: 429 },
      );
    }

    stage = "business_lookup";
    const business = await findBusinessByAddressToken(mailboxHash);
    if (!business) {
      console.warn("[documents/inbound] unknown mailbox token", {
        mailboxHash,
        postmarkMessageId: parsed.postmarkMessageId,
      });
      return NextResponse.json({ received: false, reason: "unknown_address" });
    }

    stage = "draft_create";
    const rawContentHash = computeContentHash(rawBody);
    const existingDraft = await findDraftByRawHash(business.businessId, rawContentHash);
    if (existingDraft) {
      return NextResponse.json({
        received: true,
        draftId: existingDraft.id,
        duplicate: true,
      });
    }

    const draftResult = await createDraft({
      businessId: business.businessId,
      inboundChannel: parsed.inboundChannel,
      rawStoragePath: "pending://raw",
      rawContentType: parsed.rawContentType,
      rawContentHash,
      postmarkMessageId: parsed.postmarkMessageId,
    });

    if (draftResult.duplicate) {
      return NextResponse.json({
        received: true,
        draftId: draftResult.draft.id,
        duplicate: true,
      });
    }

    stage = "store_raw_document";
    const draftId = draftResult.draft.id;
    const rawStorage = await storeRawDocument({
      businessId: business.businessId,
      draftId,
      content: rawBody,
      contentType: parsed.rawContentType,
      filename: "raw.json",
    });

    stage = "store_attachments";
    const attachmentLogs: Array<{
      name: string;
      storagePath: string;
      contentType: string;
      contentLength: number;
    }> = [];

    for (let index = 0; index < parsed.attachments.length; index += 1) {
      const attachment = parsed.attachments[index];
      const extension = inferAttachmentExtension(attachment);
      const filename = `attachment-${index + 1}.${extension}`;

      const stored = await storeRawDocument({
        businessId: business.businessId,
        draftId,
        content: attachment.content,
        contentType: attachment.contentType,
        filename,
      });

      attachmentLogs.push({
        name: attachment.name,
        storagePath: stored.storagePath,
        contentType: attachment.contentType,
        contentLength: attachment.contentLength,
      });
    }

    stage = "update_draft_ingest";
    await updateDraftIngestArtifacts(business.businessId, draftId, {
      rawStoragePath: rawStorage.storagePath,
      parseFlags: {
        ingress: {
          mailbox_hash: mailboxHash,
          postmark_message_id: parsed.postmarkMessageId,
          sender_email: parsed.senderEmail,
          sender_name: parsed.senderName,
          subject: parsed.subject,
          received_at: new Date().toISOString(),
        },
        attachments: attachmentLogs,
      },
    });

    stage = "enqueue_parse";
    enqueueParseAttempt(business.businessId, draftId);
    return NextResponse.json({ received: true, draftId });
  } catch (error) {
    if (error instanceof DocumentStorageError) {
      console.error("[documents/inbound] storage failed", {
        stage,
        error: error.message,
      });
      return NextResponse.json({ received: false, reason: "storage_failed" }, { status: 500 });
    }

    console.error("[documents/inbound] unhandled processing error", {
      stage,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        received: false,
        reason: "ingest_failed",
      },
      { status: 500 },
    );
  }
}
