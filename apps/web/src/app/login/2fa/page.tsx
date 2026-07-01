import { Suspense } from 'react';
import { TwoFactorForm } from './two-factor-form';

export const metadata = { title: 'Two-Factor Authentication — Forumo' };

export default function TwoFactorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Suspense>
          <TwoFactorForm />
        </Suspense>
      </div>
    </main>
  );
}
