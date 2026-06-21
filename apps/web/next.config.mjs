/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source; let Next transpile them.
  transpilePackages: ['@trustroom/ui', '@trustroom/types'],
  // Proxy /api/* and /socket.io/ to the NestJS backend on port 4000.
  // This keeps everything on one origin — no CORS, one ngrok tunnel.
  async rewrites() {
    const apiBase = process.env.API_PROXY_URL || 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${apiBase}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${apiBase}/socket.io/:path*` },
    ];
  },
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
