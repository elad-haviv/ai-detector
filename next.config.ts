import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf.js loads its worker by file path; bundling breaks that, so load it from node_modules at runtime.
  serverExternalPackages: ['pdfjs-dist', 'mammoth'],
  output: 'standalone',
  // The standalone build copies only files it can trace. pdf.js imports its worker by a computed path,
  // so the tracer misses it and PDF uploads fail in the Docker image without this.
  outputFileTracingIncludes: { '/api/extract': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'] },
  // API requests and answers can carry keys or user text: never cache them anywhere.
  async headers() {
    return [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] }];
  },
};

export default nextConfig;
