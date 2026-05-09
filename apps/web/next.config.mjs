/** @type {import('next').NextConfig} */
const allowedOrigins = process.env.NEXT_PUBLIC_APP_URL
  ? [process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000']
  : ['http://localhost:3000'];

const nextConfig = {
  experimental: { serverActions: { allowedOrigins } },
};
export default nextConfig;
