const SERPER_SEARCH_URL = "https://google.serper.dev/search";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const SERPER_TIMEOUT_MS = 4500;
const GEMINI_TIMEOUT_MS = 6500;
const SERPER_MAX_ATTEMPTS = 2;
const SERPER_RETRY_BASE_DELAY_MS = 900;
const SERPER_MIN_COOLDOWN_MS = 15000;
const SERPER_TIMEOUT_COOLDOWN_MS = 10000;

type ShoppingWebFallbackProviderMeta = {
  serper: {
    attempts: number;
    duration_ms: number;
    retried: boolean;
    throttled: boolean;
    cooldown_ms_remaining: number | null;
    timed_out: boolean;
    http_status: number | null;
    error_code: string | null;
  };
  parser: {
    mode: "none" | "deterministic" | "gemini";
    gemini_attempted: boolean;
    gemini_duration_ms: number | null;
  };
};

type SerperSearchOutcome =
  | {
      kind: "ok";
      candidates: ShoppingWebSearchCandidate[];
      meta: ShoppingWebFallbackProviderMeta["serper"];
    }
  | {
      kind: "throttled";
      rationale: string;
      meta: ShoppingWebFallbackProviderMeta["serper"];
    }
  | {
      kind: "error";
      rationale: string;
      meta: ShoppingWebFallbackProviderMeta["serper"];
    };

let serperCooldownUntilMs = 0;

export type ShoppingWebSearchCandidate = {
  title: string;
  link: string;
  snippet: string;
};

export type ShoppingWebFallbackStructuredFields = {
  canonical_name: string;
  brand: string | null;
  size: string | null;
  unit: string | null;
  pack_count: number | null;
};

export type ShoppingWebFallbackResult =
  | {
      status: "unavailable";
      provider: "none";
      query: string;
      reason:
        | "provider_not_configured"
        | "no_query_terms"
        | "provider_throttled"
        | "provider_error";
      candidates: [];
      structured: null;
      confidence_score: 0;
      confidence_label: "none";
      rationale: string;
      provider_meta: ShoppingWebFallbackProviderMeta | null;
    }
  | {
      status: "no_results";
      provider: "serper";
      query: string;
      candidates: [];
      structured: null;
      confidence_score: 0;
      confidence_label: "none";
      rationale: string;
      provider_meta: ShoppingWebFallbackProviderMeta | null;
    }
  | {
      status: "ok";
      provider: "serper";
      query: string;
      candidates: ShoppingWebSearchCandidate[];
      structured: ShoppingWebFallbackStructuredFields;
      confidence_score: number;
      confidence_label: "low" | "medium" | "high";
      rationale: string;
      provider_meta: ShoppingWebFallbackProviderMeta | null;
    };

type ConstrainedWebFallbackParams = {
  parsed_item_text: string;
  store_name?: string | null;
  barcode?: string | null;
  brand_hint?: string | null;
  pack_size_hint?: string | null;
  max_results?: number;
};

type ShoppingWebFallbackOutcomeBucket =
  | "success"
  | "no_results"
  | "throttled"
  | "error"
  | "unavailable_other";

type LatencyAccumulator = {
  count: number;
  total_ms: number;
  max_ms: number;
};

type ShoppingWebFallbackMetricsState = {
  started_at_ms: number;
  last_emitted_at_ms: number;
  calls_since_last_emit: number;
  total_calls: number;
  status_counts: Record<ShoppingWebFallbackResult["status"], number>;
  outcome_bucket_counts: Record<ShoppingWebFallbackOutcomeBucket, number>;
  unavailable_reason_counts: Record<
    Extract<ShoppingWebFallbackResult, { status: "unavailable" }>["reason"],
    number
  >;
  parser_mode_counts: Record<ShoppingWebFallbackProviderMeta["parser"]["mode"], number>;
  serper_attempt_histogram: Record<string, number>;
  serper_retried_count: number;
  serper_throttled_count: number;
  serper_timed_out_count: number;
  latency_total: LatencyAccumulator;
  latency_serper: LatencyAccumulator;
  latency_gemini: LatencyAccumulator;
};

