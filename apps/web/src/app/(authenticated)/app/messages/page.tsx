import { MessagesPanel } from './messages-panel';

export default function MessagesPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Inbox</p>
        <h1 className="text-3xl font-semibold">Real-time buyer/seller messaging</h1>
        <p className="text-sm text-slate-400">Attachments, moderation flags, and delivery receipts from the shared API.</p>
      </div>
      <MessagesPanel />
    </div>
  );
}
