/** @type {import('next').NextConfig} */
const nextConfig = {
  // Same-origin proxy: the httpOnly `refresh_token` cookie (path=/auth, lax)
  // is only sent back to the app origin, never to the API's own :3001 origin.
  async rewrites() {
    const api = process.env.QSYSTEM_API_URL ?? 'http://127.0.0.1:3001';
    return [{ source: '/api/:path*', destination: `${api}/:path*` }];
  },
};

export default nextConfig;
