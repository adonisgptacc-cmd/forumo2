import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — Forumo',
  description: 'Read the Forumo Marketplace Terms of Service governing your use of the platform.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Legal</p>
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-sm text-slate-500">Last updated: March 2026</p>
      </div>

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using Forumo (&quot;the Platform&quot;), you agree to be bound by these Terms of Service
          (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Platform. These Terms apply to all
          visitors, buyers, sellers, and other users of the Platform.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          Forumo is an online marketplace that connects buyers and sellers across Africa. The Platform provides
          escrow-protected transactions, messaging, listings management, and related services. Forumo acts solely
          as an intermediary and is not a party to any transaction between buyers and sellers.
        </p>
      </Section>

      <Section title="3. Account Registration">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be at least 18 years old to create an account.</li>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You must provide accurate and complete information during registration.</li>
          <li>One person may not maintain more than one account without our express written permission.</li>
          <li>You are responsible for all activities that occur under your account.</li>
        </ul>
      </Section>

      <Section title="4. Seller Obligations">
        <ul className="list-disc pl-5 space-y-1">
          <li>Sellers must accurately describe all listed items, including condition, dimensions, and any defects.</li>
          <li>Prohibited items include, but are not limited to: counterfeit goods, illegal items, weapons, and hazardous materials.</li>
          <li>Sellers are responsible for shipping items within the agreed timeframe after payment is confirmed.</li>
          <li>Sellers must complete KYC (Know Your Customer) verification before withdrawing funds.</li>
          <li>Forumo reserves the right to remove listings that violate these Terms or applicable law.</li>
        </ul>
      </Section>

      <Section title="5. Buyer Obligations">
        <ul className="list-disc pl-5 space-y-1">
          <li>Buyers must pay promptly after placing an order.</li>
          <li>Buyers must confirm receipt of goods in a timely manner to release escrow funds.</li>
          <li>False claims about non-receipt or item condition may result in account suspension.</li>
          <li>Buyers accept that Forumo is not liable for third-party shipping delays.</li>
        </ul>
      </Section>

      <Section title="6. Escrow and Payments">
        <p>
          All transactions on Forumo are processed through an escrow system. Buyer funds are held securely until
          the buyer confirms receipt of the order. Payment processing is handled by Stripe. By using the Platform,
          you agree to Stripe&apos;s{' '}
          <a href="https://stripe.com/legal" className="text-amber-600 hover:underline" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>.
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-3">
          <li>Platform fees are deducted from the seller payout before release.</li>
          <li>Refunds are subject to Forumo&apos;s refund and dispute resolution policy.</li>
          <li>Forumo reserves the right to hold funds pending dispute resolution.</li>
        </ul>
      </Section>

      <Section title="7. Disputes">
        <p>
          If a buyer and seller cannot resolve a dispute independently, either party may escalate to Forumo for
          mediation. Forumo will review available evidence and issue a binding resolution within 14 business days.
          Forumo&apos;s decision on disputes is final.
        </p>
      </Section>

      <Section title="8. Prohibited Conduct">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Use the Platform for any unlawful purpose.</li>
          <li>Post false, misleading, or fraudulent listings.</li>
          <li>Attempt to circumvent the escrow system or conduct off-platform transactions.</li>
          <li>Harass, threaten, or abuse other users.</li>
          <li>Scrape, crawl, or use automated tools against the Platform without permission.</li>
          <li>Attempt to gain unauthorized access to Platform systems.</li>
        </ul>
      </Section>

      <Section title="9. Intellectual Property">
        <p>
          The Forumo name, logo, and Platform content are the intellectual property of Forumo and its licensors.
          You may not use, reproduce, or distribute our intellectual property without prior written consent.
          By uploading content to the Platform, you grant Forumo a non-exclusive, royalty-free license to use,
          display, and distribute that content in connection with operating the Platform.
        </p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, Forumo shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use of the Platform. Our total
          liability to you for any claim shall not exceed the amount of fees paid by you to Forumo in the
          six months preceding the claim.
        </p>
      </Section>

      <Section title="11. Termination">
        <p>
          Forumo reserves the right to suspend or terminate your account at any time for violation of these
          Terms or for any other reason at our sole discretion. Upon termination, your right to use the Platform
          ceases immediately. Pending escrow funds will be handled according to our dispute resolution policy.
        </p>
      </Section>

      <Section title="12. Governing Law">
        <p>
          These Terms are governed by the laws of Ghana. Any disputes arising from these Terms shall be subject
          to the exclusive jurisdiction of the courts of Ghana.
        </p>
      </Section>

      <Section title="13. Changes to Terms">
        <p>
          We may update these Terms from time to time. We will notify you of significant changes by email or
          by posting a notice on the Platform. Continued use of the Platform after changes constitutes
          acceptance of the updated Terms.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          If you have questions about these Terms, please contact us at{' '}
          <a href="mailto:legal@forumo.africa" className="text-amber-600 hover:underline">
            legal@forumo.africa
          </a>.
        </p>
      </Section>

      <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
        See also:{' '}
        <Link href="/privacy" className="text-amber-600 hover:underline">
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
