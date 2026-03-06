import type {
  IncomeOAuthProviderAdapter,
  IncomeOAuthStartParams,
  IncomeOAuthTokenExchangeParams,
  IncomeOAuthTokenExchangeResult,
} from "./registry";

const UBER_EATS_PROVIDER_ID = "uber_eats";
const DEFAULT_AUTHORIZATION_CODE_SCOPES = ["eats.pos_provisioning"];
const DEFAULT_CLIENT_CREDENTIAL_SCOPES = ["eats.store", "eats.report"];

interface UberEatsOAuthEnvConfig {
  clientId: string | null;
  clientSecret: string | null;
  authorizationUrl: string | null;
  tokenUrl: string | null;
}

export interface UberEatsClientCredentialsTokenResult {
  accessToken: string;
  expiresInSeconds: number | null;
  scopes: string[];
  rawPayload: Record<string, unknown>;
}

export interface UberEatsStoreSummary {
  id: string;
  name: string | null;
  displayName: string | null;
  city: string | null;
  address: string | null;
  integrationEnabled: boolean;
  integratorStoreId: string | null;
  isOrderManagerPending: boolean;
  rawPayload: Record<string, unknown>;
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseScopeList(scopeValue: string | null | undefined): string[] {
  if (typeof scopeValue !== "string") return [];
  return scopeValue
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readUberEatsOAuthEnvConfig(): UberEatsOAuthEnvConfig {
  return {
    clientId: process.env.INCOME_OAUTH_UBER_EATS_CLIENT_ID ?? null,
    clientSecret: process.env.INCOME_OAUTH_UBER_EATS_CLIENT_SECRET ?? null,
    authorizationUrl: process.env.INCOME_OAUTH_UBER_EATS_AUTH_URL ?? null,
    tokenUrl: process.env.INCOME_OAUTH_UBER_EATS_TOKEN_URL ?? null,
  };
}

function assertUberEatsOAuthConfigured(config: UberEatsOAuthEnvConfig): void {
  if (!config.clientId || !config.clientSecret || !config.authorizationUrl || !config.tokenUrl) {
    throw new Error(
      "OAuth for provider \"uber_eats\" is not configured. Set INCOME_OAUTH_UBER_EATS_* env vars."
    );
  }
}

function sanitizeTokenMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...payload };
  delete clone.access_token;
  delete clone.refresh_token;
  delete clone.id_token;
  return clone;
}

function normalizeUberEatsTokenPayload(
  payload: Record<string, unknown>,
  requestedScopes: string[]
): IncomeOAuthTokenExchangeResult {
  const accessToken = parseOptionalString(payload.access_token);
  if (!accessToken) {
    throw new Error("OAuth token exchange for \"uber_eats\" returned no access_token");
  }

  const refreshToken = parseOptionalString(payload.refresh_token);
  const expiresInRaw = Number(payload.expires_in);
  const expiresInSeconds = Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : null;
  const scopes = parseScopeList(parseOptionalString(payload.scope) ?? null);
  const metadata = sanitizeTokenMetadata(payload);

  return {
    accessToken,
    refreshToken,
    expiresInSeconds,
    scopes: scopes.length > 0 ? scopes : requestedScopes,
    externalAccountId:
      parseOptionalString(payload.account_id) ??
      parseOptionalString(payload.merchant_id),
    externalLocationId:
      parseOptionalString(payload.location_id) ??
      parseOptionalString(payload.store_id),
    displayName:
      parseOptionalString(payload.account_name) ??
      parseOptionalString(payload.merchant_name),
    metadata,
  };
}

function isSandboxHost(url: string): boolean {
  return url.includes("sandbox-login.uber.com") || url.includes("sandbox-auth.uber.com");
}

export function getUberEatsAuthorizationCodeScopes(): string[] {
  const configuredScopes = parseScopeList(process.env.INCOME_OAUTH_UBER_EATS_SCOPES ?? "");
  return configuredScopes.length > 0 ? configuredScopes : [...DEFAULT_AUTHORIZATION_CODE_SCOPES];
}

export function getUberEatsClientCredentialScopes(): string[] {
  const configuredScopes = parseScopeList(process.env.INCOME_UBER_EATS_CLIENT_SCOPES ?? "");
  return configuredScopes.length > 0 ? configuredScopes : [...DEFAULT_CLIENT_CREDENTIAL_SCOPES];
}

export function getUberEatsApiBaseUrl(): string {
  const explicit = parseOptionalString(process.env.INCOME_UBER_EATS_API_BASE_URL);
  if (explicit) return explicit;

  const config = readUberEatsOAuthEnvConfig();
  const hintUrl = config.tokenUrl ?? config.authorizationUrl ?? "";
  return isSandboxHost(hintUrl) ? "https://test-api.uber.com" : "https://api.uber.com";
}

async function fetchJsonOrThrow<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const providerError =
      parseOptionalString(payload.message) ??
      parseOptionalString(payload.error_description) ??
      parseOptionalString(payload.error) ??
      `Uber Eats API request failed (${response.status})`;
    throw new Error(providerError);
  }
  return payload as T;
}

