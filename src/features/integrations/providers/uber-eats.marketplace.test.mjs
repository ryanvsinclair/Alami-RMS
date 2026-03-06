import test from "node:test";
import assert from "node:assert/strict";

const uberEatsMarketplaceModule = await import("./uber-eats.marketplace.ts");

const createUberEatsOAuthAdapter =
  uberEatsMarketplaceModule.createUberEatsOAuthAdapter ??
  uberEatsMarketplaceModule.default?.createUberEatsOAuthAdapter;
const getUberEatsApiBaseUrl =
  uberEatsMarketplaceModule.getUberEatsApiBaseUrl ??
  uberEatsMarketplaceModule.default?.getUberEatsApiBaseUrl;
const exchangeUberEatsClientCredentialsToken =
  uberEatsMarketplaceModule.exchangeUberEatsClientCredentialsToken ??
  uberEatsMarketplaceModule.default?.exchangeUberEatsClientCredentialsToken;
const listUberEatsStores =
  uberEatsMarketplaceModule.listUberEatsStores ??
  uberEatsMarketplaceModule.default?.listUberEatsStores;

if (
  typeof createUberEatsOAuthAdapter !== "function" ||
  typeof getUberEatsApiBaseUrl !== "function" ||
  typeof exchangeUberEatsClientCredentialsToken !== "function" ||
  typeof listUberEatsStores !== "function"
) {
  throw new Error("Unable to load Uber Eats marketplace helpers");
}

function saveEnv() {
  return {
    clientId: process.env.INCOME_OAUTH_UBER_EATS_CLIENT_ID,
    clientSecret: process.env.INCOME_OAUTH_UBER_EATS_CLIENT_SECRET,
    authUrl: process.env.INCOME_OAUTH_UBER_EATS_AUTH_URL,
    tokenUrl: process.env.INCOME_OAUTH_UBER_EATS_TOKEN_URL,
    scopes: process.env.INCOME_OAUTH_UBER_EATS_SCOPES,
    clientScopes: process.env.INCOME_UBER_EATS_CLIENT_SCOPES,
    apiBaseUrl: process.env.INCOME_UBER_EATS_API_BASE_URL,
  };
}

function restoreEnv(previousEnv) {
  process.env.INCOME_OAUTH_UBER_EATS_CLIENT_ID = previousEnv.clientId;
  process.env.INCOME_OAUTH_UBER_EATS_CLIENT_SECRET = previousEnv.clientSecret;
  process.env.INCOME_OAUTH_UBER_EATS_AUTH_URL = previousEnv.authUrl;
  process.env.INCOME_OAUTH_UBER_EATS_TOKEN_URL = previousEnv.tokenUrl;
  process.env.INCOME_OAUTH_UBER_EATS_SCOPES = previousEnv.scopes;
  process.env.INCOME_UBER_EATS_CLIENT_SCOPES = previousEnv.clientScopes;
  process.env.INCOME_UBER_EATS_API_BASE_URL = previousEnv.apiBaseUrl;
}

test("Uber Eats OAuth adapter defaults authorization_code scope to eats.pos_provisioning", () => {
  const previousEnv = saveEnv();

  process.env.INCOME_OAUTH_UBER_EATS_CLIENT_ID = "client-id";
  process.env.INCOME_OAUTH_UBER_EATS_CLIENT_SECRET = "client-secret";
  process.env.INCOME_OAUTH_UBER_EATS_AUTH_URL = "https://sandbox-login.uber.com/oauth/v2/authorize";
  process.env.INCOME_OAUTH_UBER_EATS_TOKEN_URL = "https://sandbox-login.uber.com/oauth/v2/token";
  delete process.env.INCOME_OAUTH_UBER_EATS_SCOPES;

  try {
    const adapter = createUberEatsOAuthAdapter();
    const url = new URL(
      adapter.buildAuthorizationUrl({
        state: "state-123",
        redirectUri: "https://example.com/api/integrations/oauth/uber_eats/callback",
        codeChallenge: "challenge-123",
        codeChallengeMethod: "S256",
      })
    );

    assert.equal(url.searchParams.get("scope"), "eats.pos_provisioning");
    assert.equal(url.searchParams.get("client_id"), "client-id");
  } finally {
    restoreEnv(previousEnv);
  }
});

