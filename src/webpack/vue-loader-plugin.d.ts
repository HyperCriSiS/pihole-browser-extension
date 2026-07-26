declare module 'vue-loader/lib/plugin' {
  import type { WebpackPluginInstance } from 'webpack'

  const VueLoaderPlugin: {
    new (): WebpackPluginInstance
  }

  export default VueLoaderPlugin
}
