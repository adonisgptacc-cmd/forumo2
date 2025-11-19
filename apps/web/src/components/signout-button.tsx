'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="rounded-full border border-red-400 px-4 py-1 text-sm text-red-200 hover:bg-red-400/10"
    >
      Sign out
    </button>
  );
}
