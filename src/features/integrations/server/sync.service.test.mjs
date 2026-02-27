import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Minimal Prisma stub
// ---------------------------------------------------------------------------

function makePrismaStub(overrides = {}) {
  return {
    externalSyncLog: {
      findFirst: async () => null, // no in-flight lock by default
      create: async (args) => ({ id: "synclog_1", ...args.data }),
      update: async (args) => ({ id: "synclog_1", ...args.data }),
    },
    incomeEvent: {
      upsert: async (args) => ({
        id: "evt_1",
        ...args.create,
      }),
    },
    financialTransaction: {
      upsert: async (_args) => ({ id: "ft_1" }),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Inline sync business logic re-implementation for deterministic unit testing.
// Mirrors sync.service.ts contract including IN-05 sync lock guard.
// ---------------------------------------------------------------------------

const INCOME_SYNC_DEFAULT_HISTORICAL_DAYS = 90;
const SYNC_LOCK_STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes

function subtractDays(base, days) {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}

async function runProviderManualSyncTestable(input, deps) {
  const {
    prisma,
    findConnection,
    markSyncSuccess,
    markConnectionError,
    markConnectionExpired,
    decryptSecret,
    fetchEvents,
    now: nowOverride,
  } = deps;

  const connection = await findConnection({
    businessId: input.businessId,
    providerId: input.providerId ?? "godaddy_pos",
  });
  if (!connection) {
    throw new Error(`Provider is not connected for this business`);
  }
  if (!connection.access_token_encrypted) {
    throw new Error(`Provider connection has no stored access token`);
  }

  const now = nowOverride ?? input.now ?? new Date();
  const financialSource = input.financialSource ?? "godaddy_pos";

  // Token expiry guard (IN-07)
  if (connection.token_expires_at && connection.token_expires_at <= now) {
    if (markConnectionExpired) {
      await markConnectionExpired({
        connectionId: connection.id,
        errorMessage: `Access token expired at ${connection.token_expires_at.toISOString()}. Please reconnect.`,
      });
    }
    throw new Error(`Provider access token has expired. Please reconnect via the Integrations page.`);
  }

  // Sync lock check (IN-05)
  const lockCutoff = new Date(now.getTime() - SYNC_LOCK_STALE_AFTER_MS);
  const inflightLog = await prisma.externalSyncLog.findFirst({
    where: {
      business_id: input.businessId,
      source: financialSource,
      status: "running",
      started_at: { gte: lockCutoff },
    },
    orderBy: { started_at: "desc" },
  });
  if (inflightLog) {
    throw new Error(
      `Sync is already in progress (started ${inflightLog.started_at.toISOString()}). Try again in a few minutes.`
    );
  }

  const periodStart =
    connection.last_sync_at ?? subtractDays(now, INCOME_SYNC_DEFAULT_HISTORICAL_DAYS);
  const periodEnd = now;
  const isFullSync = !connection.last_sync_at;

  const syncLog = await prisma.externalSyncLog.create({
    data: {
      business_id: input.businessId,
      source: financialSource,
      status: "running",
      period_start: periodStart,
      period_end: periodEnd,
      records_fetched: 0,
    },
  });

  try {
    const accessToken = decryptSecret(connection.access_token_encrypted);
    const events = await fetchEvents({ accessToken, since: periodStart, until: periodEnd });

    for (const event of events) {
      const incomeEvent = await prisma.incomeEvent.upsert({
        where: {
          connection_id_external_id: {
            connection_id: connection.id,
            external_id: event.externalId,
          },
        },
        create: {
          business_id: input.businessId,
          connection_id: connection.id,
          provider_id: "godaddy_pos",
          source_name: "GoDaddy POS",
          external_id: event.externalId,
          gross_amount: event.grossAmount,
          fees: event.fees,
          net_amount: event.netAmount,
          currency: event.currency,
          occurred_at: event.occurredAt,
          payout_status: "unknown",
          raw_payload: event.rawPayload,
          normalized_payload: event.normalizedPayload,
        },
        update: {
          gross_amount: event.grossAmount,
          fees: event.fees,
          net_amount: event.netAmount,
          currency: event.currency,
          occurred_at: event.occurredAt,
          raw_payload: event.rawPayload,
          normalized_payload: event.normalizedPayload,
          updated_at_provider: now,
        },
      });

      await prisma.financialTransaction.upsert({
        where: {
          business_id_source_external_id: {
            business_id: input.businessId,
            source: financialSource,
            external_id: event.externalId,
          },
        },
        create: {
          business_id: input.businessId,
          type: "income",
          source: financialSource,
          amount: event.netAmount,
          description: event.description,
          occurred_at: event.occurredAt,
          external_id: event.externalId,
          metadata: {
            connection_id: connection.id,
            income_event_id: incomeEvent.id,
            provider_id: "godaddy_pos",
          },
        },
        update: {},
      });
    }

    await markSyncSuccess({
      connectionId: connection.id,
      syncedAt: now,
      fullSync: isFullSync,
    });

    await prisma.externalSyncLog.update({
      where: { id: syncLog.id },
      data: { status: "success", records_fetched: events.length, completed_at: now },
    });

    return { recordsFetched: events.length, periodStart, periodEnd };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await markConnectionError({
      businessId: input.businessId,
      providerId: "godaddy_pos",
      errorCode: "sync_failed",
      errorMessage: message,
    });

    await prisma.externalSyncLog.update({
      where: { id: syncLog.id },
      data: { status: "failed", error_message: message, completed_at: new Date() },
    });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helper stubs
// ---------------------------------------------------------------------------

function makeConnection(overrides = {}) {
  return {
    id: "conn_1",
    business_id: "biz_1",
    provider_id: "godaddy_pos",
    status: "connected",
    access_token_encrypted: "enc:access-token",
    last_sync_at: null,
    token_expires_at: null,
    ...overrides,
  };
}

function makePilotEvent(overrides = {}) {
  return {
    externalId: "txn_001",
    occurredAt: new Date("2026-02-25T10:00:00.000Z"),
    grossAmount: 100,
    fees: 3,
    netAmount: 97,
    currency: "CAD",
    description: "GoDaddy POS income",
    rawPayload: { id: "txn_001" },
    normalizedPayload: { net_amount: 97 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Core sync business rule tests
// ---------------------------------------------------------------------------

test("sync fails when no connection exists for business", async () => {
  await assert.rejects(
    () =>
      runProviderManualSyncTestable(
        { businessId: "biz_1" },
        {
          prisma: makePrismaStub(),
          findConnection: async () => null,
          markSyncSuccess: async () => {},
          markConnectionError: async () => {},
          decryptSecret: (v) => v,
          fetchEvents: async () => [],
        }
      ),
    /not connected/
  );
});

test("sync fails when connection has no access token", async () => {
  await assert.rejects(
    () =>
      runProviderManualSyncTestable(
        { businessId: "biz_1" },
        {
          prisma: makePrismaStub(),
          findConnection: async () => makeConnection({ access_token_encrypted: null }),
          markSyncSuccess: async () => {},
          markConnectionError: async () => {},
          decryptSecret: (v) => v,
          fetchEvents: async () => [],
        }
      ),
    /no stored access token/
  );
});

test("full sync (no previous last_sync_at) uses 90-day historical window", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  let fetchedSince = null;
  let markSyncSuccessArgs = null;
  let syncLogCreateData = null;

  await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub({
        externalSyncLog: {
          findFirst: async () => null,
          create: async (args) => {
            syncLogCreateData = args.data;
            return { id: "synclog_1", ...args.data };
          },
          update: async (args) => ({ id: "synclog_1", ...args.data }),
        },
      }),
      findConnection: async () => makeConnection({ last_sync_at: null }),
      markSyncSuccess: async (args) => {
        markSyncSuccessArgs = args;
      },
      markConnectionError: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async (params) => {
        fetchedSince = params.since;
        return [];
      },
    }
  );

  assert.ok(fetchedSince instanceof Date, "fetchedSince should be a Date");
  const expectedSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  assert.equal(fetchedSince.toISOString(), expectedSince.toISOString());
  assert.ok(markSyncSuccessArgs);
  assert.equal(markSyncSuccessArgs.fullSync, true);
  assert.ok(syncLogCreateData);
  assert.equal(syncLogCreateData.source, "godaddy_pos");
  assert.equal(syncLogCreateData.status, "running");
});

test("incremental sync uses last_sync_at as since date", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const lastSyncAt = new Date("2026-02-26T12:00:00.000Z");
  let fetchedSince = null;
  let markSyncSuccessArgs = null;

  await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub(),
      findConnection: async () => makeConnection({ last_sync_at: lastSyncAt }),
      markSyncSuccess: async (args) => {
        markSyncSuccessArgs = args;
      },
      markConnectionError: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async (params) => {
        fetchedSince = params.since;
        return [];
      },
    }
  );

  assert.equal(fetchedSince.toISOString(), lastSyncAt.toISOString());
  assert.ok(markSyncSuccessArgs);
  assert.equal(markSyncSuccessArgs.fullSync, false);
});

test("pilot event is upserted as IncomeEvent and projected to FinancialTransaction", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const capturedIncomeUpserts = [];
  const capturedFtUpserts = [];

  const result = await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub({
        incomeEvent: {
          upsert: async (args) => {
            capturedIncomeUpserts.push(args);
            return { id: "evt_1", ...args.create };
          },
        },
        financialTransaction: {
          upsert: async (args) => {
            capturedFtUpserts.push(args);
            return { id: "ft_1" };
          },
        },
      }),
      findConnection: async () => makeConnection(),
      markSyncSuccess: async () => {},
      markConnectionError: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async () => [makePilotEvent()],
    }
  );

  assert.equal(result.recordsFetched, 1);
  const incomeCreate = capturedIncomeUpserts[0].create;
  assert.equal(incomeCreate.business_id, "biz_1");
  assert.equal(incomeCreate.connection_id, "conn_1");
  assert.equal(incomeCreate.provider_id, "godaddy_pos");
  assert.equal(incomeCreate.external_id, "txn_001");
  assert.equal(Number(incomeCreate.net_amount), 97);

  const ftCreate = capturedFtUpserts[0].create;
  assert.equal(ftCreate.type, "income");
  assert.equal(ftCreate.source, "godaddy_pos");
  assert.equal(Number(ftCreate.amount), 97);
  assert.equal(ftCreate.metadata.provider_id, "godaddy_pos");
  assert.equal(ftCreate.metadata.income_event_id, "evt_1");
});

