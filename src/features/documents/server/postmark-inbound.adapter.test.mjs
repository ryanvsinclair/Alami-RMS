import test from "node:test";
import assert from "node:assert/strict";

const adapterModule = await import("./postmark-inbound.adapter.ts");

const {
  parsePostmarkPayload,
  computeContentHash,
  PostmarkPayloadError,
} = adapterModule;

function makePayload(overrides = {}) {
  return {
    FromName: "Fresh Farm",
    From: "Fresh Farm <billing@freshfarm.test>",
    FromFull: {
      Email: "billing@freshfarm.test",
      Name: "Fresh Farm",
      MailboxHash: "token123",
    },
    To: "inbound",
    ToFull: [
      {
        Email: "server+token123@inbound.postmarkapp.com",
        Name: "",
        MailboxHash: "token123",
      },
    ],
    Cc: "",
    CcFull: [],
    Bcc: "",
    BccFull: [],
    OriginalRecipient: "server+token123@inbound.postmarkapp.com",
    ReplyTo: "",
    Subject: "Invoice #4471",
    MessageID: "pmk-message-1",
    Date: "Thu, 27 Feb 2026 12:00:00 +0000",
    MailboxHash: "token123",
    TextBody: "Total: 55.22",
    HtmlBody: "<p>Total: 55.22</p>",
    StrippedTextReply: "",
    Tag: "",
    Headers: [],
    Attachments: [],
    MessageStream: "inbound",
    ...overrides,
  };
}

test("parsePostmarkPayload maps valid payload fields to ingestable document", () => {
  const raw = Buffer.from(JSON.stringify(makePayload()), "utf8");
  const parsed = parsePostmarkPayload(raw);

  assert.equal(parsed.inboundChannel, "email");
  assert.equal(parsed.rawContentType, "application/json");
  assert.equal(parsed.postmarkMessageId, "pmk-message-1");
  assert.equal(parsed.senderEmail, "billing@freshfarm.test");
  assert.equal(parsed.senderName, "Fresh Farm");
  assert.equal(parsed.subject, "Invoice #4471");
  assert.equal(parsed.textBody, "Total: 55.22");
  assert.equal(parsed.mailboxHash, "token123");
});

test("parsePostmarkPayload extracts MailboxHash from top-level payload field", () => {
  const raw = Buffer.from(
    JSON.stringify(
      makePayload({
        MailboxHash: "mailbox-via-top-level",
        FromFull: {
          Email: "billing@freshfarm.test",
          Name: "Fresh Farm",
          MailboxHash: "different-hash",
        },
      }),
    ),
    "utf8",
  );

  const parsed = parsePostmarkPayload(raw);
  assert.equal(parsed.mailboxHash, "mailbox-via-top-level");
});

test("parsePostmarkPayload decodes attachment base64 payload to Buffer", () => {
  const text = "invoice attachment";
  const raw = Buffer.from(
    JSON.stringify(
      makePayload({
        Attachments: [
          {
            Name: "invoice.txt",
            Content: Buffer.from(text, "utf8").toString("base64"),
            ContentType: "text/plain",
            ContentLength: text.length,
            ContentID: "",
          },
        ],
      }),
    ),
    "utf8",
  );

  const parsed = parsePostmarkPayload(raw);
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.attachments[0].name, "invoice.txt");
  assert.equal(parsed.attachments[0].contentType, "text/plain");
  assert.equal(parsed.attachments[0].content.toString("utf8"), text);
});

test("parsePostmarkPayload throws PostmarkPayloadError for malformed JSON body", () => {
  assert.throws(
    () => parsePostmarkPayload(Buffer.from("{not-json", "utf8")),
    (error) =>
      error instanceof PostmarkPayloadError &&
      error.reason === "malformed_json",
  );
});

test("parsePostmarkPayload throws PostmarkPayloadError when MailboxHash is missing", () => {
  const raw = Buffer.from(JSON.stringify(makePayload({ MailboxHash: "" })), "utf8");

  assert.throws(
    () => parsePostmarkPayload(raw),
    (error) =>
      error instanceof PostmarkPayloadError &&
      error.reason === "missing_mailboxhash",
  );
});

test("computeContentHash is deterministic for the same input", () => {
  const content = Buffer.from("same-payload", "utf8");
  const first = computeContentHash(content);
  const second = computeContentHash(content);
  const different = computeContentHash(Buffer.from("different-payload", "utf8"));

  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.equal(first.length, 64);
});
