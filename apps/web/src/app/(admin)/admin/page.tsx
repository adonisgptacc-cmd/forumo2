export default function AdminHome() {
  return (
    <div className="grid-card space-y-3">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Operational control</p>
      <h2 className="text-2xl">Review sensitive flows</h2>
      <p className="text-slate-300">
        Use the KYC queue, listing moderation, and dispute dashboards to keep the marketplace safe. These surfaces read from
        the same API the staff tools use so you can validate RBAC and payloads end-to-end.
      </p>
    </div>
  );
}