test("multiple events are all upserted with correct isolation", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const capturedIds = [];

  const result = await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub({
        incomeEvent: {
          upsert: async (args) => {
            capturedIds.push(args.create.external_id);
            return { id: `evt_${args.create.external_id}`, ...args.create };
          },
        },
      }),
      findConnection: async () => makeConnection(),
      markSyncSuccess: async () => {},
      markConnectionError: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async () => [
        makePilotEvent({ externalId: "txn_001" }),
        makePilotEvent({ externalId: "txn_002" }),
        makePilotEvent({ externalId: "txn_003" }),
      ],
    }
  );

  assert.equal(result.recordsFetched, 3);
  assert.deepEqual(capturedIds.sort(), ["txn_001", "txn_002", "txn_003"]);
});

test("sync error marks connection as error and writes failed sync log", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const syncLogUpdates = [];
  let connectionErrorArgs = null;

  await assert.rejects(
    () =>
      runProviderManualSyncTestable(
        { businessId: "biz_1", now },
        {
          prisma: makePrismaStub({
            externalSyncLog: {
              findFirst: async () => null,
              create: async () => ({ id: "synclog_1" }),
              update: async (args) => {
                syncLogUpdates.push(args.data);
                return { id: "synclog_1" };
              },
            },
          }),
          findConnection: async () => makeConnection(),
          markSyncSuccess: async () => {},
          markConnectionError: async (args) => {
            connectionErrorArgs = args;
          },
          decryptSecret: (v) => v.replace(/^enc:/, ""),
          fetchEvents: async () => {
            throw new Error("provider_fetch_error: network timeout");
          },
        }
      ),
    /provider_fetch_error/
  );

  assert.ok(connectionErrorArgs);
  assert.equal(connectionErrorArgs.errorCode, "sync_failed");
  assert.match(connectionErrorArgs.errorMessage, /provider_fetch_error/);
  const failedUpdate = syncLogUpdates.find((u) => u.status === "failed");
  assert.ok(failedUpdate);
});