export function createUberEatsOAuthAdapter(): IncomeOAuthProviderAdapter {
  return {
    providerId: UBER_EATS_PROVIDER_ID,
    isConfigured() {
      const config = readUberEatsOAuthEnvConfig();
      return Boolean(
        config.clientId &&
          config.clientSecret &&
          config.authorizationUrl &&
          config.tokenUrl
      );
    },
    buildAuthorizationUrl(params: IncomeOAuthStartParams) {
      const config = readUberEatsOAuthEnvConfig();
      assertUberEatsOAuthConfigured(config);

      const url = new URL(config.authorizationUrl!);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", config.clientId!);
      url.searchParams.set("redirect_uri", params.redirectUri);
      url.searchParams.set("state", params.state);
      url.searchParams.set("scope", getUberEatsAuthorizationCodeScopes().join(" "));
      url.searchParams.set("code_challenge", params.codeChallenge);
      url.searchParams.set("code_challenge_method", params.codeChallengeMethod);

      return url.toString();
    },
    async exchangeCodeForTokens(params: IncomeOAuthTokenExchangeParams) {
      const config = readUberEatsOAuthEnvConfig();
      assertUberEatsOAuthConfigured(config);

      const response = await fetch(config.tokenUrl!, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: params.code,
          redirect_uri: params.redirectUri,
          client_id: config.clientId!,
          client_secret: config.clientSecret!,
          code_verifier: params.codeVerifier,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        const providerError =
          parseOptionalString(payload.error_description ?? payload.error) ??
          "OAuth token exchange failed";
        throw new Error(providerError);
      }

      return normalizeUberEatsTokenPayload(payload, getUberEatsAuthorizationCodeScopes());
    },
  };
}

export async function exchangeUberEatsClientCredentialsToken(options: {
  scopes?: string[];
} = {}): Promise<UberEatsClientCredentialsTokenResult> {
  const config = readUberEatsOAuthEnvConfig();
  assertUberEatsOAuthConfigured(config);

  const requestedScopes = options.scopes?.length
    ? options.scopes
    : getUberEatsClientCredentialScopes();

  const payload = await fetchJsonOrThrow<Record<string, unknown>>(config.tokenUrl!, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId!,
      client_secret: config.clientSecret!,
      scope: requestedScopes.join(" "),
    }),
  });

  const accessToken = parseOptionalString(payload.access_token);
  if (!accessToken) {
    throw new Error("Uber Eats client_credentials token response returned no access_token");
  }

  const expiresInRaw = Number(payload.expires_in);
  const expiresInSeconds = Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : null;
  const scopes = parseScopeList(parseOptionalString(payload.scope) ?? null);

  return {
    accessToken,
    expiresInSeconds,
    scopes: scopes.length > 0 ? scopes : requestedScopes,
    rawPayload: payload,
  };
}

export async function listUberEatsStores(params: {
  accessToken: string;
}): Promise<UberEatsStoreSummary[]> {
  const url = new URL("/v1/eats/stores", getUberEatsApiBaseUrl());
  const payload = await fetchJsonOrThrow<unknown>(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      accept: "application/json",
    },
  });

  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>).stores ??
        (payload as Record<string, unknown>).data ??
        [])
      : [];

  if (!Array.isArray(rows)) return [];

  return rows
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      id: parseOptionalString(entry.store_id) ?? parseOptionalString(entry.id) ?? "",
      name: parseOptionalString(entry.name),
      displayName:
        parseOptionalString(entry.display_name) ??
        parseOptionalString(entry.store_name),
      city:
        parseOptionalString((entry.address as Record<string, unknown> | undefined)?.city) ??
        parseOptionalString(entry.city),
      address:
        parseOptionalString((entry.address as Record<string, unknown> | undefined)?.street_address) ??
        parseOptionalString(entry.address1) ??
        parseOptionalString(entry.address),
      integrationEnabled:
        parseOptionalBoolean((entry.pos_data as Record<string, unknown> | undefined)?.integration_enabled) ??
        false,
      integratorStoreId:
        parseOptionalString((entry.pos_data as Record<string, unknown> | undefined)?.integrator_store_id) ??
        null,
      isOrderManagerPending:
        parseOptionalBoolean((entry.pos_data as Record<string, unknown> | undefined)?.is_order_manager_pending) ??
        false,
      rawPayload: entry,
    }))
    .filter((entry) => Boolean(entry.id));
}

export async function getUberEatsStorePosData(params: {
  accessToken: string;
  storeId: string;
}): Promise<Record<string, unknown>> {
  const url = new URL(`/v1/eats/stores/${params.storeId}/pos_data`, getUberEatsApiBaseUrl());
  return fetchJsonOrThrow<Record<string, unknown>>(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      accept: "application/json",
    },
  });
}

export async function postUberEatsStorePosData(params: {
  accessToken: string;
  storeId: string;
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const url = new URL(`/v1/eats/stores/${params.storeId}/pos_data`, getUberEatsApiBaseUrl());
  return fetchJsonOrThrow<Record<string, unknown>>(url.toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });
}

export async function patchUberEatsStorePosData(params: {
  accessToken: string;
  storeId: string;
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const url = new URL(`/v1/eats/stores/${params.storeId}/pos_data`, getUberEatsApiBaseUrl());
  return fetchJsonOrThrow<Record<string, unknown>>(url.toString(), {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });
}

export async function deleteUberEatsStorePosData(params: {
  accessToken: string;
  storeId: string;
}): Promise<void> {
  const url = new URL(`/v1/eats/stores/${params.storeId}/pos_data`, getUberEatsApiBaseUrl());
  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Uber Eats store deprovision request failed (${response.status})`);
  }
}
