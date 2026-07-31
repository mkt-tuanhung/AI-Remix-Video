/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // tsc đã chạy riêng (npm run typecheck) → bỏ type-check lúc build cho nhẹ RAM,
  // tránh OOM trên builder nhỏ của Render.
  typescript: { ignoreBuildErrors: true },
  // Không bundle binary ffmpeg/ffprobe — để require() phân giải đúng path lúc chạy.
  experimental: {
    serverComponentsExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
