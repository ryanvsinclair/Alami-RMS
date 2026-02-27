import crypto from "node:crypto";
import type { IncomeConnectionStatus, IncomeProvider } from "@/lib/generated/prisma/client";
import {
  INCOME_OAUTH_STATE_TTL_MINUTES,
  INCOME_PROVIDER_CATALOG,
  INCOME_PROVIDER_IDS,
} from "@/features/integrations/shared";
import { getIncomeOAuthProviderAdapter } from "@/features/integrations/providers/registry";
import { consumeIncomeOAuthState, createIncomeOAuthState } from "./oauth-state.repository";
import { markIncomeConnectionError, upsertIncomeConnection } from "./connections.repository";
import { decryptIncomeSecret, encryptIncomeSecret } from "./oauth-crypto";

const providerTypeById = new Map(
  INCOME_PROVIDER_CATALOG.map((provider) => [provider.id, provider.type])
);

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function hashOAuthState(state: string): string {
  return crypto.createHash("sha256").update(state).digest("hex");
}

function createOAuthState(): string {
  return toBase64Url(crypto.randomBytes(32));
}

function createPkceVerifier(): string {
  return toBase64Url(crypto.randomBytes(48));
}

function createPkceChallenge(verifier: string): string {
  return toBase64Url(crypto.createHash("sha256").update(verifier).digest());
}

function sanitizeReturnToPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  return value;
}

function toProviderType(providerId: IncomeProvider): string | null {
  return providerTypeById.get(providerId) ?? null;
}

export function normalizeIncomeProviderId(rawProviderId: string): IncomeProvider | null {
  const providerId = rawProviderId.trim().toLowerCase();
  if (!INCOME_PROVIDER_IDS.includes(providerId as (typeof INCOME_PROVIDER_IDS)[number])) {
    return null;
  }
  return providerId as IncomeProvider;
}

export interface StartIncomeOAuthFlowInput {
  businessId: string;
  userId: string;
  providerId: IncomeProvider;
  redirectUri: string;
  returnToPath?: string | null;
  now?: Date;
}

export interface StartIncomeOAuthFlowResult {
  authorizationUrl: string;
  expiresAt: Date;
  rawState: string;
}

export interface HandleIncomeOAuthCallbackInput {
  businessId: string;
  providerId: IncomeProvider;
  state: string;
  code: string;
  now?: Date;
}

export interface HandleIncomeOAuthCallbackResult {
  returnToPath: string | null;
  connectionStatus: IncomeConnectionStatus;
}

interface OAuthStateRecord {
  id: string;
  business_id: string;
  user_id: string;
  provider_id: IncomeProvider;
  state_hash: string;
  pkce_verifier_encrypted: string | null;
  redirect_uri: string;
  expires_at: Date;
  used_at: Date | null;
  metadata: unknown;
}

interface OAuthServiceDependencies {
  now: () => Date;
  createState: typeof createIncomeOAuthState;
  consumeState: typeof consumeIncomeOAuthState;
  upsertConnection: typeof upsertIncomeConnection;
  markConnectionError: typeof markIncomeConnectionError;
  encryptSecret: typeof encryptIncomeSecret;
  decryptSecret: typeof decryptIncomeSecret;
  getProviderAdapter: typeof getIncomeOAuthProviderAdapter;
}

function resolveDependencies(overrides: Partial<OAuthServiceDependencies> = {}): OAuthServiceDependencies {
  return {
    now: () => new Date(),
    createState: createIncomeOAuthState,
    consumeState: consumeIncomeOAuthState,
    upsertConnection: upsertIncomeConnection,
    markConnectionError: markIncomeConnectionError,
    encryptSecret: encryptIncomeSecret,
    decryptSecret: decryptIncomeSecret,
    getProviderAdapter: getIncomeOAuthProviderAdapter,
    ...overrides,
  };
}

