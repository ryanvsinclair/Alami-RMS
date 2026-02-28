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
