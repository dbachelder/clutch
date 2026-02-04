import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev server access from anywhere (dev only)
  // These are hostnames, not full URLs
  allowedDevOrigins: [
    "192.168.7.200",
    "ada.codesushi.com",
  ],
};

export default nextConfig;
