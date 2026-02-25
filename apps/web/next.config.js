/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@siphon/core", "@siphon/p2p"],
  eslint: {
    // Lint runs in dedicated CI/editor steps; don't block production builds.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    Object.assign(config.resolve.alias, {
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    });
    return config;
  },
};

module.exports = nextConfig;
