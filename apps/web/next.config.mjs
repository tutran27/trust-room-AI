/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source; let Next transpile them.
  transpilePackages: ['@trustroom/ui', '@trustroom/types'],
  webpack: (config) => {
    // Those packages use ESM-style `.js` import specifiers that actually point at
    // `.ts`/`.tsx` source. Teach webpack to resolve `.js` -> TS source.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
