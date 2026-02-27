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
  assert.equal(cards[0].connectHref, null);
  assert.equal(cards[0].lastSyncAt, null, "unconnected cards should have lastSyncAt=null");
  assert.equal(cards[0].syncStale, false, "unconnected cards should have syncStale=false");
  assert.equal(cards[0].lastErrorMessage, null, "unconnected cards should have lastErrorMessage=null");
});

test("contractor catalog excludes restaurant-only delivery providers", () => {
  const cards = listIncomeProviderConnectionCards("contractor");
  const providerIds = cards.map((card) => card.provider.id);

  assert.equal(providerIds.includes("uber_eats"), false);
  assert.equal(providerIds.includes("doordash"), false);
  assert.deepEqual(providerIds.slice(0, 2), ["stripe", "square"]);
});

test("configured providers expose OAuth start links", () => {
  const previousEnv = {
    clientId: process.env.INCOME_OAUTH_GODADDY_POS_CLIENT_ID,
    clientSecret: process.env.INCOME_OAUTH_GODADDY_POS_CLIENT_SECRET,
    authUrl: process.env.INCOME_OAUTH_GODADDY_POS_AUTH_URL,
    tokenUrl: process.env.INCOME_OAUTH_GODADDY_POS_TOKEN_URL,
  };

  process.env.INCOME_OAUTH_GODADDY_POS_CLIENT_ID = "client-id";
  process.env.INCOME_OAUTH_GODADDY_POS_CLIENT_SECRET = "client-secret";
  process.env.INCOME_OAUTH_GODADDY_POS_AUTH_URL = "https://example.com/oauth/authorize";
  process.env.INCOME_OAUTH_GODADDY_POS_TOKEN_URL = "https://example.com/oauth/token";

  try {
    const cards = listIncomeProviderConnectionCards("restaurant", {
      returnToPath: "/onboarding/income-sources",
    });
    const godaddyCard = cards.find((card) => card.provider.id === "godaddy_pos");

    assert.ok(godaddyCard);
    assert.equal(godaddyCard.connectEnabled, true);
    assert.match(
      godaddyCard.connectHref ?? "",
      /^\/api\/integrations\/oauth\/godaddy_pos\/start\?return_to=%2Fonboarding%2Fincome-sources$/
    );
  } finally {
    process.env.INCOME_OAUTH_GODADDY_POS_CLIENT_ID = previousEnv.clientId;
    process.env.INCOME_OAUTH_GODADDY_POS_CLIENT_SECRET = previousEnv.clientSecret;
    process.env.INCOME_OAUTH_GODADDY_POS_AUTH_URL = previousEnv.authUrl;
    process.env.INCOME_OAUTH_GODADDY_POS_TOKEN_URL = previousEnv.tokenUrl;
  }
});
