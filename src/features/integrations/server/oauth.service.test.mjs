import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const oauthServiceModule = await import("./oauth.service.ts");

const startIncomeOAuthFlow =
  oauthServiceModule.startIncomeOAuthFlow ??
  oauthServiceModule.default?.startIncomeOAuthFlow;
const handleIncomeOAuthCallback =
  oauthServiceModule.handleIncomeOAuthCallback ??
  oauthServiceModule.default?.handleIncomeOAuthCallback;

if (typeof startIncomeOAuthFlow !== "function" || typeof handleIncomeOAuthCallback !== "function") {
  throw new Error("Unable to load OAuth service functions");
}

test("start flow stores hashed state and returns authorization URL", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  let createdState = null;

  const result = await startIncomeOAuthFlow(
    {
      businessId: "biz_1",
      userId: "user_1",
      providerId: "godaddy_pos",
      redirectUri: "https://app.example.com/api/integrations/oauth/godaddy_pos/callback",
      returnToPath: "/integrations",
      now,
    },
    {
      now: () => now,
      createState: async (input) => {
        createdState = input;
        return {};
      },
      consumeState: async () => null,
      upsertConnection: async () => ({}),
      markConnectionError: async () => ({ count: 0 }),
      encryptSecret: (value) => `enc:${value}`,
      decryptSecret: (value) => value,
      getProviderAdapter: () => ({
        providerId: "godaddy_pos",
        isConfigured: () => true,
        buildAuthorizationUrl: (params) => {
          const url = new URL("https://provider.example.com/oauth/authorize");
          url.searchParams.set("state", params.state);
          url.searchParams.set("code_challenge", params.codeChallenge);
          url.searchParams.set("code_challenge_method", params.codeChallengeMethod);
          return url.toString();
        },
        exchangeCodeForTokens: async () => {
          throw new Error("not expected");
        },
      }),
    }
  );

  assert.ok(createdState);
  const expectedHash = crypto.createHash("sha256").update(result.rawState).digest("hex");
  assert.equal(createdState.stateHash, expectedHash);
  assert.match(createdState.pkceVerifierEncrypted, /^enc:/);
  assert.equal(createdState.redirectUri, "https://app.example.com/api/integrations/oauth/godaddy_pos/callback");
  assert.equal(createdState.metadata.return_to, "/integrations");
  assert.equal(
    createdState.expiresAt.toISOString(),
    new Date("2026-02-27T23:10:00.000Z").toISOString()
  );

  const authUrl = new URL(result.authorizationUrl);
  assert.equal(authUrl.searchParams.get("state"), result.rawState);
  assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authUrl.searchParams.get("code_challenge"));
});

test("callback consumes state and upserts encrypted tokens", async () => {
  const now = new Date("2026-02-27T23:05:00.000Z");
  let upsertPayload = null;
  let markErrorCalled = false;

  const callbackResult = await handleIncomeOAuthCallback(
    {
      businessId: "biz_1",
      providerId: "godaddy_pos",
      code: "auth-code",
      state: "raw-state-value",
      now,
    },
    {
      now: () => now,
      createState: async () => ({}),
      consumeState: async () => ({
        id: "state_1",
        business_id: "biz_1",
        user_id: "user_1",
        provider_id: "godaddy_pos",
        state_hash: "ignored",
        pkce_verifier_encrypted: "enc:pkce-verifier",
        redirect_uri: "https://app.example.com/api/integrations/oauth/godaddy_pos/callback",
        expires_at: new Date("2026-02-27T23:10:00.000Z"),
        used_at: null,
        metadata: { return_to: "/integrations" },
      }),
      upsertConnection: async (input) => {
        upsertPayload = input;
        return {};
      },
      markConnectionError: async () => {
        markErrorCalled = true;
        return { count: 1 };
      },
      encryptSecret: (value) => `enc:${value}`,
      decryptSecret: (value) => value.replace(/^enc:/, ""),
      getProviderAdapter: () => ({
        providerId: "godaddy_pos",
        isConfigured: () => true,
        buildAuthorizationUrl: () => "",
        exchangeCodeForTokens: async (params) => {
          assert.equal(params.code, "auth-code");
          assert.equal(params.codeVerifier, "pkce-verifier");
          return {
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiresInSeconds: 3600,
            scopes: ["orders.read", "payments.read"],
            externalAccountId: "merchant_1",
            displayName: "Primary Merchant",
            metadata: { token_type: "bearer" },
          };
        },
      }),
    }
  );

  assert.equal(markErrorCalled, false);
  assert.ok(upsertPayload);
  assert.equal(upsertPayload.businessId, "biz_1");
  assert.equal(upsertPayload.providerId, "godaddy_pos");
  assert.equal(upsertPayload.status, "connected");
  assert.equal(upsertPayload.accessTokenEncrypted, "enc:access-token");
  assert.equal(upsertPayload.refreshTokenEncrypted, "enc:refresh-token");
  assert.equal(upsertPayload.displayName, "Primary Merchant");
  assert.equal(
    upsertPayload.tokenExpiresAt.toISOString(),
    new Date("2026-02-28T00:05:00.000Z").toISOString()
  );
  assert.deepEqual(upsertPayload.scopes, ["orders.read", "payments.read"]);

  assert.equal(callbackResult.returnToPath, "/integrations");
  assert.equal(callbackResult.connectionStatus, "connected");
});

test("callback fails when state is invalid or expired", async () => {
  await assert.rejects(
    () =>
      handleIncomeOAuthCallback(
        {
          businessId: "biz_1",
          providerId: "godaddy_pos",
          code: "auth-code",
          state: "missing-state",
        },
        {
          createState: async () => ({}),
          consumeState: async () => null,
          upsertConnection: async () => ({}),
          markConnectionError: async () => ({ count: 0 }),
          encryptSecret: (value) => value,
          decryptSecret: (value) => value,
          getProviderAdapter: () => ({
            providerId: "godaddy_pos",
            isConfigured: () => true,
            buildAuthorizationUrl: () => "",
            exchangeCodeForTokens: async () => ({ accessToken: "unused" }),
          }),
        }
      ),
    /Invalid or expired OAuth state/
  );
});
