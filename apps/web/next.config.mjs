import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@forumo/shared', '@forumo/design-system'],
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000'],
  experimental: {
    optimizeCss: true,
  },
};

// Only wrap with Sentry when DSN is configured, to avoid noise in dev
const sentryEnabled = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      hideSourceMaps: true,
      disableLogger: true,
    })
  : nextConfig;
