const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  assetsDir: './static',
  publicPath: './',
  configureWebpack: {
    output: {
      filename: './static/js/[name].[chunkhash:8].js',
      chunkFilename: './static/js/[name].[chunkhash:8].js'
    },
    devtool: 'source-map'
  },
  transpileDependencies: [
    'vuetify'
  ]
})
