"use client";

import { useMemo, useRef, useState } from "react";
import { signUpAction } from "@/app/actions/core/auth";
import { INDUSTRY_LABELS, INDUSTRY_TYPES } from "@/lib/config/presets";
import { RestaurantPlaceSearch } from "./RestaurantPlaceSearch";

const STEP_COUNT = 3;
const STEP_FIELD_NAMES: Record<number, string[]> = {
  1: ["first_name", "last_name", "date_of_birth"],
  2: ["industry_type", "business_name"],
  3: ["email", "phone", "password", "confirm_password"],
};

function getFieldElement(form: HTMLFormElement, name: string) {
  return form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  );
}

function validateStep(form: HTMLFormElement, step: number) {
  const fields = STEP_FIELD_NAMES[step] ?? [];
  for (const fieldName of fields) {
    const field = getFieldElement(form, fieldName);
    if (!field) continue;
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

export function SignupFormClient({
  next,
  errorMessage,
}: {
  next: string;
  errorMessage: string;
}) {
  const [step, setStep] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const maxDateOfBirth = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const trackWidthPct = STEP_COUNT * 100;
  const slideOffsetPct = ((step - 1) * 100) / STEP_COUNT;
  const panelWidthPct = 100 / STEP_COUNT;

  function handleContinue() {
    const form = formRef.current;
    if (!form) return;
    if (!validateStep(form, step)) return;
    setStep((prev) => Math.min(prev + 1, STEP_COUNT));
  }

  function handleBack() {
    setStep((prev) => Math.max(prev - 1, 1));
  }

  return (
    <form
      ref={formRef}
      action={signUpAction}
      className="w-full max-w-full min-w-0 space-y-4 overflow-x-hidden"
    >
      <input type="hidden" name="next" value={next} />

      <div className="flex items-center justify-between px-1">
        <p className="text-[13px] font-normal tracking-normal text-muted">Step {step} of {STEP_COUNT}</p>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((marker) => (
            <span
              key={marker}
              className={`h-1.5 rounded-full transition-all ${
                marker === step ? "w-6 bg-primary" : "w-1.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="w-full min-w-0 overflow-x-hidden">
        <div
          className="flex min-w-0 transition-transform duration-300 ease-out"
          style={{ width: `${trackWidthPct}%`, transform: `translateX(-${slideOffsetPct}%)` }}
        >
          <section
            className="min-w-0 shrink-0 space-y-3 overflow-x-hidden"
            style={{ width: `${panelWidthPct}%` }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="text-[13px] font-normal tracking-normal text-muted">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  required
                  className="h-12 w-full rounded-[10px] border border-border bg-foreground/[0.028] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="last_name" className="text-[13px] font-normal tracking-normal text-muted">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  required
                  className="h-12 w-full rounded-[10px] border border-border bg-foreground/[0.028] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="date_of_birth" className="text-[13px] font-normal tracking-normal text-muted">
                Date of birth
              </label>
              <input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                max={maxDateOfBirth}
                required
                className="h-12 w-full rounded-[10px] border border-border bg-foreground/[0.028] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="h-12 w-full rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(0,127,255,0.32)] transition-colors hover:bg-primary-hover"
            >
              Continue
            </button>
          </section>

          <section
            className="min-w-0 shrink-0 space-y-3 overflow-x-hidden"
            style={{ width: `${panelWidthPct}%` }}
          >
            <div className="space-y-1.5">
              <label htmlFor="industry_type" className="text-[13px] font-normal tracking-normal text-muted">
                Industry
              </label>
              <select
                id="industry_type"
                name="industry_type"
                defaultValue="restaurant"
                required
                className="h-12 w-full rounded-2xl border border-border bg-foreground/[0.028] px-4 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                {INDUSTRY_TYPES.map((industry) => {
                  const enabled = industry === "restaurant";
                  return (
                    <option key={industry} value={industry} disabled={!enabled}>
                      {enabled ? INDUSTRY_LABELS[industry] : `${INDUSTRY_LABELS[industry]} (Coming soon)`}
                    </option>
                  );
                })}
              </select>
            </div>

            <RestaurantPlaceSearch />

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-foreground/[0.02] font-semibold text-foreground transition-colors hover:bg-foreground/[0.05]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="h-12 min-w-0 flex-1 rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(0,127,255,0.32)] transition-colors hover:bg-primary-hover"
              >
                Continue
              </button>
            </div>
          </section>

          <section
            className="min-w-0 shrink-0 space-y-3 overflow-x-hidden"
            style={{ width: `${panelWidthPct}%` }}
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[13px] font-normal tracking-normal text-muted">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="h-12 w-full rounded-[10px] border border-border bg-foreground/[0.028] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-[13px] font-normal tracking-normal text-muted">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                className="h-12 w-full rounded-[10px] border border-border bg-foreground/[0.028] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[13px] font-normal tracking-normal text-muted">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                className="h-12 w-full rounded-[10px] border border-border bg-foreground/[0.028] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm_password" className="text-[13px] font-normal tracking-normal text-muted">
                Confirm password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                minLength={8}
                required
                className="h-12 w-full rounded-[10px] border border-border bg-foreground/[0.028] px-4 text-foreground placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {errorMessage && (
              <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                {errorMessage}
              </p>
            )}

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-foreground/[0.02] font-semibold text-foreground transition-colors hover:bg-foreground/[0.05]"
              >
                Back
              </button>
              <button
                type="submit"
                className="h-12 min-w-0 flex-1 rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(0,127,255,0.32)] transition-colors hover:bg-primary-hover"
              >
                Create account
              </button>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
