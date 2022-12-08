const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const path = require("path");

const editorConfig = {
  entry: "./src/client/client.ts",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "./index.js",
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      path: require.resolve("path-browserify"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                sourceMap: true,
              },
            },
          },
        ],
      },
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false, // disable the behaviour
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.ttf$/,
        type: "asset/resource",
      },
    ],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "public"),
    },
    compress: true,
    port: 3000,
  },
  plugins: [new MonacoWebpackPlugin()],
};

// const workerConfig = {
//   entry: "./src/service-worker/service-worker.ts",
//   output: {
//     path: path.resolve(__dirname, "dist"),
//     filename: "./worker.js",
//   },
//   resolve: {
//     fallback: {
//       path: require.resolve("path-browserify"),
//     },
//   },
//   module: {
//     rules: [
//       {
//         test: /\.ts$/,
//         exclude: /node_modules/,
//         use: [
//           {
//             loader: "ts-loader",
//             options: {
//               compilerOptions: {
//                 sourceMap: true,
//               },
//             },
//           },
//         ],
//       },
//       {
//         test: /\.css$/,
//         use: ["style-loader", "css-loader"],
//       },
//       {
//         test: /\.ttf$/,
//         type: "asset/resource",
//       },
//     ],
//   },
//   plugins: [new MonacoWebpackPlugin()],
// };

module.exports = [editorConfig]