import { Suspense } from 'react';
import { OAuthCallback } from './oauth-callback';

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-slate-500">Loading…</p></div>}>
      <OAuthCallback />
    </Suspense>
  );
}
