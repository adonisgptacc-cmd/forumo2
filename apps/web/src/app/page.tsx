import Link from "next/link";
import Image from "next/image";
import { FeaturedListings } from "./featured-listings";

const categories = [
  {
    id: 1,
    title: "Electronics",
    image: "/forumo_hero.png",
    link: "/listings?keyword=electronics",
    desc: "Phones, laptops & gadgets",
  },
  {
    id: 2,
    title: "Fashion",
    image: "/cat_fashion.png",
    link: "/listings?keyword=fashion",
    desc: "Clothing, shoes & accessories",
  },
  {
    id: 3,
    title: "Home & Kitchen",
    image: "/cat_home.png",
    link: "/listings?keyword=home",
    desc: "Furniture, decor & appliances",
  },
  {
    id: 4,
    title: "Deals",
    image: "/cat_electronics.png",
    link: "/listings",
    desc: "Browse all marketplace deals",
  },
];

export default function HomePage() {
  return (
    <div className="relative pb-10">
      {/* Hero Section */}
      <div className="relative w-full h-[600px] overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-[var(--bg)] z-10" />
        <Image
          src="/forumo_hero.png"
          alt="Forumo Hero"
          fill
          className="object-cover object-top"
          priority
        />
      </div>

      {/* Categories Grid (Overlapping Hero) */}
      <div className="relative z-20 -mt-80 px-4 hero-glow">
        <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={cat.link as any}
              className="card-forumo flex flex-col h-[420px] hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-bold mb-1">{cat.title}</h2>
              <p className="text-sm text-slate-500 mb-3">{cat.desc}</p>
              <div className="relative flex-1 mb-4">
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-forumo-link hover:text-forumo-orange text-sm font-medium">
                Shop now
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Listings from API */}
      <div className="mt-8 px-4">
        <FeaturedListings />
      </div>

      {/* Quick Links */}
      <div className="stagger mt-6 px-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/listings/new"
          className="card-forumo hover:shadow-lg transition-shadow flex items-center gap-4"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent-bg)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              style={{ color: "var(--accent)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm">Sell on Forumo</p>
            <p className="text-xs text-slate-500">
              List your products and reach buyers across Africa
            </p>
          </div>
        </Link>
        <Link
          href="/auctions"
          className="card-forumo hover:shadow-lg transition-shadow flex items-center gap-4"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--escrow-bg)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              style={{ color: "var(--escrow)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm">Live Auctions</p>
            <p className="text-xs text-slate-500">
              Bid on unique items with anti-sniping protection
            </p>
          </div>
        </Link>
        <Link
          href="/app"
          className="card-forumo hover:shadow-lg transition-shadow flex items-center gap-4"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              style={{ color: "var(--ink-2)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm">Escrow Protection</p>
            <p className="text-xs text-slate-500">
              Every purchase protected with secure escrow payments
            </p>
          </div>
        </Link>
      </div>

      {/* Bottom Sign-in (Forumo Style) */}
      <div
        className="mt-8 py-8 text-center px-4"
        style={{
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <p className="text-sm mb-2">See personalized recommendations</p>
        <Link
          href="/login"
          className="btn-forumo inline-block w-full max-w-xs mb-2"
        >
          Sign in
        </Link>
        <p className="text-xs">
          New customer?{" "}
          <Link href="/signup" className="text-forumo-link">
            Start here.
          </Link>
        </p>
      </div>
    </div>
  );
}
