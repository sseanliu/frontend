/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'sharp': 'commonjs sharp',
        'canvas': 'commonjs canvas',
      })
    }
    return config
  },
  env: {
    PYTHON_PATH: process.env.PYTHON_PATH || 'python',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    },
    responseLimit: '10mb'
  }
}

module.exports = nextConfig 