import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf.js loads its worker by file path; bundling breaks that, so load it from node_modules at runtime.
  serverExternalPackages: ['pdfjs-dist', 'mammoth'],
  output: 'standalone',
};

export default nextConfig;
