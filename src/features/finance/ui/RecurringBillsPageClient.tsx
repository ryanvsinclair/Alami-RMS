"use client";

import { useEffect, useState } from "react";
import {
  getRecurringBillsAction,
  createRecurringBillAction,
  updateRecurringBillAction,
  deleteRecurringBillAction,
} from "@/app/actions/modules/recurring-bills";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  RECURRENCE_LABELS,
  RECURRENCE_OPTIONS,
  type RecurringBillSummary,
  type RecurringBillCategory,
  type RecurrenceInterval,
} from "@/features/finance/shared/recurring-bill.contracts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BillCategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-semibold text-foreground/60">
      {CATEGORY_LABELS[category as RecurringBillCategory] ?? category}
    </span>
  );
}

interface BillFormProps {
  initial?: RecurringBillSummary;
  onSave: (data: {
    name: string;
    amount: number;
    category: RecurringBillCategory;
    recurrence: RecurrenceInterval;
    startedAt: string;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function BillForm({ initial, onSave, onCancel, saving }: BillFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState<RecurringBillCategory>(
    initial?.category ?? "subscription",
  );
  const [recurrence, setRecurrence] = useState<RecurrenceInterval>(
    initial?.recurrence ?? "monthly",
  );
  const [startedAt, setStartedAt] = useState(
    initial ? initial.nextDueAt.slice(0, 10) : today,
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsedAmount = parseFloat(amount);
    if (!name.trim()) { setError("Name is required"); return; }
    if (!parsedAmount || parsedAmount <= 0) { setError("Enter a valid amount"); return; }
    try {
      await onSave({ name: name.trim(), amount: parsedAmount, category, recurrence, startedAt, notes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-border/50 bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-0";
  const labelClass = "mb-1 block text-xs font-semibold text-foreground/60";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div>
        <label className={labelClass}>Bill Name</label>
        <input
          className={inputClass}
          placeholder="e.g. Netflix, Shopify, Hydro"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelClass}>Amount</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
          <input
            className={`${inputClass} pl-7`}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Category</label>
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as RecurringBillCategory)}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Recurrence</label>
          <select
            className={inputClass}
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as RecurrenceInterval)}
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>First / Next Due Date</label>
        <input
          className={inputClass}
          type="date"
          value={startedAt}
          onChange={(e) => setStartedAt(e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelClass}>Notes (optional)</label>
        <textarea
          className={`${inputClass} resize-none`}
          rows={2}
          placeholder="e.g. account #, vendor info..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : initial ? "Save Changes" : "Add Bill"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border/50 px-4 py-2.5 text-sm font-semibold text-foreground/60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function RecurringBillsPageClient() {
  const [bills, setBills] = useState<RecurringBillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBillSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function reload() {
    try {
      const data = await getRecurringBillsAction();
      setBills(data as RecurringBillSummary[]);
    } catch {
      setError("Failed to load bills");
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function handleCreate(data: {
    name: string;
    amount: number;
    category: RecurringBillCategory;
    recurrence: RecurrenceInterval;
    startedAt: string;
    notes: string;
  }) {
    setSaving(true);
    try {
      await createRecurringBillAction({
        name: data.name,
        amount: data.amount,
        category: data.category,
        recurrence: data.recurrence,
        startedAt: new Date(data.startedAt).toISOString(),
        notes: data.notes || undefined,
      });
      setShowForm(false);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(
    bill: RecurringBillSummary,
    data: {
      name: string;
      amount: number;
      category: RecurringBillCategory;
      recurrence: RecurrenceInterval;
      startedAt: string;
      notes: string;
    },
  ) {
    setSaving(true);
    try {
      await updateRecurringBillAction({
        id: bill.id,
        name: data.name,
        amount: data.amount,
        category: data.category,
        recurrence: data.recurrence,
        notes: data.notes || null,
      });
      setEditingBill(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(bill: RecurringBillSummary) {
    await updateRecurringBillAction({ id: bill.id, isActive: !bill.isActive });
    await reload();
  }

  async function handleDelete(bill: RecurringBillSummary) {
    if (!confirm(`Delete "${bill.name}"? This will remove all its history.`)) return;
    setDeletingId(bill.id);
    try {
      await deleteRecurringBillAction(bill.id);
      await reload();
    } finally {
      setDeletingId(null);
    }
  }

  const activeBills = bills.filter((b) => b.isActive);
  const inactiveBills = bills.filter((b) => !b.isActive);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Recurring Bills</h1>
          <p className="mt-0.5 text-sm text-muted">
            Track subscriptions and recurring expenses
          </p>
        </div>
        {!showForm && !editingBill && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            + Add Bill
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-border/40 bg-foreground/[0.02] p-4">
          <p className="mb-4 text-sm font-bold text-foreground">New Recurring Bill</p>
          <BillForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-foreground/[0.04]" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && bills.length === 0 && !showForm && (
        <div className="rounded-2xl bg-foreground/[0.03] px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground/55">No recurring bills yet</p>
          <p className="mt-1 text-xs text-muted">
            Add a subscription or bill — it will show up on your home screen for confirmation when due.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Add your first bill
          </button>
        </div>
      )}

      {/* Active bills */}
      {!loading && activeBills.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Active ({activeBills.length})
          </p>
          <div className="space-y-3">
            {activeBills.map((bill) => (
              <div key={bill.id}>
                {editingBill?.id === bill.id ? (
                  <div className="rounded-2xl border border-border/40 bg-foreground/[0.02] p-4">
                    <p className="mb-4 text-sm font-bold text-foreground">Edit Bill</p>
                    <BillForm
                      initial={bill}
                      onSave={(data) => handleUpdate(bill, data)}
                      onCancel={() => setEditingBill(null)}
                      saving={saving}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/30 bg-foreground/[0.02] p-4">
                    <div className="flex items-start gap-3">
                      {/* Bill icon */}
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-foreground">{bill.name}</p>
                          <BillCategoryBadge category={bill.category} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {RECURRENCE_LABELS[bill.recurrence]} · Next due {formatDate(bill.nextDueAt)}
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-foreground">
                        {formatMoney(bill.amount)}
                      </p>
                    </div>

                    {bill.notes && (
                      <p className="mt-2 ml-13 truncate text-xs text-muted">{bill.notes}</p>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex gap-2 border-t border-border/20 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingBill(bill)}
                        className="text-xs font-semibold text-foreground/50 hover:text-foreground"
                      >
                        Edit
                      </button>
                      <span className="text-border/40">·</span>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(bill)}
                        className="text-xs font-semibold text-foreground/50 hover:text-foreground"
                      >
                        Pause
                      </button>
                      <span className="text-border/40">·</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(bill)}
                        disabled={deletingId === bill.id}
                        className="text-xs font-semibold text-danger/70 hover:text-danger disabled:opacity-50"
                      >
                        {deletingId === bill.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Paused / inactive bills */}
      {!loading && inactiveBills.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Paused ({inactiveBills.length})
          </p>
          <div className="space-y-3">
            {inactiveBills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center gap-3 rounded-2xl border border-border/20 bg-foreground/[0.01] p-4 opacity-55"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{bill.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {RECURRENCE_LABELS[bill.recurrence]} · {formatMoney(bill.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleActive(bill)}
                  className="rounded-full border border-border/40 px-3 py-1.5 text-xs font-semibold text-foreground/60"
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
