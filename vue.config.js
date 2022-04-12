const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  assetsDir: './static',
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
