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
  }
}

module.exports = nextConfig 