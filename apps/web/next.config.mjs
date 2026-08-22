import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@forumo/shared", "@forumo/design-system"],
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: ["http://127.0.0.1:3000", "http://localhost:3000"],
  // Fix webpack Critical dependency warnings from require-in-the-middle and @opentelemetry/instrumentation
  // These are Node-only modules with dynamic require() that cannot be statically analyzed.
  // serverExternalPackages prevents Next from trying to bundle them.
  serverExternalPackages: [
    "require-in-the-middle",
    "@opentelemetry/instrumentation",
  ],
  experimental: {
    optimizeCss: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals ?? [];
      // Extra guard: ensure Node-only deps stay external even when wrapped by withSentryConfig
      const externalsToAdd = [
        "require-in-the-middle",
        "@opentelemetry/instrumentation",
      ];
      if (Array.isArray(config.externals)) {
        for (const ext of externalsToAdd) {
          if (!config.externals.includes(ext)) config.externals.push(ext);
        }
      }
    }
    return config;
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
