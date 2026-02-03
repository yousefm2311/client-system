import type { NextConfig } from "next";

const maxFileSizeMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? 50);
const middlewareBodySize = Number.isFinite(maxFileSizeMb)
  ? `${maxFileSizeMb}mb`
  : "50mb";

const nextConfig: NextConfig = {
  experimental: {
    middlewareClientMaxBodySize: middlewareBodySize,
  },
};

export default nextConfig;
