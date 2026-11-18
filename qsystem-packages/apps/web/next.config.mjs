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
  // Same-origin proxy is enabled only when the deployment provides an API URL.
  // Local UI-only runs stay on the web origin and use the existing fallback data.
  async rewrites() {
    const api = process.env.QSYSTEM_API_URL?.trim();
    return api ? [{ source: '/api/:path*', destination: `${api}/:path*` }] : [];
  },
};

export default nextConfig;
