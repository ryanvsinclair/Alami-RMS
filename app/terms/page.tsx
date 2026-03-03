import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL_PROFILE } from "@/features/marketing/shared/legal-profile";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms of service for ${LEGAL_PROFILE.appName}`,
};

export default function TermsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(0,127,255,0.14),transparent_36%)]" />

      <div className="relative mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="rounded-3xl border border-border/70 bg-card/75 p-6 sm:p-8">
          <p className="text-xs font-semibold normal-case tracking-normal text-primary/90">
            Terms
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted">Last updated: {LEGAL_PROFILE.effectiveDateLabel}</p>

          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning">
            Finalization required: replace bracketed placeholders (for legal entity, contact details,
            governing law, venue, and jurisdiction coverage) before publishing publicly.
          </div>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
            <section>
              <h2 className="text-base font-semibold text-foreground">1. Agreement</h2>
              <p>
                These Terms of Service (&quot;Terms&quot;) form a legal agreement between you and{" "}
                {LEGAL_PROFILE.legalEntityName} for use of {LEGAL_PROFILE.appName}.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">2. Eligibility and accounts</h2>
              <p>
                You must be at least {LEGAL_PROFILE.minimumAge} years old (or the age of majority
                where you live) and have authority to bind your organization. You are responsible
                for accurate account data and all activity under your credentials.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">3. Acceptable use</h2>
              <p>You agree not to misuse the service, including:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>violating law or third-party rights,</li>
                <li>attempting unauthorized access or security bypass,</li>
                <li>interfering with service integrity or availability,</li>
                <li>uploading malicious code or harmful content.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">4. Integrations and third parties</h2>
              <p>
                Third-party integrations are optional and subject to each provider&apos;s terms,
                permissions, APIs, and availability. We are not responsible for third-party outages,
                policy changes, or API limitations.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">5. Customer data and privacy</h2>
              <p>
                You retain responsibility for the lawfulness of data you submit. Our data handling
                practices are described in the Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">6. Intellectual property</h2>
              <p>
                We own the service and related intellectual property. Subject to these Terms, we
                grant you a limited, non-exclusive, non-transferable right to use the service for
                internal business operations.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">7. Fees and plan changes</h2>
              <p>
                Paid features, pricing, and billing terms (if any) are provided separately. We may
                change plans and pricing with prior notice where required.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">8. Suspension and termination</h2>
              <p>
                We may suspend or terminate access for breach, legal risk, abuse, or security
                threats. You may stop using the service at any time, subject to any applicable
                billing commitments.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">9. Disclaimers</h2>
              <p>
                The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis to the
                maximum extent permitted by law. We do not guarantee uninterrupted or error-free
                operation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">10. Limitation of liability</h2>
              <p>
                To the fullest extent allowed by law, we are not liable for indirect, incidental,
                special, consequential, or punitive damages, or loss of profits, revenues, data, or
                goodwill. Any maximum direct liability cap should be defined in your final legal
                terms for your plan model and jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">11. Indemnification</h2>
              <p>
                You agree to indemnify and hold us harmless from claims arising from your misuse of
                the service, your content, or your violation of law or third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">12. Governing law and disputes</h2>
              <p>
                These Terms are governed by the laws of {LEGAL_PROFILE.governingLaw}. Disputes will
                be resolved in {LEGAL_PROFILE.disputeVenue}, unless applicable law requires
                otherwise.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">13. Changes to these Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of the service after
                updates indicates acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">14. Contact</h2>
              <p>
                Contact us at {LEGAL_PROFILE.supportEmail} or {LEGAL_PROFILE.legalAddress}. Privacy
                questions should be sent to {LEGAL_PROFILE.privacyEmail}. Current service markets:
                {" "}{LEGAL_PROFILE.businessJurisdictions}.
              </p>
            </section>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-border bg-background/70 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-background"
            >
              Back to home
            </Link>
            <Link
              href="/privacy"
              className="inline-flex h-10 items-center rounded-full border border-border bg-background/70 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-background"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