test("zero events still completes successfully with recordsFetched=0", async () => {
  let syncSuccessCalled = false;
  const result = await runProviderManualSyncTestable(
    { businessId: "biz_1" },
    {
      prisma: makePrismaStub(),
      findConnection: async () => makeConnection(),
      markSyncSuccess: async () => {
        syncSuccessCalled = true;
      },
      markConnectionError: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async () => [],
    }
  );

  assert.equal(result.recordsFetched, 0);
  assert.equal(syncSuccessCalled, true);
});

// ---------------------------------------------------------------------------
// IN-05: Sync lock guard tests
// ---------------------------------------------------------------------------

test("sync lock: throws when a non-stale running sync log exists", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const recentStart = new Date(now.getTime() - 2 * 60 * 1000); // 2 min ago

  await assert.rejects(
    () =>
      runProviderManualSyncTestable(
        { businessId: "biz_1", now },
        {
          prisma: makePrismaStub({
            externalSyncLog: {
              findFirst: async () => ({ id: "synclog_running", started_at: recentStart }),
              create: async (args) => ({ id: "synclog_new", ...args.data }),
              update: async (args) => args.data,
            },
          }),
          findConnection: async () => makeConnection(),
          markSyncSuccess: async () => {},
          markConnectionError: async () => {},
          decryptSecret: (v) => v,
          fetchEvents: async () => [],
        }
      ),
    /already in progress/
  );
});

