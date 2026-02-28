import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "../../../../");
const contractsModuleHref = new URL("./intake.contracts.ts", import.meta.url).href;
const contracts = await import(contractsModuleHref);

const {
  INTAKE_GLOBAL_INVARIANTS,
  INTAKE_ITEM_SOURCES,
  INTAKE_SOURCE_ELIGIBILITY,
} = contracts;

test("launch smoke: intake source map locks launch support and eligibility invariants", () => {
  assert.equal(INTAKE_GLOBAL_INVARIANTS.receipts_do_not_auto_create_inventory, true);
  assert.equal(INTAKE_GLOBAL_INVARIANTS.inventory_writes_are_explicit_and_eligibility_gated, true);
  assert.equal(INTAKE_GLOBAL_INVARIANTS.unresolved_parsed_produce_routes_to_fix_later, true);

  assert.ok(INTAKE_ITEM_SOURCES.includes("barcode_scan"));
  assert.ok(INTAKE_ITEM_SOURCES.includes("produce_search"));
  assert.ok(INTAKE_ITEM_SOURCES.includes("manual_entry"));
  assert.ok(INTAKE_ITEM_SOURCES.includes("shelf_label_scan"));
  assert.ok(INTAKE_ITEM_SOURCES.includes("receipt_produce_resolve_later"));

  assert.equal(INTAKE_SOURCE_ELIGIBILITY.barcode_scan.inventory_eligibility, "eligible");
  assert.equal(INTAKE_SOURCE_ELIGIBILITY.produce_search.inventory_eligibility, "eligible");
  assert.equal(INTAKE_SOURCE_ELIGIBILITY.manual_entry.inventory_eligibility, "expense_only");
  assert.equal(INTAKE_SOURCE_ELIGIBILITY.shelf_label_scan.inventory_eligibility, "expense_only");
});

test("launch smoke: receipt review requires explicit produce decisions before finalization", () => {
  const receiptsActions = fs.readFileSync(path.join(repoRoot, "app/actions/modules/receipts.ts"), "utf8");

  assert.match(receiptsActions, /finalizeReceiptReview/);
  assert.match(receiptsActions, /pendingProduceLines/);
  assert.match(receiptsActions, /Complete produce checklist decisions before committing this receipt/);
  assert.match(receiptsActions, /resolve_later_count/);
  assert.match(receiptsActions, /expense_only_count/);
});

test("launch smoke: shopping commit flow enforces inventory eligibility and keeps expense ledger writes", () => {
  const commitService = fs.readFileSync(
    path.join(repoRoot, "src/features/shopping/server/commit.service.ts"),
    "utf8",
  );

  assert.match(commitService, /INTAKE_SOURCE_ELIGIBILITY/);
  assert.match(commitService, /ineligibleInventoryItems/);
  assert.match(commitService, /inventory_eligibility/);
  assert.match(commitService, /financialTransaction\.upsert/);
  assert.match(commitService, /inventory_transaction_count/);
});

test("launch smoke: resolve-later decisions route into inventory fix-later purchase-confirmation queue", () => {
  const inventoryRepository = fs.readFileSync(
    path.join(repoRoot, "src/features/inventory/server/inventory.repository.ts"),
    "utf8",
  );
  const inventoryService = fs.readFileSync(
    path.join(repoRoot, "src/features/inventory/server/inventory.service.ts"),
    "utf8",
  );

  assert.match(inventoryRepository, /findReceiptPurchaseConfirmationsToResolve/);
  assert.match(inventoryRepository, /inventory_decision:\s*"resolve_later"/);
  assert.match(inventoryService, /review_purchase_confirmation/);
  assert.match(inventoryService, /unresolvedPurchaseConfirmations/);
});

test("launch smoke: receipt-linked surfaces expose View Photo entry points", () => {
  const receiptDetail = fs.readFileSync(
    path.join(repoRoot, "src/features/receiving/receipt/ui/ReceiptDetailPageClient.tsx"),
    "utf8",
  );
  const homeLayer = fs.readFileSync(
    path.join(repoRoot, "src/features/home/ui/HomeTransactionsLayer.tsx"),
    "utf8",
  );
  const shoppingOrderDetail = fs.readFileSync(
    path.join(repoRoot, "app/(dashboard)/shopping/orders/[id]/page.tsx"),
    "utf8",
  );

  assert.match(receiptDetail, /View Photo/);
  assert.match(homeLayer, /View Photo/);
  assert.match(shoppingOrderDetail, /View Photo/);
});
