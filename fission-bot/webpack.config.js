const webpack = require('webpack');
module.exports = env => {
  // Use env.<YOUR VARIABLE> here:
  console.log("NODE_ENV: ", env.NODE_ENV); // 'local'
  console.log("Production: ", env.production); // true

  return {
    target: "webworker",
    entry: "./index.js",
    mode: "production",
    optimization: {
      // We no not want to minimize our code.
      minimize: false,
    },
    plugins: [
      new webpack.EnvironmentPlugin(['NODE_ENV', 'DEBUG2']),
      new webpack.DefinePlugin({
        DEBUG: JSON.stringify(true),
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      }),
    ],
  };
};
