import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL_PROFILE } from "@/features/marketing/shared/legal-profile";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy policy for ${LEGAL_PROFILE.appName}`,
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(0,127,255,0.14),transparent_36%)]" />

      <div className="relative mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="rounded-3xl border border-border/70 bg-card/75 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/90">
            Privacy
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted">Last updated: {LEGAL_PROFILE.effectiveDateLabel}</p>

          <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning">
            Finalization required: replace bracketed placeholders (for legal entity, contact details,
            governing law, and jurisdictions) before publishing publicly.
          </div>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
            <section>
              <h2 className="text-base font-semibold text-foreground">1. Who we are</h2>
              <p>
                This policy describes how {LEGAL_PROFILE.legalEntityName} (&quot;we&quot;, &quot;us&quot;,
                &quot;our&quot;) handles personal data when you use {LEGAL_PROFILE.appName}. Our website is{" "}
                {LEGAL_PROFILE.websiteUrl}. You can contact us at {LEGAL_PROFILE.privacyEmail}.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">2. Scope</h2>
              <p>
                This policy applies to account creation, sign-in, onboarding, integrations,
                inventory and financial operations, document intake, and support interactions.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">3. Data we collect</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Account and profile data: first name, last name, date of birth, email, phone,
                  authentication metadata, and role/membership data.
                </li>
                <li>
                  Business data: business name, industry, business address/place metadata, and
                  configuration context.
                </li>
                <li>
                  Integration data: provider connection metadata, encrypted access/refresh tokens,
                  scopes, sync cursors, sync timestamps, and integration status/error records.
                </li>
                <li>
                  Financial and operations data: income events, normalized transaction records,
                  external identifiers, and associated metadata.
                </li>
                <li>
                  Document and intake data: uploaded files, email-ingested attachments, parsed
                  structured fields, and draft processing state.
                </li>
                <li>
                  Technical data: device/browser information, request logs, security and
                  troubleshooting telemetry.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">4. How we use data</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Provide, secure, and maintain the service.</li>
                <li>Authenticate users and enforce role-based permissions.</li>
                <li>Enable and operate third-party integrations requested by users.</li>
                <li>Process operational records such as financial and inventory events.</li>
                <li>Monitor reliability, detect abuse, and improve product performance.</li>
                <li>Comply with legal and regulatory obligations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">5. Legal bases</h2>
              <p>
                Where applicable, we process data based on contract performance, legitimate
                interests, consent (where required), and compliance with legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">6. Sharing and disclosure</h2>
              <p>We may disclose data to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Infrastructure and cloud providers that host core service components.</li>
                <li>Integration providers that you choose to connect.</li>
                <li>Service providers supporting email/document intake and delivery.</li>
                <li>Professional advisors and authorities when legally required.</li>
                <li>Successors in connection with merger, sale, or restructuring events.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">7. International transfers</h2>
              <p>
                Data may be processed in countries outside your own. Where required, we use
                contractual and operational safeguards for cross-border transfers.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">8. Retention</h2>
              <p>
                We retain data for as long as needed to provide the service, meet legal
                requirements, resolve disputes, and enforce agreements. Retention windows should be
                formalized internally by category (account, operational, financial, integration,
                and security logs).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">9. Security</h2>
              <p>
                We use technical and organizational safeguards designed to protect data, including
                access controls and encrypted storage of sensitive integration credentials. No
                method of transmission or storage is completely secure.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">10. Your rights</h2>
              <p>
                Depending on your location, you may have rights to access, correct, delete, export,
                or restrict certain processing, and to object to specific processing activities.
                You may also have rights related to targeted advertising and sale/share concepts
                under local law.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">11. Children</h2>
              <p>
                The service is not intended for children under {LEGAL_PROFILE.minimumAge}. Do not
                use the service if you are below the minimum age required in your jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">12. Changes to this policy</h2>
              <p>
                We may update this policy from time to time. Material updates will be posted with a
                revised effective date.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">13. Contact and requests</h2>
              <p>
                For privacy requests, contact {LEGAL_PROFILE.privacyEmail}. For general support,
                contact {LEGAL_PROFILE.supportEmail}. Postal contact: {LEGAL_PROFILE.legalAddress}.
                You may also submit complaints to your local data protection or consumer authority
                where applicable.
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
              href="/terms"
              className="inline-flex h-10 items-center rounded-full border border-border bg-background/70 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-background"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
