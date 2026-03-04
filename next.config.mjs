/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['react-resizable-panels'],
  turbopack: {
    rules: {
      '*.mp3': { loaders: ['file-loader'], as: '*.js' },
      '*.wav': { loaders: ['file-loader'], as: '*.js' },
      '*.ogg': { loaders: ['file-loader'], as: '*.js' },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.(ogg|mp3|wav|mpe?g)$/i,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[path][name].[hash][ext]',
      },
    })
    return config
  },
}

export default nextConfig
