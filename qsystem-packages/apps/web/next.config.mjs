/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@qsystem/ui', '@qsystem/contracts'],
  experimental: {
    optimizePackageImports: ['@qsystem/ui', 'lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data:; connect-src 'self' https: http: ws: wss:; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
  // Same-origin proxy: the httpOnly `refresh_token` cookie (path=/, lax)
  // is only sent back to the app origin, never to the API's own :3001 origin.
  async rewrites() {
    const api = process.env.QSYSTEM_API_URL ?? 'http://127.0.0.1:3001';
    return [{ source: '/api/:path*', destination: `${api}/:path*` }];
  },
};

export default nextConfig;
