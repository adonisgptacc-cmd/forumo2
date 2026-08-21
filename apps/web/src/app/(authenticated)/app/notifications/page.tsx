import { NotificationsView } from "./notifications-view";

export const metadata = { title: "Notifications — Forumo" };

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-slate-400 mt-1">
          Stay up to date with your orders, offers, and messages.
        </p>
      </div>
      <NotificationsView />
    </div>
  );
}
