import { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "../../../components/signout-button";
import { NotificationNavLink } from "../../../components/notification-badge";
import { MessagesNavLink } from "../../../components/messages-nav-link";
import { authOptions } from "../../../lib/auth";

const buyerNavItems = [
  { href: "/app", label: "Overview" },
  { href: "/app/orders", label: "Orders" },
  { href: "/app/returns", label: "Returns" },
  { href: "/app/disputes", label: "Disputes" },
  { href: "/app/offers", label: "Offers" },
  { href: "/app/wishlist", label: "Wishlist" },
  { href: "/app/cart", label: "Cart" },
  { href: "/app/reviews", label: "My Reviews" },
  { href: "/app/profile", label: "Profile" },
  { href: "/app/kyc", label: "Verification" },
  { href: "/app/settings/account", label: "Account Settings" },
];

const sellerOnlyNavItems = [
  { href: "/app/dashboard", label: "Seller Dashboard" },
  { href: "/app/listings", label: "My Listings" },
  { href: "/app/storefront", label: "Storefront" },
  { href: "/app/auctions/new", label: "Create Auction" },
  { href: "/app/inventory", label: "Inventory" },
  { href: "/app/payouts", label: "Payouts" },
  { href: "/app/dashboard/analytics", label: "Analytics" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/app");
  }

  const isSeller =
    (session.user as any).role === "SELLER" ||
    (session.user as any).role === "ADMIN";
  const navItems = isSeller
    ? [...sellerOnlyNavItems, ...buyerNavItems]
    : buyerNavItems;

  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <header className="card card-pad">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>
              Secure workspace
            </p>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session.user?.name ?? "Unnamed User"}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-3)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session.user?.email}
            </p>
          </div>
          <SignOutButton />
        </div>
        <nav
          style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}
        >
          {navItems.map((item) => (
            <Link key={item.href} href={item.href as any} className="chip">
              {item.label}
            </Link>
          ))}
          <MessagesNavLink />
          <NotificationNavLink />
        </nav>
      </header>
      <section>{children}</section>
    </div>
  );
}
