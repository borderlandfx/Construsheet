/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode catches subtle React bugs during development
  reactStrictMode: true,

  // Transpile ESM-only packages for compatibility
  transpilePackages: ["@react-pdf/renderer"],

  // Allow Next.js Image to serve files from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Security headers applied to every route
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent the app from being embedded in iframes (clickjacking)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Stop browsers from MIME-sniffing the Content-Type
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Force HTTPS for 1 year, include subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Disable browser features not needed by the app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Control referrer info sent with outbound requests
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Content Security Policy
          // - script/style unsafe-inline: required by Next.js App Router
          // - unsafe-eval: required by Next.js runtime chunks
          // - wss://*.supabase.co: Supabase Realtime WebSocket
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
