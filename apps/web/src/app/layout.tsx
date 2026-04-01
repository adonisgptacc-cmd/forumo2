import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '../components/app-providers';
import { ForumoHeader } from '../components/forumo-header';
import { ForumoFooter } from '../components/forumo-footer';

export const metadata: Metadata = {
  title: 'Forumo Marketplace',
  description: 'Escrow-protected marketplace for Africa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppProviders>
          <ForumoHeader />
          <main className="mx-auto max-w-[1500px] bg-[#f3f3f3]">
            {children}
          </main>
          <ForumoFooter />
        </AppProviders>
      </body>
    </html>
  );
}
