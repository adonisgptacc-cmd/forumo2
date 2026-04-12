import { ProfileForm } from './profile-form';
import { AddressBook } from './address-book';

export const metadata = { title: 'My Profile — Forumo' };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">My Profile</h2>
        <p className="text-sm text-slate-400">Manage your account details and preferences</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <ProfileForm />
      </div>
      <AddressBook />
    </div>
  );
}
