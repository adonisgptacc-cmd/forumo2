"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "forumo_cookie_consent";

type ConsentChoice = "all" | "essential";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  function accept(choice: ConsentChoice) {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ choice, at: new Date().toISOString() }),
    );
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#131921] border-t border-slate-700 shadow-2xl">
      <div className="mx-auto max-w-[1500px] px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-300 leading-relaxed">
          We use cookies to keep you signed in and to understand how you use
          Forumo. By clicking <strong className="text-white">Accept All</strong>
          , you consent to our use of analytics cookies. See our{" "}
          <Link href="/privacy" className="text-amber-400 hover:underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={() => accept("essential")}
            className="rounded border border-slate-500 px-4 py-2 text-sm text-slate-300 hover:border-slate-300 hover:text-white transition-colors"
          >
            Essential Only
          </button>
          <button
            onClick={() => accept("all")}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
