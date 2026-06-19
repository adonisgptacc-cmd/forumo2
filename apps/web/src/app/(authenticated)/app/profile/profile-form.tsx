'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useProfile, useUpdateProfile, useDeleteAvatar, useChangePassword, useAcceptTerms, useExportMyData, useBecomeSeller } from '../../../../lib/react-query/hooks';

export function ProfileForm() {
  const { data, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const deleteAvatar = useDeleteAvatar();
  const acceptTerms = useAcceptTerms();
  const exportData = useExportMyData();
  const becomeSeller = useBecomeSeller();
  const [termsDone, setTermsDone] = useState(false);
  const [sellerDone, setSellerDone] = useState(false);

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

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [saved, setSaved] = useState(false);

  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (data?.user) {
      setName(data.user.name ?? '');
      setPhone((data.user as any).phone ?? '');
    }
    if (data?.profile) {
      setBio(data.profile.bio ?? '');
      setLocation(data.profile.location ?? '');
      setWebsite(data.profile.website ?? '');
    }
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string> = {};
    if (name.trim()) payload.name = name.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (avatarUrl.trim()) payload.avatarUrl = avatarUrl.trim();
    if (bio.trim() !== (data?.profile?.bio ?? '')) payload.bio = bio.trim();
    if (location.trim() !== (data?.profile?.location ?? '')) payload.location = location.trim();
    if (website.trim() !== (data?.profile?.website ?? '')) payload.website = website.trim();

    await updateProfile.mutateAsync(payload as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-12" />
        ))}
      </div>
    );
  }

  const user = data?.user;
  const trustScore = user ? (data?.trustSeeds ?? []).reduce((sum, s) => sum + s.value, 0) : 0;

  return (
    <div className="space-y-8">
      {/* Avatar section */}
      <div className="flex items-center gap-6">
        <div className="relative h-20 w-20 shrink-0">
          {user?.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name ?? 'Avatar'}
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--accent-bg)] text-3xl font-bold text-[color:var(--accent-2)]">
              {(user?.name ?? user?.email ?? '?')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{user?.name ?? 'No name set'}</p>
          <p className="text-xs muted">{user?.email}</p>
          <p className="mt-1 text-xs muted">
            Role: <span className="text-[color:var(--accent)]">{user?.role}</span>
          </p>
          {trustScore > 0 && (
            <p className="text-xs muted">
              Trust score: <span className="text-[color:var(--escrow)]">{trustScore}</span>
            </p>
          )}
          {user?.avatarUrl && (
            <button
              type="button"
              onClick={() => deleteAvatar.mutate()}
              disabled={deleteAvatar.isPending}
              className="mt-2 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {deleteAvatar.isPending ? 'Removing…' : 'Remove avatar'}
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={user?.name ?? 'Your name'}
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 XX XXX XXXX"
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
            <p className="mt-1 text-xs muted">International format, e.g. +233241234567</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">
            Avatar URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder={user?.avatarUrl ?? 'https://example.com/avatar.jpg'}
            className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
          />
          <p className="mt-1 text-xs muted">Leave blank to keep current avatar</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell buyers a bit about yourself…"
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)] resize-none"
          />
          <p className="mt-1 text-xs muted text-right">{bio.length}/500</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Accra, Ghana"
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--ink-2)]">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yoursite.com"
              className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
            />
          </div>
        </div>

        {updateProfile.isError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {(updateProfile.error as Error)?.message ?? 'Failed to save changes'}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="btn btn-primary"
          >
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {saved && (
            <span className="text-sm text-[color:var(--escrow)]">Saved successfully</span>
          )}
        </div>
      </form>

      {/* Trust seeds */}
      {(data?.trustSeeds ?? []).length > 0 && (
        <div className="card card-pad">
          <h3 className="mb-3 text-sm font-medium subtle">Trust score breakdown</h3>
          <ul className="space-y-2">
            {data!.trustSeeds.map((seed) => (
              <li key={seed.id} className="flex items-center justify-between text-sm">
                <span className="muted">{seed.label}</span>
                <span className={seed.value >= 0 ? 'text-[color:var(--escrow)]' : 'text-red-600'}>
                  {seed.value > 0 ? '+' : ''}{seed.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Become a Seller */}
      {data?.user?.role === 'BUYER' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Become a Seller</h3>
              <p className="text-xs muted mt-1">
                Unlock seller tools — create listings, manage orders, set up your storefront, and start earning.
              </p>
            </div>
            <span className="flex-shrink-0 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {data.user.role}
            </span>
          </div>
          {sellerDone ? (
            <p className="text-sm text-[color:var(--escrow)]">
              ✅ You&apos;re now a seller! Refresh the page to access seller tools.
            </p>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await becomeSeller.mutateAsync();
                setSellerDone(true);
              }}
              disabled={becomeSeller.isPending}
              className="btn btn-primary btn-sm"
            >
              {becomeSeller.isPending ? 'Upgrading account…' : 'Unlock Seller Account'}
            </button>
          )}
          {becomeSeller.isError && (
            <p className="text-xs text-red-600">
              {(becomeSeller.error as Error)?.message ?? 'Failed to upgrade account. Please try again.'}
            </p>
          )}
        </div>
      )}

      {/* Data & Privacy */}
      <div className="card card-pad space-y-4">
        <h3 className="text-sm font-medium subtle">Data &amp; Privacy</h3>
        <p className="text-xs muted">
          Under GDPR and CCPA you have the right to export a copy of your personal data. You can also
          re-confirm your acceptance of our current Terms of Service and Privacy Policy.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exportData.isFetching}
            className="btn btn-ghost btn-sm"
          >
            {exportData.isFetching ? 'Preparing…' : 'Download my data'}
          </button>
          <button
            type="button"
            onClick={async () => {
              await acceptTerms.mutateAsync();
              setTermsDone(true);
              setTimeout(() => setTermsDone(false), 3000);
            }}
            disabled={acceptTerms.isPending || termsDone}
            className="btn btn-ghost btn-sm"
          >
            {termsDone ? 'Confirmed' : acceptTerms.isPending ? 'Saving…' : 'Re-accept Terms & Privacy'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="card card-pad space-y-4">
        <h3 className="text-sm font-medium subtle">Change password</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (newPassword !== confirmPassword) return;
            await changePassword.mutateAsync({ currentPassword, newPassword });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordSaved(true);
            setTimeout(() => setPasswordSaved(false), 3000);
          }}
          className="space-y-3"
        >
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
            className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            required
            minLength={8}
            className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            className="w-full rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-600">Passwords do not match</p>
          )}
          {changePassword.isError && (
            <p className="text-xs text-red-600">{(changePassword.error as Error)?.message ?? 'Failed to change password'}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={changePassword.isPending || newPassword !== confirmPassword || !currentPassword}
              className="btn btn-ink btn-sm"
            >
              {changePassword.isPending ? 'Updating…' : 'Update password'}
            </button>
            {passwordSaved && <span className="text-sm text-[color:var(--escrow)]">Password updated</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
