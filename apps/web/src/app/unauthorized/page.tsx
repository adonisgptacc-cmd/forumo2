export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="eyebrow">Access denied</p>
      <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
        You need elevated privileges
      </h1>
      <p className="max-w-xl text-sm text-[color:var(--ink-3)]">
        This console is restricted to administrators and moderators. If you
        believe you should have access, please contact an owner to update your
        role.
      </p>
      <a className="btn btn-ghost" href="/login">
        Return to login
      </a>
    </main>
  );
}
