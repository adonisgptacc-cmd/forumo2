import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '../../lib/auth';
import { LoginForm } from './signin-form';

export const metadata = {
  title: 'Login · Forumo',
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/app');
  }

  return (
    <main className="mx-auto max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Welcome back</p>
        <h1 className="text-3xl font-semibold">Sign in to manage your marketplace</h1>
        <p className="text-sm text-slate-400">Access seller dashboards, escrow operations, and buyer messaging.</p>
      </div>
      <LoginForm />
    </main>
  );
}
