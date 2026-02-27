import test from "node:test";
import assert from "node:assert/strict";

const providerCatalogModule = await import("./provider-catalog.ts");

const listIncomeProviderConnectionCards =
  providerCatalogModule.listIncomeProviderConnectionCards ??
  providerCatalogModule.default?.listIncomeProviderConnectionCards;

if (typeof listIncomeProviderConnectionCards !== "function") {
  throw new Error("Unable to load listIncomeProviderConnectionCards");
}

test("restaurant catalog prioritizes MVP rollout order", () => {
  const cards = listIncomeProviderConnectionCards("restaurant");
  const providerIds = cards.map((card) => card.provider.id);

  assert.deepEqual(providerIds.slice(0, 3), ["godaddy_pos", "uber_eats", "doordash"]);
  assert.equal(cards[0].recommended, true);
  assert.equal(cards[0].status, "not_connected");
  assert.equal(cards[0].connectEnabled, false);
});

test("contractor catalog excludes restaurant-only delivery providers", () => {
  const cards = listIncomeProviderConnectionCards("contractor");
  const providerIds = cards.map((card) => card.provider.id);

  assert.equal(providerIds.includes("uber_eats"), false);
  assert.equal(providerIds.includes("doordash"), false);
  assert.deepEqual(providerIds.slice(0, 2), ["stripe", "square"]);
});
