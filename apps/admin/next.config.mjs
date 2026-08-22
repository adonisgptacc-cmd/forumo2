import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/admin",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@forumo/shared", "@forumo/design-system"],
  reactStrictMode: true,
};

export default nextConfig;
