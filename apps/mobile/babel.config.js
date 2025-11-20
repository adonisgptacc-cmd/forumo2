module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          alias: {
            '@forumo/shared': '../../packages/shared/src',
          },
        },
      ],
    ],
    babelrcRoots: [__dirname, '..', '../..'],
  };
};
