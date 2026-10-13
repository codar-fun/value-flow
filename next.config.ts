import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 帖子图片上传允许到 5 MB；框架默认的 1 MB 会在到达 /api/listing-images
  // 之前就返回 413，用户只会看到"上传失败"，永远拿不到重试提示。
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