export async function startIncomeOAuthFlow(
  input: StartIncomeOAuthFlowInput,
  deps: Partial<OAuthServiceDependencies> = {}
): Promise<StartIncomeOAuthFlowResult> {
  const resolvedDeps = resolveDependencies(deps);
  const adapter = resolvedDeps.getProviderAdapter(input.providerId);
  if (!adapter.isConfigured()) {
    throw new Error(`OAuth for provider "${input.providerId}" is not configured`);
  }

  const now = input.now ?? resolvedDeps.now();
  const rawState = createOAuthState();
  const stateHash = hashOAuthState(rawState);
  const pkceVerifier = createPkceVerifier();
  const pkceChallenge = createPkceChallenge(pkceVerifier);
  const expiresAt = new Date(now.getTime() + INCOME_OAUTH_STATE_TTL_MINUTES * 60_000);

  await resolvedDeps.createState({
    businessId: input.businessId,
    userId: input.userId,
    providerId: input.providerId,
    stateHash,
    pkceVerifierEncrypted: resolvedDeps.encryptSecret(pkceVerifier),
    redirectUri: input.redirectUri,
    expiresAt,
    metadata: {
      return_to: sanitizeReturnToPath(input.returnToPath),
    },
  });

  const authorizationUrl = adapter.buildAuthorizationUrl({
    state: rawState,
    redirectUri: input.redirectUri,
    codeChallenge: pkceChallenge,
    codeChallengeMethod: "S256",
  });

  return {
    authorizationUrl,
    expiresAt,
    rawState,
  };
}

export async function handleIncomeOAuthCallback(
  input: HandleIncomeOAuthCallbackInput,
  deps: Partial<OAuthServiceDependencies> = {}
): Promise<HandleIncomeOAuthCallbackResult> {
  const resolvedDeps = resolveDependencies(deps);
  const adapter = resolvedDeps.getProviderAdapter(input.providerId);
  if (!adapter.isConfigured()) {
    throw new Error(`OAuth for provider "${input.providerId}" is not configured`);
  }

  const now = input.now ?? resolvedDeps.now();
  const stateHash = hashOAuthState(input.state);
  const oauthStateRecord = (await resolvedDeps.consumeState({
    businessId: input.businessId,
    providerId: input.providerId,
    stateHash,
    now,
  })) as OAuthStateRecord | null;

  if (!oauthStateRecord?.pkce_verifier_encrypted) {
    throw new Error("Invalid or expired OAuth state");
  }

  const pkceVerifier = resolvedDeps.decryptSecret(oauthStateRecord.pkce_verifier_encrypted);

  try {
    const tokenResult = await adapter.exchangeCodeForTokens({
      code: input.code,
      redirectUri: oauthStateRecord.redirect_uri,
      codeVerifier: pkceVerifier,
    });

    const tokenExpiresAt =
      typeof tokenResult.expiresInSeconds === "number" && tokenResult.expiresInSeconds > 0
        ? new Date(now.getTime() + tokenResult.expiresInSeconds * 1000)
        : null;

    await resolvedDeps.upsertConnection({
      businessId: input.businessId,
      providerId: input.providerId,
      providerType: toProviderType(input.providerId),
      displayName: tokenResult.displayName ?? null,
      externalAccountId: tokenResult.externalAccountId ?? null,
      externalLocationId: tokenResult.externalLocationId ?? null,
      status: "connected",
      accessTokenEncrypted: resolvedDeps.encryptSecret(tokenResult.accessToken),
      refreshTokenEncrypted: tokenResult.refreshToken
        ? resolvedDeps.encryptSecret(tokenResult.refreshToken)
        : null,
      tokenExpiresAt,
      scopes: tokenResult.scopes ?? null,
      metadata: tokenResult.metadata ?? null,
    });

    const returnToPath =
      oauthStateRecord.metadata &&
      typeof oauthStateRecord.metadata === "object" &&
      !Array.isArray(oauthStateRecord.metadata)
        ? sanitizeReturnToPath((oauthStateRecord.metadata as Record<string, unknown>).return_to)
        : null;

    return {
      returnToPath,
      connectionStatus: "connected",
    };
  } catch (error) {
    await resolvedDeps.markConnectionError({
      businessId: input.businessId,
      providerId: input.providerId,
      errorCode: "oauth_exchange_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