const WEB_FALLBACK_METRICS_LOG_EVERY_CALLS = 10;
const WEB_FALLBACK_METRICS_LOG_INTERVAL_MS = 5 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nowMs(): number {
  return Date.now();
}

function elapsedMs(startedAtMs: number): number {
  return Math.max(0, nowMs() - startedAtMs);
}

function createLatencyAccumulator(): LatencyAccumulator {
  return {
    count: 0,
    total_ms: 0,
    max_ms: 0,
  };
}

function createShoppingWebFallbackMetricsState(): ShoppingWebFallbackMetricsState {
  const startedAt = nowMs();
  return {
    started_at_ms: startedAt,
    last_emitted_at_ms: startedAt,
    calls_since_last_emit: 0,
    total_calls: 0,
    status_counts: {
      ok: 0,
      no_results: 0,
      unavailable: 0,
    },
    outcome_bucket_counts: {
      success: 0,
      no_results: 0,
      throttled: 0,
      error: 0,
      unavailable_other: 0,
    },
    unavailable_reason_counts: {
      provider_not_configured: 0,
      no_query_terms: 0,
      provider_throttled: 0,
      provider_error: 0,
    },
    parser_mode_counts: {
      none: 0,
      deterministic: 0,
      gemini: 0,
    },
    serper_attempt_histogram: {},
    serper_retried_count: 0,
    serper_throttled_count: 0,
    serper_timed_out_count: 0,
    latency_total: createLatencyAccumulator(),
    latency_serper: createLatencyAccumulator(),
    latency_gemini: createLatencyAccumulator(),
  };
}

let shoppingWebFallbackMetrics = createShoppingWebFallbackMetricsState();

function addLatencySample(acc: LatencyAccumulator, durationMs: number | null | undefined): void {
  if (!Number.isFinite(durationMs)) return;
  const value = Math.max(0, Math.round(Number(durationMs)));
  acc.count += 1;
  acc.total_ms += value;
  acc.max_ms = Math.max(acc.max_ms, value);
}

function summarizeLatency(acc: LatencyAccumulator): {
  count: number;
  avg_ms: number | null;
  max_ms: number | null;
} {
  return {
    count: acc.count,
    avg_ms: acc.count > 0 ? Math.round((acc.total_ms / acc.count) * 10) / 10 : null,
    max_ms: acc.count > 0 ? acc.max_ms : null,
  };
}

function classifyWebFallbackOutcomeBucket(
  result: ShoppingWebFallbackResult
): ShoppingWebFallbackOutcomeBucket {
  if (result.status === "ok") return "success";
  if (result.status === "no_results") return "no_results";
  if (result.status === "unavailable" && result.reason === "provider_throttled") {
    return "throttled";
  }
  if (result.status === "unavailable" && result.reason === "provider_error") {
    return "error";
  }
  return "unavailable_other";
}

