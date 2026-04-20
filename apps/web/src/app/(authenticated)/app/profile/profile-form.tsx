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
          <div key={i} className="h-12 rounded-lg bg-slate-800" />
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
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-3xl font-bold text-amber-400">
              {(user?.name ?? user?.email ?? '?')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{user?.name ?? 'No name set'}</p>
          <p className="text-xs text-slate-400">{user?.email}</p>
          <p className="mt-1 text-xs text-slate-500">
            Role: <span className="text-amber-400">{user?.role}</span>
          </p>
          {trustScore > 0 && (
            <p className="text-xs text-slate-500">
              Trust score: <span className="text-emerald-400">{trustScore}</span>
            </p>
          )}
          {user?.avatarUrl && (
            <button
              type="button"
              onClick={() => deleteAvatar.mutate()}
              disabled={deleteAvatar.isPending}
              className="mt-2 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
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
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={user?.name ?? 'Your name'}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 XX XXX XXXX"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">International format, e.g. +233241234567</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Avatar URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder={user?.avatarUrl ?? 'https://example.com/avatar.jpg'}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">Leave blank to keep current avatar</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell buyers a bit about yourself…"
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
          />
          <p className="mt-1 text-xs text-slate-500 text-right">{bio.length}/500</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Accra, Ghana"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yoursite.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {updateProfile.isError && (
          <p className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-400">
            {(updateProfile.error as Error)?.message ?? 'Failed to save changes'}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400">Saved successfully</span>
          )}
        </div>
      </form>

      {/* Trust seeds */}
      {(data?.trustSeeds ?? []).length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-300">Trust score breakdown</h3>
          <ul className="space-y-2">
            {data!.trustSeeds.map((seed) => (
              <li key={seed.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{seed.label}</span>
                <span className={seed.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {seed.value > 0 ? '+' : ''}{seed.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Become a Seller */}
      {data?.user?.role === 'BUYER' && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-amber-300">Become a Seller</h3>
              <p className="text-xs text-slate-400 mt-1">
                Unlock seller tools — create listings, manage orders, set up your storefront, and start earning.
              </p>
            </div>
            <span className="flex-shrink-0 rounded-full border border-amber-700 px-2 py-0.5 text-xs text-amber-400">
              {data.user.role}
            </span>
          </div>
          {sellerDone ? (
            <p className="text-sm text-emerald-400">
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
              className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {becomeSeller.isPending ? 'Upgrading account…' : 'Unlock Seller Account'}
            </button>
          )}
          {becomeSeller.isError && (
            <p className="text-xs text-red-400">
              {(becomeSeller.error as Error)?.message ?? 'Failed to upgrade account. Please try again.'}
            </p>
          )}
        </div>
      )}

      {/* Data & Privacy */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <h3 className="text-sm font-medium text-slate-300">Data &amp; Privacy</h3>
        <p className="text-xs text-slate-500">
          Under GDPR and CCPA you have the right to export a copy of your personal data. You can also
          re-confirm your acceptance of our current Terms of Service and Privacy Policy.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exportData.isFetching}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:border-slate-400 hover:text-white disabled:opacity-50 transition-colors"
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
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:border-slate-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {termsDone ? 'Confirmed' : acceptTerms.isPending ? 'Saving…' : 'Re-accept Terms & Privacy'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <h3 className="text-sm font-medium text-slate-300">Change password</h3>
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
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-400">Passwords do not match</p>
          )}
          {changePassword.isError && (
            <p className="text-xs text-red-400">{(changePassword.error as Error)?.message ?? 'Failed to change password'}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={changePassword.isPending || newPassword !== confirmPassword || !currentPassword}
              className="rounded-lg bg-slate-700 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
            >
              {changePassword.isPending ? 'Updating…' : 'Update password'}
            </button>
            {passwordSaved && <span className="text-sm text-emerald-400">Password updated</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
