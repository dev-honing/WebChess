import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const lanAddresses = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses || [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: lanAddresses,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