function maybeEmitShoppingWebFallbackMetricsSummary(): void {
  const now = nowMs();
  const dueByCount =
    shoppingWebFallbackMetrics.calls_since_last_emit >= WEB_FALLBACK_METRICS_LOG_EVERY_CALLS;
  const dueByTime =
    now - shoppingWebFallbackMetrics.last_emitted_at_ms >= WEB_FALLBACK_METRICS_LOG_INTERVAL_MS;
  const shouldEmit =
    shoppingWebFallbackMetrics.total_calls === 1 || dueByCount || dueByTime;

  if (!shouldEmit) return;

  console.info("[shopping-web-fallback] aggregate metrics", {
    window_started_at: new Date(shoppingWebFallbackMetrics.started_at_ms).toISOString(),
    total_calls: shoppingWebFallbackMetrics.total_calls,
    calls_since_last_emit: shoppingWebFallbackMetrics.calls_since_last_emit,
    status_counts: shoppingWebFallbackMetrics.status_counts,
    outcome_bucket_counts: shoppingWebFallbackMetrics.outcome_bucket_counts,
    unavailable_reason_counts: shoppingWebFallbackMetrics.unavailable_reason_counts,
    parser_mode_counts: shoppingWebFallbackMetrics.parser_mode_counts,
    serper_attempt_histogram: shoppingWebFallbackMetrics.serper_attempt_histogram,
    serper_retried_count: shoppingWebFallbackMetrics.serper_retried_count,
    serper_throttled_count: shoppingWebFallbackMetrics.serper_throttled_count,
    serper_timed_out_count: shoppingWebFallbackMetrics.serper_timed_out_count,
    latency_ms: {
      total: summarizeLatency(shoppingWebFallbackMetrics.latency_total),
      serper: summarizeLatency(shoppingWebFallbackMetrics.latency_serper),
      gemini: summarizeLatency(shoppingWebFallbackMetrics.latency_gemini),
    },
  });

  shoppingWebFallbackMetrics.last_emitted_at_ms = now;
  shoppingWebFallbackMetrics.calls_since_last_emit = 0;
}

function recordShoppingWebFallbackMetrics(
  result: ShoppingWebFallbackResult,
  totalDurationMs: number
): void {
  shoppingWebFallbackMetrics.total_calls += 1;
  shoppingWebFallbackMetrics.calls_since_last_emit += 1;
  shoppingWebFallbackMetrics.status_counts[result.status] += 1;
  shoppingWebFallbackMetrics.outcome_bucket_counts[classifyWebFallbackOutcomeBucket(result)] += 1;
  if (result.status === "unavailable") {
    shoppingWebFallbackMetrics.unavailable_reason_counts[result.reason] += 1;
  }

  addLatencySample(shoppingWebFallbackMetrics.latency_total, totalDurationMs);

  const providerMeta = result.provider_meta;
  if (providerMeta) {
    const attemptsKey = String(Math.max(0, providerMeta.serper.attempts));
    shoppingWebFallbackMetrics.serper_attempt_histogram[attemptsKey] =
      (shoppingWebFallbackMetrics.serper_attempt_histogram[attemptsKey] ?? 0) + 1;

    if (providerMeta.serper.retried) shoppingWebFallbackMetrics.serper_retried_count += 1;
    if (providerMeta.serper.throttled) shoppingWebFallbackMetrics.serper_throttled_count += 1;
    if (providerMeta.serper.timed_out) shoppingWebFallbackMetrics.serper_timed_out_count += 1;

    shoppingWebFallbackMetrics.parser_mode_counts[providerMeta.parser.mode] += 1;
    if (providerMeta.serper.attempts > 0) {
      addLatencySample(shoppingWebFallbackMetrics.latency_serper, providerMeta.serper.duration_ms);
    }
    addLatencySample(
      shoppingWebFallbackMetrics.latency_gemini,
      providerMeta.parser.gemini_duration_ms
    );
  } else {
    shoppingWebFallbackMetrics.parser_mode_counts.none += 1;
    const attemptsKey = "0";
    shoppingWebFallbackMetrics.serper_attempt_histogram[attemptsKey] =
      (shoppingWebFallbackMetrics.serper_attempt_histogram[attemptsKey] ?? 0) + 1;
  }

  maybeEmitShoppingWebFallbackMetricsSummary();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSpace(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function getSerperCooldownRemainingMs(): number {
  return Math.max(0, serperCooldownUntilMs - nowMs());
}

function setSerperCooldown(ms: number): number {
  const cooldownMs = Math.max(1000, Math.round(ms));
  serperCooldownUntilMs = Math.max(serperCooldownUntilMs, nowMs() + cooldownMs);
  return getSerperCooldownRemainingMs();
}

function parseRetryAfterMs(retryAfterHeader: string | null, fallbackMs: number): number {
  if (!retryAfterHeader) return fallbackMs;

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.round(asSeconds * 1000);
  }

  const parsedDateMs = Date.parse(retryAfterHeader);
  if (!Number.isNaN(parsedDateMs)) {
    const delta = parsedDateMs - nowMs();
    if (delta > 0) return Math.round(delta);
  }

  return fallbackMs;
}

function classifyFetchErrorCode(error: unknown): string {
  const message = normalizeSpace(error instanceof Error ? error.message : String(error));
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError") return "timeout";
  if (/timeout/i.test(message)) return "timeout";
  if (/fetch failed|network|socket|econnreset|enotfound|etimedout/i.test(message)) {
    return "network_error";
  }
  return "unknown_error";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(100, timeoutMs));
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function makeProviderMeta(
  overrides?: Partial<ShoppingWebFallbackProviderMeta>
): ShoppingWebFallbackProviderMeta {
  return {
    serper: {
      attempts: 0,
      duration_ms: 0,
      retried: false,
      throttled: false,
      cooldown_ms_remaining: null,
      timed_out: false,
      http_status: null,
      error_code: null,
      ...(overrides?.serper ?? {}),
    },
    parser: {
      mode: "none",
      gemini_attempted: false,
      gemini_duration_ms: null,
      ...(overrides?.parser ?? {}),
    },
  };
}

function inferPackSizeHintFromText(text: string): string | null {
  const normalized = normalizeSpace(text);
  if (!normalized) return null;

  const packMatch = normalized.match(
    /(\d+)\s*(?:x|pack|pk|ct|count)\s*(\d+(?:\.\d+)?\s?(?:oz|g|kg|lb|ml|l|fl\s?oz))?/i
  );
  if (packMatch) {
    const count = packMatch[1];
    const size = packMatch[2] ? normalizeSpace(packMatch[2]) : "";
    return size ? `${count} x ${size}` : `${count} pack`;
  }

  const sizeMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s?(oz|g|kg|lb|ml|l|fl\s?oz|ct|count)\b/i
  );
  if (!sizeMatch) return null;
  return `${sizeMatch[1]} ${sizeMatch[2].toLowerCase().replace(/\s+/g, " ")}`;
}

