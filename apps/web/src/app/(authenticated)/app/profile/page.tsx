import { ProfileForm } from "./profile-form";
import { AddressBook } from "./address-book";

export const metadata = { title: "My Profile — Forumo" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="h2">My Profile</h2>
        <p className="text-sm muted">
          Manage your account details and preferences
        </p>
      </div>
      <div className="card card-pad">
        <ProfileForm />
      </div>
      <AddressBook />
    </div>
  );
}
