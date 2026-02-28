import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "../../../../");
const contractsModuleHref = new URL("./table-service.contracts.ts", import.meta.url).href;
const contracts = await import(contractsModuleHref);

const {
  KITCHEN_CONFIRMATION_WINDOW_MINUTES,
  TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY,
  getKitchenOrderDueAt,
  shouldShowKitchenOrderInQueue,
} = contracts;

test("launch smoke: required QR/host/kitchen routes exist", () => {
  const requiredPaths = [
    "app/scan/t/[token]/page.tsx",
    "app/r/[publicSlug]/page.tsx",
    "app/(dashboard)/service/host/page.tsx",
    "app/(dashboard)/service/kitchen/page.tsx",
    "app/(dashboard)/profile/page.tsx",
  ];

  for (const relativePath of requiredPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.equal(fs.existsSync(absolutePath), true, `missing required route: ${relativePath}`);
  }
});

test("launch smoke: queue visibility collapses on terminal-only items and resurfaces on append", () => {
  assert.equal(shouldShowKitchenOrderInQueue(["pending"]), true);
  assert.equal(shouldShowKitchenOrderInQueue(["served", "cancelled"]), false);
  assert.equal(shouldShowKitchenOrderInQueue(["served", "pending"]), true);
});

test("launch smoke: confirmation timer due-at uses canonical window", () => {
  const confirmedAt = new Date("2026-02-28T10:00:00.000Z");
  const dueAt = getKitchenOrderDueAt(confirmedAt);
  const expectedMs = confirmedAt.getTime() + KITCHEN_CONFIRMATION_WINDOW_MINUTES * 60 * 1000;
  assert.equal(dueAt.getTime(), expectedMs);
});

test("launch smoke: profile mode toggle wiring uses shared storage key and kitchen redirect target", () => {
  const homePage = fs.readFileSync(path.join(repoRoot, "app/page.tsx"), "utf8");
  const profileToggle = fs.readFileSync(
    path.join(repoRoot, "src/features/table-service/ui/TableServiceModeToggleCard.tsx"),
    "utf8",
  );

  assert.match(homePage, /TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY/);
  assert.match(homePage, /\/service\/kitchen/);
  assert.match(profileToggle, /TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY/);
  assert.match(profileToggle, /Host/);
  assert.match(profileToggle, /Kitchen/);
  assert.equal(typeof TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY, "string");
});

test("launch smoke: scan router uses session-aware actor split (member->host, guest->public)", () => {
  const scanRouter = fs.readFileSync(path.join(repoRoot, "app/scan/t/[token]/page.tsx"), "utf8");

  assert.match(scanRouter, /getOptionalUserId/);
  assert.match(scanRouter, /prisma\.userBusiness\.findFirst/);
  assert.match(scanRouter, /getOrCreateActiveTableSession/);
  assert.match(scanRouter, /\/service\/host\?table=/);
  assert.match(scanRouter, /&session=/);
  assert.match(scanRouter, /redirect\(`\/r\/\$\{encodeURIComponent\(resolved\.business\.id\)\}`\)/);
});

test("launch smoke: public diner landing remains menu-first with google-review CTA gating", () => {
  const publicLanding = fs.readFileSync(path.join(repoRoot, "app/r/[publicSlug]/page.tsx"), "utf8");

  assert.match(publicLanding, /prisma\.menuCategory\.findMany/);
  assert.match(publicLanding, /prisma\.menuItem\.findMany/);
  assert.match(publicLanding, /business\.google_place_id &&/);
  assert.match(publicLanding, /writereview\?placeid=/);
  assert.doesNotMatch(publicLanding, /service\/host/);
});

test("launch smoke: host composer wires confirm, append, and done-paid close lifecycle actions", () => {
  const hostComposer = fs.readFileSync(
    path.join(repoRoot, "src/features/table-service/ui/HostOrderComposerPageClient.tsx"),
    "utf8",
  );

  assert.match(hostComposer, /confirmKitchenOrder/);
  assert.match(hostComposer, /appendKitchenOrderItems/);
  assert.match(hostComposer, /closeKitchenOrderAndSession/);
  assert.match(hostComposer, /Append Items To Order/);
  assert.match(hostComposer, /Done\/Paid And Close Table Session/);
  assert.match(hostComposer, /Post-confirm edits append new item rows to the same kitchen order/);
});

test("launch smoke: order service enforces same-order append and host-controlled table-session closure", () => {
  const orderService = fs.readFileSync(
    path.join(repoRoot, "src/features/table-service/server/order.service.ts"),
    "utf8",
  );

  assert.match(orderService, /export async function confirmKitchenOrder/);
  assert.match(orderService, /if \(existingOrder\)/);
  assert.match(orderService, /table_session_id:\s*session\.id/);
  assert.match(orderService, /export async function appendKitchenOrderItems/);
  assert.match(orderService, /id:\s*kitchenOrderId/);
  assert.match(orderService, /table_session:/);
  assert.match(orderService, /closed_at:\s*null/);
  assert.match(orderService, /export async function closeKitchenOrderAndSession/);
  assert.match(orderService, /tx\.tableSession\.update/);
  assert.match(orderService, /closed_at:\s*closedAt/);
});

test("launch smoke: kitchen queue stays FIFO by confirmation time for advancement behavior", () => {
  const orderService = fs.readFileSync(
    path.join(repoRoot, "src/features/table-service/server/order.service.ts"),
    "utf8",
  );

  assert.match(orderService, /orderBy:\s*\[\{\s*confirmed_at:\s*"asc"\s*\},\s*\{\s*created_at:\s*"asc"\s*\}\]/);
  assert.match(orderService, /shouldShowKitchenOrderInQueue/);
  assert.match(orderService, /confirmed_at:\s*\{\s*not:\s*null/);
});

test("launch smoke: overdue timer urgency remains visual and does not reorder queue", () => {
  const kitchenQueueClient = fs.readFileSync(
    path.join(repoRoot, "src/features/table-service/ui/KitchenQueuePageClient.tsx"),
    "utf8",
  );

  assert.match(kitchenQueueClient, /getOverdueMinutesLabel/);
  assert.match(kitchenQueueClient, /Queue Position \{index \+ 1\}/);
  assert.match(kitchenQueueClient, /FIFO by confirmation time\. Orders are rendered oldest confirmed first\./);
  assert.match(kitchenQueueClient, /overdueLabel \? "border-danger\/40 bg-danger\/5" : "border-border"/);
});
