const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  target: 'node',
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    devtoolModuleFilenameTemplate:
      process.env.NODE_ENV !== 'production' ? '[absolute-resource-path]' : undefined,
  },
  plugins: [
    new NxAppWebpackPlugin({
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      compiler: 'tsc', // compile using tsc
      generatePackageJson: true,
      outputHashing: 'none',
      optimization: false,
      sourceMap: true,
    }),
  ],
};
