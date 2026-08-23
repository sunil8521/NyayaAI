import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_INTERNAL_URL!;

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: [
    "rocky.legal",
    "www.rocky.legal",
    "localhost",
    "127.0.0.1",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${backendUrl}/api/auth/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${backendUrl}/users/:path*`,
      },
      {
        source: "/api/chat",
        destination: `${backendUrl}/chat`,
      },
    ];
  },
};

export default nextConfig;