test("Uber Eats API base infers sandbox mode from OAuth URLs", () => {
  const previousEnv = saveEnv();

  process.env.INCOME_OAUTH_UBER_EATS_AUTH_URL = "https://sandbox-login.uber.com/oauth/v2/authorize";
  process.env.INCOME_OAUTH_UBER_EATS_TOKEN_URL = "https://sandbox-login.uber.com/oauth/v2/token";
  delete process.env.INCOME_UBER_EATS_API_BASE_URL;

  try {
    assert.equal(getUberEatsApiBaseUrl(), "https://test-api.uber.com");
  } finally {
    restoreEnv(previousEnv);
  }
});

test("Uber Eats client_credentials helper posts the requested scopes", async () => {
  const previousEnv = saveEnv();
  const previousFetch = global.fetch;
  let capturedUrl = null;
  let capturedBody = null;

  process.env.INCOME_OAUTH_UBER_EATS_CLIENT_ID = "client-id";
  process.env.INCOME_OAUTH_UBER_EATS_CLIENT_SECRET = "client-secret";
  process.env.INCOME_OAUTH_UBER_EATS_AUTH_URL = "https://sandbox-login.uber.com/oauth/v2/authorize";
  process.env.INCOME_OAUTH_UBER_EATS_TOKEN_URL = "https://sandbox-login.uber.com/oauth/v2/token";

  global.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedBody = init?.body?.toString() ?? "";

    return new Response(
      JSON.stringify({
        access_token: "app-token-123",
        expires_in: 2_592_000,
        scope: "eats.store eats.report",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  try {
    const result = await exchangeUberEatsClientCredentialsToken({
      scopes: ["eats.store", "eats.report"],
    });

    assert.equal(capturedUrl, "https://sandbox-login.uber.com/oauth/v2/token");
    assert.match(capturedBody ?? "", /grant_type=client_credentials/);
    assert.match(capturedBody ?? "", /scope=eats.store\+eats.report/);
    assert.equal(result.accessToken, "app-token-123");
    assert.deepEqual(result.scopes, ["eats.store", "eats.report"]);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
  }
});

test("Uber Eats store listing maps provisioning fields from pos_data", async () => {
  const previousEnv = saveEnv();
  const previousFetch = global.fetch;

  process.env.INCOME_OAUTH_UBER_EATS_AUTH_URL = "https://sandbox-login.uber.com/oauth/v2/authorize";
  process.env.INCOME_OAUTH_UBER_EATS_TOKEN_URL = "https://sandbox-login.uber.com/oauth/v2/token";
  process.env.INCOME_UBER_EATS_API_BASE_URL = "https://test-api.uber.com";

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        stores: [
          {
            store_id: "store_123",
            display_name: "Bank Street",
            address: {
              street_address: "2210 Bank St",
              city: "Ottawa",
            },
            pos_data: {
              integration_enabled: true,
              integrator_store_id: "vynance:store_123",
              is_order_manager_pending: false,
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );

  try {
    const stores = await listUberEatsStores({ accessToken: "merchant-token-123" });
    assert.equal(stores.length, 1);
    assert.equal(stores[0].id, "store_123");
    assert.equal(stores[0].displayName, "Bank Street");
    assert.equal(stores[0].city, "Ottawa");
    assert.equal(stores[0].integrationEnabled, true);
    assert.equal(stores[0].integratorStoreId, "vynance:store_123");
    assert.equal(stores[0].isOrderManagerPending, false);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
  }
});
