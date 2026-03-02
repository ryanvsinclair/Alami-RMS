import Link from "next/link";
import {
  FIRST_ONBOARDING_INCOME_SOURCE_STEP_ID,
  getOnboardingIncomeSourceStepPath,
} from "@/features/integrations/shared/onboarding-flow";
import { SignupFormClient } from "./SignupFormClient";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next
    ? decodeURIComponent(params.next)
    : getOnboardingIncomeSourceStepPath(FIRST_ONBOARDING_INCOME_SOURCE_STEP_ID);
  const errorMessage = params?.error ? decodeURIComponent(params.error) : "";

  return (
    <div className="space-y-6">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Get started</p>

      <SignupFormClient next={next} errorMessage={errorMessage} />

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-semibold text-primary" href="/auth/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