function inferBrandHintFromText(text: string): string | null {
  const tokens = normalizeSpace(text).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  const first = tokens[0];
  if (/^\d+$/.test(first)) return null;
  if (first.length < 3) return null;
  if (/^(organic|fresh|large|small|medium|family|value)$/i.test(first)) return null;
  return titleCase(first.replace(/[^a-z0-9'-]/gi, ""));
}

function buildConstrainedQuery(params: ConstrainedWebFallbackParams): string {
  const parts = [
    normalizeSpace(params.parsed_item_text),
    normalizeSpace(params.store_name),
    normalizeSpace(params.brand_hint),
    normalizeSpace(params.pack_size_hint),
  ].filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(part);
  }

  // "product" nudges structured search toward retail item pages/search summaries.
  const query = [...deduped, "product"].join(" ").trim();
  return query.slice(0, 220);
}

async function searchWithSerper(
  query: string,
  maxResults: number
): Promise<SerperSearchOutcome | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  const cooldownRemaining = getSerperCooldownRemainingMs();
  if (cooldownRemaining > 0) {
    const meta: ShoppingWebFallbackProviderMeta["serper"] = {
      attempts: 0,
      duration_ms: 0,
      retried: false,
      throttled: true,
      cooldown_ms_remaining: cooldownRemaining,
      timed_out: false,
      http_status: 429,
      error_code: "cooldown_active",
    };
    console.warn("[shopping-web-fallback] serper cooldown active", {
      cooldown_ms_remaining: cooldownRemaining,
      query_preview: query.slice(0, 80),
    });
    return {
      kind: "throttled",
      rationale:
        "Structured web fallback is temporarily cooling down after provider rate limiting. Try again shortly.",
      meta,
    };
  }

  const startedAt = nowMs();
  let attempts = 0;
  let timedOut = false;
  let lastHttpStatus: number | null = null;
  let lastErrorCode: string | null = null;

  for (let attempt = 1; attempt <= SERPER_MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt;
    try {
      const response = await fetchWithTimeout(
        SERPER_SEARCH_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": apiKey,
          },
          body: JSON.stringify({
            q: query,
            num: clamp(maxResults, 1, 8),
            autocorrect: false,
            gl: "us",
            hl: "en",
          }),
        },
        SERPER_TIMEOUT_MS
      );

      lastHttpStatus = response.status;

      if (response.status === 429) {
        const cooldownMs = setSerperCooldown(
          parseRetryAfterMs(response.headers.get("Retry-After"), SERPER_MIN_COOLDOWN_MS)
        );
        const meta: ShoppingWebFallbackProviderMeta["serper"] = {
          attempts,
          duration_ms: elapsedMs(startedAt),
          retried: attempts > 1,
          throttled: true,
          cooldown_ms_remaining: cooldownMs,
          timed_out: false,
          http_status: response.status,
          error_code: "rate_limited",
        };
        console.warn("[shopping-web-fallback] serper rate limited", {
          attempts,
          cooldown_ms: cooldownMs,
          query_preview: query.slice(0, 80),
        });
        return {
          kind: "throttled",
          rationale:
            "Structured web fallback provider is rate-limited right now. Try again after a short cooldown.",
          meta,
        };
      }

      if (!response.ok) {
        lastErrorCode = `http_${response.status}`;
        const retriable = response.status >= 500 && response.status <= 599;
        if (retriable && attempt < SERPER_MAX_ATTEMPTS) {
          const delayMs = SERPER_RETRY_BASE_DELAY_MS * attempt;
          await sleep(delayMs);
          continue;
        }

        const meta: ShoppingWebFallbackProviderMeta["serper"] = {
          attempts,
          duration_ms: elapsedMs(startedAt),
          retried: attempts > 1,
          throttled: false,
          cooldown_ms_remaining: null,
          timed_out: timedOut,
          http_status: response.status,
          error_code: lastErrorCode,
        };
        console.warn("[shopping-web-fallback] serper search failed", {
          status: response.status,
          attempts,
          query_preview: query.slice(0, 80),
        });
        return {
          kind: "error",
          rationale: `Structured web search provider returned HTTP ${response.status}.`,
          meta,
        };
      }

      const data = await response.json();
      const organic = Array.isArray(data?.organic) ? data.organic : [];
      const candidates = organic
        .slice(0, maxResults)
        .map((row: unknown) => {
          const record = row as Record<string, unknown>;
          return {
            title: normalizeSpace(String(record.title ?? "")),
            link: normalizeSpace(String(record.link ?? "")),
            snippet: normalizeSpace(String(record.snippet ?? "")),
          };
        })
        .filter((row: ShoppingWebSearchCandidate) => row.title && row.link);

      const meta: ShoppingWebFallbackProviderMeta["serper"] = {
        attempts,
        duration_ms: elapsedMs(startedAt),
        retried: attempts > 1,
        throttled: false,
        cooldown_ms_remaining: null,
          timed_out: timedOut,
        http_status: response.status,
        error_code: null,
      };
      console.info("[shopping-web-fallback] serper search complete", {
        attempts,
        duration_ms: meta.duration_ms,
        candidate_count: candidates.length,
        query_preview: query.slice(0, 80),
      });
      return {
        kind: "ok",
        candidates,
        meta,
      };
    } catch (error) {
      lastErrorCode = classifyFetchErrorCode(error);
      if (lastErrorCode === "timeout") timedOut = true;

      const retriable = lastErrorCode === "timeout" || lastErrorCode === "network_error";
      if (retriable && attempt < SERPER_MAX_ATTEMPTS) {
        const delayMs = SERPER_RETRY_BASE_DELAY_MS * attempt;
        await sleep(delayMs);
        continue;
      }

      if (lastErrorCode === "timeout") {
        setSerperCooldown(SERPER_TIMEOUT_COOLDOWN_MS);
      }

      const meta: ShoppingWebFallbackProviderMeta["serper"] = {
        attempts,
        duration_ms: elapsedMs(startedAt),
        retried: attempts > 1,
        throttled: false,
        cooldown_ms_remaining:
          lastErrorCode === "timeout" ? getSerperCooldownRemainingMs() : null,
        timed_out: timedOut,
        http_status: lastHttpStatus,
        error_code: lastErrorCode,
      };

      console.warn("[shopping-web-fallback] serper fetch error", {
        error_code: lastErrorCode,
        attempts,
        duration_ms: meta.duration_ms,
        query_preview: query.slice(0, 80),
      });

      return {
        kind: "error",
        rationale:
          lastErrorCode === "timeout"
            ? "Structured web search timed out."
            : "Structured web search failed due to a transient provider/network error.",
        meta,
      };
    }
  }

  return {
    kind: "error",
    rationale: "Structured web search failed unexpectedly.",
    meta: {
      attempts,
      duration_ms: elapsedMs(startedAt),
      retried: attempts > 1,
      throttled: false,
      cooldown_ms_remaining: null,
      timed_out: timedOut,
      http_status: lastHttpStatus,
      error_code: lastErrorCode ?? "unexpected",
    },
  };
}

