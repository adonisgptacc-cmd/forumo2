import Link from "next/link";
import { redirect } from "next/navigation";

export default function NotFound() {
  async function search(formData: FormData) {
    "use server";
    const q = (formData.get("q") as string | null)?.trim();
    if (q) redirect(`/listings?keyword=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-md w-full">
        <p className="text-7xl font-bold text-[color:var(--accent)]">404</p>
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
          Page not found
        </h1>
        <p className="text-sm text-[color:var(--ink-3)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <form action={search} className="flex gap-2 mt-2">
          <input
            name="q"
            type="text"
            placeholder="Search the marketplace…"
            className="flex-1 rounded-lg border border-[color:var(--line-2)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] transition-[border-color,box-shadow] focus:border-[color:var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring-accent)]"
          />
          <button type="submit" className="btn btn-primary whitespace-nowrap">
            Search
          </button>
        </form>

        <div className="flex justify-center gap-3 pt-1">
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
          <Link href="/listings" className="btn btn-ghost">
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}
