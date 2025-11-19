/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000'],
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
