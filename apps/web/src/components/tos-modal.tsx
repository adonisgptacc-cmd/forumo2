'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createApiClient } from '../lib/api-client';
import { useAcceptTos } from '../lib/react-query/hooks';

const TOS_VERSION = process.env.NEXT_PUBLIC_TOS_VERSION ?? '2024-01-01';

function useTosStatus(accessToken?: string | null) {
  const [status, setStatus] = useState<'loading' | 'required' | 'ok'>('loading');
  const api = useMemo(() => createApiClient(accessToken), [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setStatus('ok');
      return;
    }
    let cancelled = false;
    api.auth
      .me()
      .then((auth) => {
        if (cancelled) return;
        const user = auth.user;
        const needsTos = !user.termsAcceptedAt || user.tosVersion !== TOS_VERSION;
        setStatus(needsTos ? 'required' : 'ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('ok');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, api]);

  return status;
}

export function TosModal() {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const tosStatus = useTosStatus(accessToken);
  const acceptTos = useAcceptTos();
  const qc = useQueryClient();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    if (atBottom) setScrolledToBottom(true);
  }

  async function handleAgree() {
    await acceptTos.mutateAsync(TOS_VERSION);
    setAgreed(true);
    qc.invalidateQueries({ queryKey: ['profile'] });
    // Force a hard-reload so TOS status is re-checked from a fresh auth.me()
    window.location.reload();
  }

  if (tosStatus !== 'required' || agreed) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-700 px-6 py-5">
          <h2 className="text-lg font-semibold text-white">Terms of Service &amp; Privacy Policy</h2>
          <p className="mt-1 text-sm text-slate-400">
            Please read and accept our Terms of Service to continue using Forumo.
          </p>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-300 leading-relaxed space-y-4"
        >
          <h3 className="font-semibold text-white">1. Acceptance of Terms</h3>
          <p>
            By accessing or using Forumo ("the Platform"), you agree to be bound by these Terms of Service
            ("Terms"). If you do not agree, you may not use the Platform.
          </p>

          <h3 className="font-semibold text-white">2. Eligibility</h3>
          <p>
            You must be at least 18 years old to use Forumo. By using the Platform, you represent that you
            meet this age requirement and have the legal capacity to enter into contracts.
          </p>

          <h3 className="font-semibold text-white">3. User Accounts</h3>
          <p>
            You are responsible for maintaining the security of your account credentials. You must notify us
            immediately of any unauthorised use of your account. Forumo reserves the right to suspend or
            terminate accounts that violate these Terms.
          </p>

          <h3 className="font-semibold text-white">4. Marketplace Rules</h3>
          <p>
            You agree not to list prohibited items, engage in fraudulent transactions, circumvent the escrow
            system, or otherwise act in bad faith. Forumo uses escrow to protect buyers and sellers; funds
            are released only after confirmed delivery.
          </p>

          <h3 className="font-semibold text-white">5. Fees &amp; Payments</h3>
          <p>
            Forumo charges a platform fee on completed transactions. Fee schedules are published on the
            Platform and may change with 30 days' notice. You are responsible for any applicable taxes.
          </p>

          <h3 className="font-semibold text-white">6. Privacy &amp; Data</h3>
          <p>
            We collect, process, and store personal data as described in our Privacy Policy. You have the
            right to access, correct, and delete your personal data at any time from your account settings.
            We retain anonymised financial records for 7 years as required by law.
          </p>

          <h3 className="font-semibold text-white">7. Intellectual Property</h3>
          <p>
            All content you upload to Forumo remains yours. By uploading, you grant Forumo a non-exclusive
            licence to display and process that content solely for the purpose of operating the Platform.
          </p>

          <h3 className="font-semibold text-white">8. Limitation of Liability</h3>
          <p>
            To the maximum extent permitted by law, Forumo shall not be liable for indirect, incidental, or
            consequential damages arising from your use of the Platform. Our aggregate liability shall not
            exceed the fees you paid to Forumo in the preceding 12 months.
          </p>

          <h3 className="font-semibold text-white">9. Dispute Resolution</h3>
          <p>
            Disputes between buyers and sellers are handled through Forumo's dispute resolution process.
            Either party may escalate to Forumo support. Forumo's decision is final for platform-specific
            matters.
          </p>

          <h3 className="font-semibold text-white">10. Changes to Terms</h3>
          <p>
            Forumo may update these Terms. We will notify you by email and require re-acceptance when
            material changes are made. Continued use after acceptance constitutes agreement to the updated
            Terms.
          </p>

          <h3 className="font-semibold text-white">11. Governing Law</h3>
          <p>
            These Terms are governed by the laws of Ghana. Any disputes shall be resolved in the courts of
            Accra, Ghana.
          </p>

          <p className="text-xs text-slate-500 pt-2">
            Version: {TOS_VERSION} · Last updated: {TOS_VERSION}
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-700 px-6 py-4">
          {!scrolledToBottom && (
            <p className="mb-3 text-center text-xs text-slate-500">
              Scroll to the bottom to enable the &ldquo;I Agree&rdquo; button.
            </p>
          )}
          <button
            type="button"
            onClick={handleAgree}
            disabled={!scrolledToBottom || acceptTos.isPending}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {acceptTos.isPending ? 'Saving…' : 'I Agree — Continue to Forumo'}
          </button>
          {acceptTos.isError && (
            <p className="mt-2 text-center text-xs text-red-400">
              {(acceptTos.error as Error)?.message ?? 'Failed to save. Please try again.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
