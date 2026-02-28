import { describe, it } from "node:test";
import assert from "node:assert/strict";
const contractsModuleHref = new URL("./table-service.contracts.ts", import.meta.url).href;
const {
  KITCHEN_ORDER_ITEM_STATUSES,
  KITCHEN_TERMINAL_ITEM_STATUSES,
  TABLE_SERVICE_MODULE_ID,
  TABLE_SERVICE_ORDER_FLOW_CONTRACT,
} = await import(contractsModuleHref);

describe("table-service contracts", () => {
  it("uses table_service as canonical module id", () => {
    assert.equal(TABLE_SERVICE_MODULE_ID, "table_service");
  });

  it("locks kitchen order item lifecycle statuses", () => {
    assert.deepEqual(KITCHEN_ORDER_ITEM_STATUSES, [
      "pending",
      "preparing",
      "ready_to_serve",
      "served",
      "cancelled",
    ]);
    assert.deepEqual(KITCHEN_TERMINAL_ITEM_STATUSES, ["served", "cancelled"]);
  });

  it("locks one-order-per-session and append behavior invariants", () => {
    assert.equal(TABLE_SERVICE_ORDER_FLOW_CONTRACT.one_order_per_session, true);
    assert.equal(
      TABLE_SERVICE_ORDER_FLOW_CONTRACT.post_confirm_edits_append_to_same_order,
      true,
    );
    assert.equal(TABLE_SERVICE_ORDER_FLOW_CONTRACT.amendment_table_in_v1, false);
  });
});
