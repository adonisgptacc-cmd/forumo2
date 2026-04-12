import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Forumo',
  description: 'Learn how Forumo collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Legal</p>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-slate-500">Last updated: March 2026</p>
      </div>

      <Section title="1. Introduction">
        <p>
          Forumo (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal data.
          This Privacy Policy explains what information we collect, how we use it, and your rights in relation
          to it. It applies to all users of the Forumo marketplace platform.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p><strong>Account information:</strong> Name, email address, phone number, and password hash when you register.</p>
        <p><strong>Identity verification (KYC):</strong> Government-issued ID documents and selfies for seller verification, processed securely.</p>
        <p><strong>Transaction data:</strong> Orders, payment records, escrow transactions, and dispute history.</p>
        <p><strong>Listing data:</strong> Product titles, descriptions, images, pricing, and location information you provide.</p>
        <p><strong>Communications:</strong> Messages sent between buyers and sellers on the Platform.</p>
        <p><strong>Usage data:</strong> IP address, browser type, pages visited, and other analytics data collected automatically.</p>
        <p><strong>Device data:</strong> Device identifiers, operating system, and app version when using the mobile app.</p>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and manage your account.</li>
          <li>To facilitate transactions between buyers and sellers.</li>
          <li>To process payments and manage escrow via Stripe.</li>
          <li>To verify seller identity and prevent fraud (KYC).</li>
          <li>To send transactional emails (order confirmations, receipts, dispute updates).</li>
          <li>To send SMS notifications for time-sensitive events.</li>
          <li>To improve the Platform through anonymised analytics.</li>
          <li>To enforce our Terms of Service and legal obligations.</li>
          <li>To respond to support requests and disputes.</li>
        </ul>
      </Section>

      <Section title="4. Legal Basis for Processing (GDPR)">
        <p>For users in jurisdictions covered by GDPR, we process your data on the following legal bases:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Contract performance:</strong> Processing necessary to fulfil your orders and provide the service.</li>
          <li><strong>Legal obligation:</strong> KYC/AML compliance, tax records, fraud prevention.</li>
          <li><strong>Legitimate interests:</strong> Platform security, analytics, and improving user experience.</li>
          <li><strong>Consent:</strong> Marketing communications (you may opt out at any time).</li>
        </ul>
      </Section>

      <Section title="5. Sharing Your Information">
        <p>We share your data only in the following circumstances:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>With other users:</strong> Your public profile name and listing information are visible to other users.</li>
          <li><strong>Stripe:</strong> Payment data is shared with Stripe for transaction processing. See <a href="https://stripe.com/privacy" className="text-amber-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe&apos;s Privacy Policy</a>.</li>
          <li><strong>Mailgun / AWS SNS:</strong> Email and SMS delivery providers.</li>
          <li><strong>Law enforcement:</strong> Where required by applicable law or court order.</li>
          <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets.</li>
        </ul>
        <p className="mt-2">We do not sell your personal data to third parties.</p>
      </Section>

      <Section title="6. Data Retention">
        <ul className="list-disc pl-5 space-y-1">
          <li>Account data is retained for the duration of your account and up to 2 years after deletion.</li>
          <li>Transaction and financial records are retained for 7 years to meet regulatory requirements.</li>
          <li>KYC documents are retained for 5 years after verification as required by AML regulations.</li>
          <li>Message data is retained for 2 years after the last activity in a thread.</li>
        </ul>
      </Section>

      <Section title="7. Cookies and Tracking">
        <p>
          We use cookies and similar technologies to maintain sessions, remember preferences, and analyse
          Platform usage. You can control cookie settings through your browser. Disabling cookies may affect
          Platform functionality.
        </p>
        <p className="mt-2">Types of cookies we use:</p>
        <ul className="list-disc pl-5 space-y-1 mt-1">
          <li><strong>Essential:</strong> Required for authentication and core Platform functions.</li>
          <li><strong>Analytics:</strong> Anonymous usage data to improve the Platform.</li>
        </ul>
      </Section>

      <Section title="8. Security">
        <p>
          We implement industry-standard security measures including TLS encryption in transit, encrypted
          password storage (bcrypt), and role-based access controls. KYC documents are stored in encrypted
          object storage. However, no system is 100% secure, and you use the Platform at your own risk.
        </p>
      </Section>

      <Section title="9. Your Rights">
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Access</strong> the personal data we hold about you.</li>
          <li><strong>Rectify</strong> inaccurate or incomplete data.</li>
          <li><strong>Erase</strong> your data (&quot;right to be forgotten&quot;), subject to legal retention requirements.</li>
          <li><strong>Restrict</strong> or object to certain processing activities.</li>
          <li><strong>Port</strong> your data to another service.</li>
          <li><strong>Withdraw consent</strong> for consent-based processing at any time.</li>
        </ul>
        <p className="mt-2">
          To exercise your rights, contact us at{' '}
          <a href="mailto:privacy@forumo.africa" className="text-amber-600 hover:underline">
            privacy@forumo.africa
          </a>.
          We will respond within 30 days.
        </p>
      </Section>

      <Section title="10. Children's Privacy">
        <p>
          The Platform is not intended for users under 18 years of age. We do not knowingly collect personal
          data from children. If you believe a child has provided us with personal data, please contact us
          immediately.
        </p>
      </Section>

      <Section title="11. International Transfers">
        <p>
          Your data may be processed in countries outside your jurisdiction, including where our cloud
          providers operate. We ensure appropriate safeguards are in place for any such transfers.
        </p>
      </Section>

      <Section title="12. California Privacy Rights (CCPA)">
        <p>
          If you are a California resident, the California Consumer Privacy Act (CCPA) grants you the
          following rights in addition to those listed above:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Right to Know:</strong> You may request disclosure of the categories and specific pieces of personal information we have collected about you in the past 12 months.</li>
          <li><strong>Right to Delete:</strong> You may request deletion of personal information we have collected, subject to certain legal exceptions.</li>
          <li><strong>Right to Opt-Out of Sale:</strong> We do <strong>not</strong> sell your personal information to third parties. You do not need to opt out.</li>
          <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your CCPA rights.</li>
        </ul>
        <p className="mt-2">
          To submit a verifiable CCPA request, contact us at{' '}
          <a href="mailto:privacy@forumo.africa" className="text-amber-600 hover:underline">
            privacy@forumo.africa
          </a>{' '}
          with the subject line &quot;CCPA Request&quot;. We will respond within 45 days.
        </p>
      </Section>

      <Section title="13. Changes to This Policy">
        <p>
          We may update this Privacy Policy periodically. We will notify you of material changes by email
          or by a prominent notice on the Platform at least 30 days before the change takes effect.
        </p>
      </Section>

      <Section title="14. Contact Us">
        <p>
          For privacy questions or to exercise your rights, contact our Data Protection Officer at:{' '}
          <a href="mailto:privacy@forumo.africa" className="text-amber-600 hover:underline">
            privacy@forumo.africa
          </a>
          <br />
          Forumo, Accra, Ghana
        </p>
      </Section>

      <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
        See also:{' '}
        <Link href="/terms" className="text-amber-600 hover:underline">
          Terms of Service
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
