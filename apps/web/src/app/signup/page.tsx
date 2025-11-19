import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '../../lib/auth';
import { SignupForm } from './signup-form';

export const metadata = {
  title: 'Create account · Forumo',
};

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/app');
  }

  return (
    <main className="mx-auto max-w-lg space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Join the beta</p>
        <h1 className="text-3xl font-semibold">Create your Forumo account</h1>
        <p className="text-sm text-slate-400">
          We provision sandbox seller + buyer wallets so you can experience listings, escrow, and messaging instantly.
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
