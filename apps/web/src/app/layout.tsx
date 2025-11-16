import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Forumo Marketplace',
  description: 'Escrow-protected marketplace for Africa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
      </body>
    </html>
  );
}
