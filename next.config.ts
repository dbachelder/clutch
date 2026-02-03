import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev server access from LAN
  allowedDevOrigins: [
    "http://192.168.7.200:3002",
    "http://localhost:3002",
  ],
};

export default nextConfig;
