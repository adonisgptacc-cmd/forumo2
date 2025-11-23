export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center text-slate-100">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Access denied</p>
      <h1 className="text-3xl font-semibold">You need elevated privileges</h1>
      <p className="max-w-xl text-sm text-slate-400">
        This console is restricted to administrators and moderators. If you believe you should have access, please contact an
        owner to update your role.
      </p>
      <a className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-amber-400" href="/login">
        Return to login
      </a>
    </main>
  );
}
