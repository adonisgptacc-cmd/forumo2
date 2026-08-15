import { Suspense } from "react";

import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Two-Factor Authentication — Forumo Admin" };

export default function TwoFactorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <Suspense fallback={null}>
          <TwoFactorForm />
        </Suspense>
      </div>
    </div>
  );
}
