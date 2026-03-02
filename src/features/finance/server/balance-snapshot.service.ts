interface FinancialAggregateClient {
  financialTransaction?: {
    aggregate?: (args: {
      where: {
        business_id: string;
        type: "income" | "expense";
        occurred_at: { lte: Date };
      };
      _sum: { amount: true };
    }) => Promise<{ _sum?: { amount?: unknown } }>;
  };
}

interface ResolveBalanceAfterSnapshotInput {
  businessId: string;
  occurredAt: Date;
  amount: number | string | null | undefined;
  type: "income" | "expense";
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  ) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Returns the running ledger balance immediately after the incoming transaction.
 * Expense transactions receive the snapshot; other types return null.
 */
export async function resolveBalanceAfterSnapshot(
  client: FinancialAggregateClient,
  input: ResolveBalanceAfterSnapshotInput,
): Promise<number | null> {
  if (input.type !== "expense") return null;

  const aggregate = client.financialTransaction?.aggregate;
  if (typeof aggregate !== "function") return null;

  const [incomeAgg, expenseAgg] = await Promise.all([
    aggregate({
      where: {
        business_id: input.businessId,
        type: "income",
        occurred_at: { lte: input.occurredAt },
      },
      _sum: { amount: true },
    }),
    aggregate({
      where: {
        business_id: input.businessId,
        type: "expense",
        occurred_at: { lte: input.occurredAt },
      },
      _sum: { amount: true },
    }),
  ]);

  const incomeTotal = toNumber(incomeAgg?._sum?.amount);
  const expenseTotal = toNumber(expenseAgg?._sum?.amount);
  const currentBalanceAtMoment = incomeTotal - expenseTotal;
  const signedAmount = -Math.abs(toNumber(input.amount));
  return roundMoney(currentBalanceAtMoment + signedAmount);
}

