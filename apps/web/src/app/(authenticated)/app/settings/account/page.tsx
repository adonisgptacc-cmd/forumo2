'use client';

import { useState } from 'react';
import { useProfile, useInitiateAccountDeletion, useCancelAccountDeletion, useLegalDataExport } from '../../../../../lib/react-query/hooks';

export default function AccountSettingsPage() {
  const { data, isLoading } = useProfile();
  const initiateDelete = useInitiateAccountDeletion();
  const cancelDelete = useCancelAccountDeletion();
  const exportData = useLegalDataExport();

  const [confirmText, setConfirmText] = useState('');
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null);

  const scheduledAt = deletionScheduledAt ?? ((data?.user as any)?.deletionScheduledAt as string | null | undefined) ?? null;
  const isDeletionScheduled = Boolean(scheduledAt && new Date(scheduledAt) > new Date());

  async function handleExport() {
    const result = await exportData.refetch();
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'forumo-my-data.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleScheduleDeletion() {
    const result = await initiateDelete.mutateAsync();
    setDeletionScheduledAt(result.scheduledAt);
    setConfirmText('');
  }

  async function handleCancelDeletion() {
    await cancelDelete.mutateAsync();
    setDeletionScheduledAt(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse p-6">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-800" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your data and account lifecycle.</p>
      </div>

      {/* Pending deletion banner */}
      {isDeletionScheduled && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-300">Account deletion scheduled</p>
            <p className="mt-0.5 text-xs text-red-400">
              Your account is scheduled for permanent deletion on{' '}
              <strong>{new Date(scheduledAt!).toLocaleDateString(undefined, { dateStyle: 'long' })}</strong>.
              All your data will be removed unless you cancel.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelDeletion}
            disabled={cancelDelete.isPending}
            className="shrink-0 rounded-lg border border-red-600 px-4 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-800/40 disabled:opacity-50"
          >
            {cancelDelete.isPending ? 'Cancelling…' : 'Cancel Deletion'}
          </button>
        </div>
      )}

      {/* Download my data */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Download My Data</h2>
          <p className="mt-1 text-xs text-slate-400">
            Export a copy of all personal data Forumo holds about you, including your profile, orders,
            listings, reviews, and messages. This is your right under GDPR/CCPA.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportData.isFetching}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:border-slate-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          {exportData.isFetching ? 'Preparing export…' : 'Download my data (JSON)'}
        </button>
        {exportData.isError && (
          <p className="text-xs text-red-400">{(exportData.error as Error)?.message ?? 'Export failed. Please try again.'}</p>
        )}
      </section>

      {/* Delete account */}
      {!isDeletionScheduled && (
        <section className="rounded-xl border border-red-900/50 bg-red-950/20 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-red-300">Delete Account</h2>
            <p className="mt-1 text-xs text-slate-400">
              Permanently delete your account and all associated data. This action has a 30-day grace period
              during which you can cancel.
            </p>
          </div>

          <ul className="space-y-1 text-xs text-slate-400">
            {[
              'Your profile, avatar, and personal information',
              'All your listings and storefront',
              'Your messages and notifications',
              'Your wishlist and saved items',
              'Active orders will be cancelled and refunded',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-red-500">✕</span>
                {item}
              </li>
            ))}
            <li className="flex items-start gap-2 text-slate-500">
              <span className="mt-0.5 text-amber-600">~</span>
              Financial records will be anonymised and kept for 7 years (legal requirement)
            </li>
          </ul>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">
              Type <strong className="text-white">DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-red-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleScheduleDeletion}
            disabled={confirmText !== 'DELETE' || initiateDelete.isPending}
            className="rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {initiateDelete.isPending ? 'Scheduling deletion…' : 'Schedule Account Deletion (30-day grace)'}
          </button>
          {initiateDelete.isError && (
            <p className="text-xs text-red-400">
              {(initiateDelete.error as Error)?.message ?? 'Failed to schedule deletion. Please try again.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