function parseStructuredFieldsDeterministically(
  params: ConstrainedWebFallbackParams,
  candidates: ShoppingWebSearchCandidate[]
): {
  structured: ShoppingWebFallbackStructuredFields;
  confidence_score: number;
  confidence_label: "low" | "medium" | "high";
  rationale: string;
} {
  const first = candidates[0];
  const sourceText = normalizeSpace(
    `${first?.title ?? ""} ${first?.snippet ?? ""} ${params.parsed_item_text}`
  );
  const brand =
    normalizeSpace(params.brand_hint) || inferBrandHintFromText(first?.title ?? "") || null;
  const size = normalizeSpace(params.pack_size_hint) || inferPackSizeHintFromText(sourceText);

  let unit: string | null = null;
  if (size) {
    const unitMatch = size.match(/\b(oz|g|kg|lb|ml|l|fl oz|ct|count)\b/i);
    unit = unitMatch ? unitMatch[1].toLowerCase() : null;
  }

  let packCount: number | null = null;
  const packMatch = sourceText.match(/\b(\d+)\s*(?:pack|pk|ct|count|x)\b/i);
  if (packMatch) {
    const parsed = parseInt(packMatch[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) packCount = parsed;
  }

  const canonicalName = titleCase(
    normalizeSpace(
      (first?.title ?? "")
        .replace(/\s*\|\s.*$/, "")
        .replace(/\s*-\s.*$/, "")
        .replace(/\b(?:buy|shop|online)\b.*$/i, "")
    ) || params.parsed_item_text
  ).slice(0, 120);

  let confidence = 0.42;
  if (brand) confidence += 0.14;
  if (size) confidence += 0.12;
  if (packCount != null) confidence += 0.06;
  if (candidates.length >= 3) confidence += 0.06;
  if (first?.snippet) confidence += 0.05;

  const confidenceScore = clamp(confidence, 0.2, 0.78);
  const confidenceLabel =
    confidenceScore >= 0.8 ? "high" : confidenceScore >= 0.55 ? "medium" : "low";

  return {
    structured: {
      canonical_name: canonicalName || "Unknown Product",
      brand: brand || null,
      size: size || null,
      unit,
      pack_count: packCount,
    },
    confidence_score: confidenceScore,
    confidence_label: confidenceLabel,
    rationale: "Deterministic structured extraction from top search results (no AI parser configured).",
  };
}

async function parseStructuredFieldsWithGemini(params: {
  parsed_item_text: string;
  store_name?: string | null;
  barcode?: string | null;
  candidates: ShoppingWebSearchCandidate[];
}): Promise<{
  structured: ShoppingWebFallbackStructuredFields;
  confidence_score: number;
  confidence_label: "low" | "medium" | "high";
  rationale: string;
} | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GOOGLE_VISION;
  if (!apiKey) return null;

  const prompt = `You are a product resolver assistant for inventory intake.
Given structured web search results and receipt context, infer a likely canonical product description.
Return ONLY valid JSON with this schema:
{
  "canonical_name": "string",
  "brand": "string or empty",
  "size": "string or empty",
  "unit": "string or empty",
  "pack_count": 0,
  "confidence_score": 0.0,
  "confidence_label": "low|medium|high",
  "rationale": "short explanation"
}

Rules:
- Use only evidence present in the search results and receipt context.
- Do not invent product facts.
- If uncertain, lower confidence.
- Keep canonical_name concise and product-like.

Receipt context:
- parsed_item_text: ${params.parsed_item_text}
- store_name: ${params.store_name ?? ""}
- barcode: ${params.barcode ?? ""}

Structured web results (JSON):
${JSON.stringify(params.candidates.slice(0, 5))}
`;

  const response = await fetchWithTimeout(
    `${GEMINI_API_URL}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 320,
        },
      }),
    },
    GEMINI_TIMEOUT_MS
  );

  if (!response.ok) return null;
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const cleaned = String(text)
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const confidenceScore = clamp(Number(parsed.confidence_score) || 0, 0, 1);
  const labelRaw = String(parsed.confidence_label ?? "low").toLowerCase();
  const confidenceLabel: "low" | "medium" | "high" =
    labelRaw === "high" || labelRaw === "medium" ? labelRaw : "low";
  const packCountNum = Number(parsed.pack_count);

  return {
    structured: {
      canonical_name: normalizeSpace(String(parsed.canonical_name ?? "")).slice(0, 120) || "Unknown Product",
      brand: normalizeSpace(String(parsed.brand ?? "")).slice(0, 60) || null,
      size: normalizeSpace(String(parsed.size ?? "")).slice(0, 40) || null,
      unit: normalizeSpace(String(parsed.unit ?? "")).slice(0, 24).toLowerCase() || null,
      pack_count:
        Number.isFinite(packCountNum) && packCountNum > 0 ? Math.round(packCountNum) : null,
    },
    confidence_score: confidenceScore,
    confidence_label: confidenceLabel,
    rationale:
      normalizeSpace(String(parsed.rationale ?? "")).slice(0, 240) ||
      "Gemini parsed structured fields from search results.",
  };
}

export async function runConstrainedShoppingProductWebFallback(
  rawParams: ConstrainedWebFallbackParams
): Promise<ShoppingWebFallbackResult> {
  const startedAt = nowMs();
  const finalize = <T extends ShoppingWebFallbackResult>(result: T): T => {
    recordShoppingWebFallbackMetrics(result, elapsedMs(startedAt));
    return result;
  };

  const params: ConstrainedWebFallbackParams = {
    ...rawParams,
    parsed_item_text: normalizeSpace(rawParams.parsed_item_text),
    store_name: normalizeSpace(rawParams.store_name),
    barcode: normalizeSpace(rawParams.barcode),
    brand_hint: normalizeSpace(rawParams.brand_hint) || inferBrandHintFromText(rawParams.parsed_item_text),
    pack_size_hint:
      normalizeSpace(rawParams.pack_size_hint) || inferPackSizeHintFromText(rawParams.parsed_item_text),
    max_results: rawParams.max_results ?? 5,
  };

  const query = buildConstrainedQuery(params);
  if (!query) {
    return finalize({
      status: "unavailable",
      provider: "none",
      query: "",
      reason: "no_query_terms",
      candidates: [],
      structured: null,
      confidence_score: 0,
      confidence_label: "none",
      rationale: "No usable query terms were available for structured web search.",
      provider_meta: makeProviderMeta(),
    });
  }

  if (!process.env.SERPER_API_KEY) {
    return finalize({
      status: "unavailable",
      provider: "none",
      query,
      reason: "provider_not_configured",
      candidates: [],
      structured: null,
      confidence_score: 0,
      confidence_label: "none",
      rationale: "SERPER_API_KEY is not configured; structured web fallback is disabled.",
      provider_meta: makeProviderMeta(),
    });
  }

  const serper = await searchWithSerper(query, params.max_results ?? 5);
  if (!serper) {
    return finalize({
      status: "unavailable",
      provider: "none",
      query,
      reason: "provider_not_configured",
      candidates: [],
      structured: null,
      confidence_score: 0,
      confidence_label: "none",
      rationale: "SERPER_API_KEY is not configured; structured web fallback is disabled.",
      provider_meta: makeProviderMeta(),
    });
  }

  if (serper.kind === "throttled") {
    return finalize({
      status: "unavailable",
      provider: "none",
      query,
      reason: "provider_throttled",
      candidates: [],
      structured: null,
      confidence_score: 0,
      confidence_label: "none",
      rationale: serper.rationale,
      provider_meta: makeProviderMeta({
        serper: serper.meta,
      }),
    });
  }

  if (serper.kind === "error") {
    return finalize({
      status: "unavailable",
      provider: "none",
      query,
      reason: "provider_error",
      candidates: [],
      structured: null,
      confidence_score: 0,
      confidence_label: "none",
      rationale: serper.rationale,
      provider_meta: makeProviderMeta({
        serper: serper.meta,
      }),
    });
  }

  const candidates = serper.candidates;
  if (candidates.length === 0) {
    return finalize({
      status: "no_results",
      provider: "serper",
      query,
      candidates: [],
      structured: null,
      confidence_score: 0,
      confidence_label: "none",
      rationale: "Structured web search returned no candidate products.",
      provider_meta: makeProviderMeta({
        serper: serper.meta,
      }),
    });
  }

  const geminiConfigured = Boolean(process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GOOGLE_VISION);
  const geminiStartedAt = geminiConfigured ? nowMs() : 0;
  let parsed:
    | {
        structured: ShoppingWebFallbackStructuredFields;
        confidence_score: number;
        confidence_label: "low" | "medium" | "high";
        rationale: string;
      }
    | null = null;
  let parserMode: ShoppingWebFallbackProviderMeta["parser"]["mode"] = "none";
  let geminiDurationMs: number | null = null;
  if (geminiConfigured) {
    try {
      parsed = await parseStructuredFieldsWithGemini({
        parsed_item_text: params.parsed_item_text,
        store_name: params.store_name,
        barcode: params.barcode,
        candidates,
      });
    } catch (error) {
      const errorCode = classifyFetchErrorCode(error);
      console.warn("[shopping-web-fallback] gemini parser failed; using deterministic parser", {
        error_code: errorCode,
        query_preview: query.slice(0, 80),
      });
      parsed = null;
    } finally {
      geminiDurationMs = elapsedMs(geminiStartedAt);
    }
  }
  if (!parsed) {
    parsed = parseStructuredFieldsDeterministically(params, candidates);
    parserMode = "deterministic";
  } else {
    parserMode = "gemini";
  }

  const providerMeta = makeProviderMeta({
    serper: serper.meta,
    parser: {
      mode: parserMode,
      gemini_attempted: geminiConfigured,
      gemini_duration_ms: geminiDurationMs,
    },
  });

  console.info("[shopping-web-fallback] result ready", {
    status: "ok",
    serper_attempts: serper.meta.attempts,
    serper_duration_ms: serper.meta.duration_ms,
    parser_mode: providerMeta.parser.mode,
    gemini_duration_ms: providerMeta.parser.gemini_duration_ms,
    confidence_label: parsed.confidence_label,
    confidence_score: clamp(parsed.confidence_score, 0, 1),
  });

  return finalize({
    status: "ok",
    provider: "serper",
    query,
    candidates,
    structured: parsed.structured,
    confidence_score: clamp(parsed.confidence_score, 0, 1),
    confidence_label: parsed.confidence_label,
    rationale: parsed.rationale,
    provider_meta: providerMeta,
  });
}
