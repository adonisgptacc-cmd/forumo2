'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useProfile, useUpdateProfile, useDeleteAvatar } from '../../../../lib/react-query/hooks';

export function ProfileForm() {
  const { data, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const deleteAvatar = useDeleteAvatar();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.user) {
      setName(data.user.name ?? '');
      setAvatarUrl('');
    }
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: { name?: string; phone?: string; avatarUrl?: string } = {};
    if (name.trim()) payload.name = name.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (avatarUrl.trim()) payload.avatarUrl = avatarUrl.trim();

    await updateProfile.mutateAsync(payload);
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Avatar URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
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

      {/* Profile extras */}
      {data?.profile && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <h3 className="text-sm font-medium text-slate-300">Profile details</h3>
          {data.profile.bio && (
            <p className="text-sm text-slate-400">{data.profile.bio}</p>
          )}
          {data.profile.location && (
            <p className="text-xs text-slate-500">
              Location: <span className="text-slate-300">{data.profile.location}</span>
            </p>
          )}
          {data.profile.website && (
            <p className="text-xs text-slate-500">
              Website:{' '}
              <a
                href={data.profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline"
              >
                {data.profile.website}
              </a>
            </p>
          )}
        </div>
      )}

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
    </div>
  );
}
