import { KycForm } from './kyc-form';

export const metadata = { title: 'Identity Verification — Forumo' };

export default function KycPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Identity Verification</h2>
        <p className="text-sm text-slate-400">Complete KYC verification to unlock selling and payment features</p>
      </div>
      <KycForm />
    </div>
  );
}
