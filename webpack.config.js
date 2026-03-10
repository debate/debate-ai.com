const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/sw/service-worker.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: { configFile: 'tsconfig.sw.json' },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: { extensions: ['.ts', '.js'] },
  output: { filename: 'service-worker.js', path: path.resolve(__dirname, 'public') },
};
