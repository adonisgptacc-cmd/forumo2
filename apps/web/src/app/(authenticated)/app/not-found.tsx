import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-4 px-4">
      <p className="text-6xl font-bold text-[color:var(--accent)]">404</p>
      <h1 className="h2">Page not found</h1>
      <p className="text-sm muted max-w-sm">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <div className="flex gap-3 pt-2">
        <Link href="/app" className="btn btn-primary">
          Go to dashboard
        </Link>
        <Link href="/app/orders" className="btn btn-ghost">
          My orders
        </Link>
      </div>
    </div>
  );
}
