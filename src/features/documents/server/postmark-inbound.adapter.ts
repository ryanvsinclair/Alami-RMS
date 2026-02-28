import { createHash } from "node:crypto";

type DocumentInboundChannel = "email" | "webhook" | "manual_upload";
const POSTMARK_INBOUND_CHANNEL: DocumentInboundChannel = "email";

interface PostmarkInboundPayload {
  MessageID: string;
  MailboxHash: string;
  Subject: string;
  Date: string;
  TextBody: string;
  HtmlBody: string;
  FromFull: {
    Email: string;
    Name: string;
  };
  Attachments: PostmarkInboundAttachment[];
}

interface PostmarkInboundAttachment {
  Name: string;
  Content: string;
  ContentType: string;
  ContentLength: number;
}

export interface IngestableAttachment {
  name: string;
  content: Buffer;
  contentType: string;
  contentLength: number;
}

export interface IngestableDocument {
  inboundChannel: DocumentInboundChannel;
  rawContent: Buffer;
  rawContentType: string;
  rawContentHash: string;
  postmarkMessageId: string;
  mailboxHash: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  emailDate: string;
  attachments: IngestableAttachment[];
}

export class PostmarkPayloadError extends Error {
  readonly reason: string;

  constructor(reason: string, message?: string) {
    super(message ?? `Invalid Postmark inbound payload: ${reason}`);
    this.name = "PostmarkPayloadError";
    this.reason = reason;
  }
}

function parseJsonObject(rawBody: Buffer): Record<string, unknown> {
  const text = rawBody.toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PostmarkPayloadError("malformed_json");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PostmarkPayloadError("payload_not_object");
  }

  return parsed as Record<string, unknown>;
}

function requireStringField(
  payload: Record<string, unknown>,
  key: keyof PostmarkInboundPayload,
) {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PostmarkPayloadError(`missing_${String(key).toLowerCase()}`);
  }
  return value;
}

function readSenderFields(payload: Record<string, unknown>) {
  const fromFull = payload.FromFull;
  if (!fromFull || typeof fromFull !== "object" || Array.isArray(fromFull)) {
    throw new PostmarkPayloadError("missing_fromfull");
  }

  const senderEmail = (fromFull as Record<string, unknown>).Email;
  if (typeof senderEmail !== "string" || senderEmail.trim().length === 0) {
    throw new PostmarkPayloadError("missing_sender_email");
  }

  const senderName = (fromFull as Record<string, unknown>).Name;
  if (typeof senderName !== "string") {
    throw new PostmarkPayloadError("missing_sender_name");
  }

  return {
    senderEmail,
    senderName,
  };
}

function parseAttachments(payload: Record<string, unknown>): IngestableAttachment[] {
  const attachmentsValue = payload.Attachments;
  if (attachmentsValue == null) return [];
  if (!Array.isArray(attachmentsValue)) {
    throw new PostmarkPayloadError("invalid_attachments_array");
  }

  const attachments: IngestableAttachment[] = [];
  for (const attachment of attachmentsValue) {
    if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
      throw new PostmarkPayloadError("invalid_attachment_entry");
    }

    const entry = attachment as PostmarkInboundAttachment;
    if (typeof entry.Name !== "string" || !entry.Name.trim()) {
      throw new PostmarkPayloadError("attachment_missing_name");
    }
    if (typeof entry.Content !== "string" || !entry.Content.trim()) {
      throw new PostmarkPayloadError("attachment_missing_content");
    }
    if (typeof entry.ContentType !== "string" || !entry.ContentType.trim()) {
      throw new PostmarkPayloadError("attachment_missing_content_type");
    }
    if (typeof entry.ContentLength !== "number" || !Number.isFinite(entry.ContentLength)) {
      throw new PostmarkPayloadError("attachment_missing_content_length");
    }

    let decoded: Buffer;
    try {
      decoded = Buffer.from(entry.Content, "base64");
    } catch {
      throw new PostmarkPayloadError("attachment_invalid_base64");
    }

    attachments.push({
      name: entry.Name,
      content: decoded,
      contentType: entry.ContentType,
      contentLength: entry.ContentLength,
    });
  }

  return attachments;
}

export function computeContentHash(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function parsePostmarkPayload(rawBody: Buffer): IngestableDocument {
  const payload = parseJsonObject(rawBody);

  const postmarkMessageId = requireStringField(payload, "MessageID");
  const mailboxHash = requireStringField(payload, "MailboxHash");
  const subject = requireStringField(payload, "Subject");
  const emailDate = requireStringField(payload, "Date");
  const textBody = typeof payload.TextBody === "string" ? payload.TextBody : "";
  const htmlBody = typeof payload.HtmlBody === "string" ? payload.HtmlBody : "";
  const { senderEmail, senderName } = readSenderFields(payload);
  const attachments = parseAttachments(payload);

  return {
    inboundChannel: POSTMARK_INBOUND_CHANNEL,
    rawContent: rawBody,
    rawContentType: "application/json",
    rawContentHash: computeContentHash(rawBody),
    postmarkMessageId,
    mailboxHash,
    senderEmail,
    senderName,
    subject,
    textBody,
    htmlBody,
    emailDate,
    attachments,
  };
}
