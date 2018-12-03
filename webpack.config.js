const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')
const path = require('path')

let extractCssInstance = new MiniCssExtractPlugin({
  filename: 'static/dist/webpicker.css'
})

let languageReplacement = new webpack.NormalModuleReplacementPlugin(
  /element-ui[\/\\]lib[\/\\]locale[\/\\]lang[\/\\]zh-CN/,
  'element-ui/lib/locale/lang/en'
)

let appHtml = new HtmlWebpackPlugin({
  template: 'src/app.html',
  filename: 'templates/app.html',
  hash: true
})

module.exports = (env, argv) => {
  let plugins = [
    extractCssInstance,
    languageReplacement,
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
      path: path.resolve('.'),
      publicPath: '',
      filename: 'static/dist/webpicker.js'
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
              outputPath: 'static/dist',
              limit: 10000
            }
          }]
        }
      ]
    },
    devtool: argv.mode === 'development' ? "cheap-eval-source-map" : "source-map",
    plugins: plugins,
    resolve: {
      alias: {
        'vue$': 'vue/dist/vue.esm.js'
      }
    }
  }
}
