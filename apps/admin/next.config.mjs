/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/admin",
  transpilePackages: ["@forumo/shared", "@forumo/design-system"],
  reactStrictMode: true,
};

export default nextConfig;
