import type { IncomeProviderId } from "@/features/integrations/shared";
import { INCOME_PROVIDER_IDS } from "@/features/integrations/shared";

export interface IncomeOAuthStartParams {
  state: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface IncomeOAuthTokenExchangeParams {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface IncomeOAuthTokenExchangeResult {
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
  scopes?: string[];
  externalAccountId?: string | null;
  externalLocationId?: string | null;
  displayName?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IncomeOAuthProviderAdapter {
  providerId: IncomeProviderId;
  isConfigured: () => boolean;
  buildAuthorizationUrl: (params: IncomeOAuthStartParams) => string;
  exchangeCodeForTokens: (
    params: IncomeOAuthTokenExchangeParams
  ) => Promise<IncomeOAuthTokenExchangeResult>;
}

interface OAuthEnvConfig {
  clientId: string | null;
  clientSecret: string | null;
  authorizationUrl: string | null;
  tokenUrl: string | null;
  scopes: string[];
}

function toProviderEnvPrefix(providerId: IncomeProviderId): string {
  return providerId.toUpperCase();
}

function readProviderOAuthEnvConfig(providerId: IncomeProviderId): OAuthEnvConfig {
  const prefix = toProviderEnvPrefix(providerId);

  const clientId = process.env[`INCOME_OAUTH_${prefix}_CLIENT_ID`] ?? null;
  const clientSecret = process.env[`INCOME_OAUTH_${prefix}_CLIENT_SECRET`] ?? null;
  const authorizationUrl = process.env[`INCOME_OAUTH_${prefix}_AUTH_URL`] ?? null;
  const tokenUrl = process.env[`INCOME_OAUTH_${prefix}_TOKEN_URL`] ?? null;
  const scopesRaw = process.env[`INCOME_OAUTH_${prefix}_SCOPES`] ?? "";
  const scopes = scopesRaw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    clientId,
    clientSecret,
    authorizationUrl,
    tokenUrl,
    scopes,
  };
}

function assertProviderConfigured(config: OAuthEnvConfig, providerId: IncomeProviderId): void {
  if (!config.clientId || !config.clientSecret || !config.authorizationUrl || !config.tokenUrl) {
    throw new Error(
      `OAuth for provider "${providerId}" is not configured. Set INCOME_OAUTH_${providerId.toUpperCase()}_* env vars.`
    );
  }
}

function parseScopeList(scopeValue: unknown): string[] {
  if (typeof scopeValue !== "string") return [];
  return scopeValue
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizeTokenMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...payload };
  delete clone.access_token;
  delete clone.refresh_token;
  delete clone.id_token;
  return clone;
}

function createGenericOAuthAdapter(providerId: IncomeProviderId): IncomeOAuthProviderAdapter {
  return {
    providerId,
    isConfigured() {
      const config = readProviderOAuthEnvConfig(providerId);
      return Boolean(
        config.clientId && config.clientSecret && config.authorizationUrl && config.tokenUrl
      );
    },
    buildAuthorizationUrl(params) {
      const config = readProviderOAuthEnvConfig(providerId);
      assertProviderConfigured(config, providerId);

      const url = new URL(config.authorizationUrl!);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", config.clientId!);
      url.searchParams.set("redirect_uri", params.redirectUri);
      url.searchParams.set("state", params.state);
      if (config.scopes.length > 0) {
        url.searchParams.set("scope", config.scopes.join(" "));
      }
      url.searchParams.set("code_challenge", params.codeChallenge);
      url.searchParams.set("code_challenge_method", params.codeChallengeMethod);

      return url.toString();
    },
    async exchangeCodeForTokens(params) {
      const config = readProviderOAuthEnvConfig(providerId);
      assertProviderConfigured(config, providerId);

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
        const providerError = parseOptionalString(payload.error_description ?? payload.error) ?? "OAuth token exchange failed";
        throw new Error(providerError);
      }

      const accessToken = parseOptionalString(payload.access_token);
      if (!accessToken) {
        throw new Error(`OAuth token exchange for "${providerId}" returned no access_token`);
      }

      const refreshToken = parseOptionalString(payload.refresh_token);
      const expiresInRaw = Number(payload.expires_in);
      const expiresInSeconds = Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : null;
      const scopes = parseScopeList(payload.scope);

      return {
        accessToken,
        refreshToken,
        expiresInSeconds,
        scopes,
        externalAccountId:
          parseOptionalString(payload.account_id) ??
          parseOptionalString(payload.merchant_id),
        externalLocationId:
          parseOptionalString(payload.location_id) ??
          parseOptionalString(payload.store_id),
        displayName:
          parseOptionalString(payload.account_name) ??
          parseOptionalString(payload.merchant_name),
        metadata: sanitizeTokenMetadata(payload),
      };
    },
  };
}

const adapterRegistry: Record<IncomeProviderId, IncomeOAuthProviderAdapter> = Object.fromEntries(
  INCOME_PROVIDER_IDS.map((providerId) => [providerId, createGenericOAuthAdapter(providerId)])
) as Record<IncomeProviderId, IncomeOAuthProviderAdapter>;

export function getIncomeOAuthProviderAdapter(
  providerId: IncomeProviderId
): IncomeOAuthProviderAdapter {
  return adapterRegistry[providerId];
}

export function isIncomeProviderOAuthConfigured(providerId: IncomeProviderId): boolean {
  return getIncomeOAuthProviderAdapter(providerId).isConfigured();
}
