/**
 * Next.js instrumentation hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Next.js 15.5+ enables instrumentation by default when this file exists.
 * This file ensures instrumentation initializes in the correct order and
 * documents the lazy-import pattern that avoids bundling Node-only modules
 * (require-in-the-middle, @opentelemetry/instrumentation) via static analysis.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Lazy dynamic import prevents webpack from statically analyzing
    // @opentelemetry/instrumentation's internal dynamic require().
    // The module is transitively required by @sentry/nextjs -> @sentry/node -> @opentelemetry/instrumentation
    // and is marked as external via serverExternalPackages + webpack.externals in next.config.mjs.
    // If direct OTel tracing is needed in web, uncomment the line below:
    // await import("@opentelemetry/instrumentation");
  }
}