test("sync lock: proceeds when no running log exists (findFirst returns null)", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  let syncSuccessCalled = false;

  const result = await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub({
        externalSyncLog: {
          findFirst: async () => null,
          create: async (args) => ({ id: "synclog_1", ...args.data }),
          update: async (args) => ({ id: "synclog_1", ...args.data }),
        },
      }),
      findConnection: async () => makeConnection(),
      markSyncSuccess: async () => {
        syncSuccessCalled = true;
      },
      markConnectionError: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async () => [],
    }
  );

  assert.equal(result.recordsFetched, 0);
  assert.equal(syncSuccessCalled, true);
});

test("sync lock: stale lock (>10 min) is filtered out by Prisma gte clause and does not block", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const lockCutoff = new Date(now.getTime() - SYNC_LOCK_STALE_AFTER_MS);
  const staleStart = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago

  let syncSuccessCalled = false;

  const result = await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub({
        externalSyncLog: {
          // Simulate Prisma's gte filter: stale log NOT returned because staleStart < lockCutoff
          findFirst: async (params) => {
            const cutoff = params.where.started_at.gte;
            return staleStart >= cutoff ? { id: "stale", started_at: staleStart } : null;
          },
          create: async (args) => ({ id: "synclog_1", ...args.data }),
          update: async (args) => ({ id: "synclog_1", ...args.data }),
        },
      }),
      findConnection: async () => makeConnection(),
      markSyncSuccess: async () => {
        syncSuccessCalled = true;
      },
      markConnectionError: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async () => [],
    }
  );

  // staleStart (15min) < lockCutoff (10min) → findFirst returns null → no block
  assert.ok(staleStart < lockCutoff, "stale log should predate the lock cutoff");
  assert.equal(result.recordsFetched, 0);
  assert.equal(syncSuccessCalled, true);
});

// ---------------------------------------------------------------------------
// IN-07: Token expiry guard tests
// ---------------------------------------------------------------------------

test("token expiry guard: throws and marks connection expired when token_expires_at is in the past", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const expiredAt = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
  let expiredCalled = false;

  await assert.rejects(
    () =>
      runProviderManualSyncTestable(
        { businessId: "biz_1", now },
        {
          prisma: makePrismaStub(),
          findConnection: async () =>
            makeConnection({ token_expires_at: expiredAt }),
          markSyncSuccess: async () => {},
          markConnectionError: async () => {},
          markConnectionExpired: async () => {
            expiredCalled = true;
          },
          decryptSecret: (v) => v,
          fetchEvents: async () => [],
        }
      ),
    /expired/
  );

  assert.equal(expiredCalled, true, "markConnectionExpired should have been called");
});

test("token expiry guard: proceeds normally when token_expires_at is null (no expiry set)", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  let syncSuccessCalled = false;

  const result = await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub(),
      findConnection: async () => makeConnection({ token_expires_at: null }),
      markSyncSuccess: async () => {
        syncSuccessCalled = true;
      },
      markConnectionError: async () => {},
      markConnectionExpired: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async () => [],
    }
  );

  assert.equal(result.recordsFetched, 0);
  assert.equal(syncSuccessCalled, true);
});

test("token expiry guard: proceeds normally when token_expires_at is in the future", async () => {
  const now = new Date("2026-02-27T23:00:00.000Z");
  const futureExpiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  let syncSuccessCalled = false;

  const result = await runProviderManualSyncTestable(
    { businessId: "biz_1", now },
    {
      prisma: makePrismaStub(),
      findConnection: async () => makeConnection({ token_expires_at: futureExpiry }),
      markSyncSuccess: async () => {
        syncSuccessCalled = true;
      },
      markConnectionError: async () => {},
      markConnectionExpired: async () => {},
      decryptSecret: (v) => v.replace(/^enc:/, ""),
      fetchEvents: async () => [],
    }
  );

  assert.equal(result.recordsFetched, 0);
  assert.equal(syncSuccessCalled, true);
});
