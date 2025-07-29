/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  // Configure the base path if needed
  // basePath: '/server',
  // Disable static optimization
  experimental: {
    // Disable static optimization
    optimizeCss: false,
    optimizePackageImports: [],
  },
  // Disable static optimization
  poweredByHeader: false,
  // Disable static optimization
  compress: false,
  // Disable static optimization
  generateEtags: false,
  // Disable static optimization
  generateBuildId: () => 'build',
  // Disable static optimization
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 0,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 0,
  },
  webpack: (config, { isServer }) => {
    // Handle native modules
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });
    return config;
  }
}

module.exports = nextConfig 