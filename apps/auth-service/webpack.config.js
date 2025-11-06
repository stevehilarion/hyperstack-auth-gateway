const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join, resolve } = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const glob = require('glob');

let prismaClientPath = null;

try {
  const matches = glob.sync(
    resolve(__dirname, '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client')
  );
  if (matches.length > 0) {
    prismaClientPath = matches[0];
    console.log(` Found Prisma Client directory: ${prismaClientPath}`);
  } else {
    console.warn('⚠️Could not find .prisma/client folder. Did you run "pnpm prisma generate"?');
  }
} catch (err) {
  console.error(' Error while resolving Prisma Client path:', err);
}

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMaps: true,
    }),

    ...(prismaClientPath
      ? [
          new CopyWebpackPlugin({
            patterns: [
              {
                from: prismaClientPath,
                to: resolve(__dirname, 'dist/node_modules/.prisma/client'),
              },
              {
                from: prismaClientPath,
                to: resolve(__dirname, '../../.prisma/client'),
              },
            ],
          }),
        ]
      : []),
  ],
};
