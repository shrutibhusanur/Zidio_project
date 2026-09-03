/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Works around a Webpack crash (WasmHash._updateWithBuffer) that occurs
    // on newer Node.js versions (24+) with Next.js 14's build tooling.
    config.output.hashFunction = "sha256";
    return config;
  },
};

export default nextConfig;