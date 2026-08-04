"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Users,
  Package,
  ShieldCheck,
  Scale,
  Flag,
  BarChart2,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

const nav = [
  { label: "Users", href: "/users", icon: Users },
  { label: "Listings", href: "/listings", icon: Package },
  { label: "KYC Queue", href: "/kyc", icon: ShieldCheck },
  { label: "Disputes", href: "/disputes", icon: Scale },
  { label: "Moderation", href: "/moderation", icon: Flag },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex h-14 items-center border-b border-gray-200 px-4">
        <span className="font-semibold text-gray-900 tracking-tight">
          Forumo Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-gray-200 text-gray-900"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <button
          onClick={async () => {
            await signOut({ redirect: false });
            router.push("/login");
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
