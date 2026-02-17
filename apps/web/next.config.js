/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@siphon/core", "@siphon/p2p"],
  webpack: (config) => {
    config.externals.push("better-sqlite3");
    return config;
  },
};

module.exports = nextConfig;
