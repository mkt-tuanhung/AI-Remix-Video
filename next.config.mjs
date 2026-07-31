/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
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
