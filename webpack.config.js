// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const path = require('path')

let extractCssInstance = new MiniCssExtractPlugin({
  filename: '[chunkhash].webpicker.css'
})

let appHtml = new HtmlWebpackPlugin({
  template: 'src/app.html',
  filename: '../../templates/app.html'
})

module.exports = (env, argv) => {
  let plugins = [
    extractCssInstance,
    appHtml
  ]

  if (argv.mode === 'development') {
    // plugins.push(new BundleAnalyzerPlugin())
  } else {
    plugins.push(new TerserPlugin({ sourceMap: true }))
  }

  return {
    watch: argv.mode === 'development',
    entry: path.resolve('./src/main.js'),
    output: {
      chunkFilename: '[id].[chunkhash].js',
      path: path.resolve('./static/dist'),
      publicPath: 'static/dist/',
      filename: '[chunkhash].webpicker.js'
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        },
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.(png|jpg|jpeg|gif|eot|ttf|woff|woff2|svg|svgz)(\?.+)?$/,
          use: [{
            loader: 'url-loader',
            options: {
              publicPath: '../dist/',
              name: '[hash].[ext]',
              // outputPath: 'static/dist',
              limit: 10000
            }
          }]
        }
      ]
    },
    devtool: argv.mode === 'development' ? "cheap-eval-source-map" : "source-map",
    plugins: plugins,
    resolve: {
      extensions: ['.js', '.vue', '.json'],
      alias: {
        'vue$': 'vue/dist/vue.esm.js',
        '@': path.resolve('src')
      }
    }
  }
}
