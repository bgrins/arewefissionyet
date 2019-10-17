const webpack = require('webpack');
const buildEnv = require('./build-env');
module.exports = _ => {
  return {
    target: "webworker",
    entry: "./index.js",
    mode: "production",
    optimization: {
      // A little easier to read the outputted file this way
      minimize: false,
    },
    plugins: [
      new webpack.DefinePlugin(buildEnv)
    ],
  };
};
