/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode for development (can cause double renders)
  reactStrictMode: true,

  // Configure external packages that should not be bundled
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],

  // Environment variables that should be available on the client
  env: {
    // Add any public env vars here
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
