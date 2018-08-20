const path = require('path')
var webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'pages')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.scss$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          { loader: 'sass-loader' }
        ]
      },
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' }
        ]
      },
      {
        test: /\.modernizrrc\.js$/,
        use: {
          loader: 'webpack-modernizr-loader',
        }
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '/[name].[ext]'
          }
        }
      },
      {
        test: /\.jpg$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '/[name].[ext]'
          }
        }
      },
      {
        test: /\.(png|ico)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '/[name].[ext]'
          }
        }
      },
      {
        test: /\.(mp4|ogv)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '/[name].[ext]'
          }
        }
      }
    ]
  },
  resolve: {
    alias: {
      modernizr$: path.resolve(__dirname, '.modernizrrc.js')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      firebase: 'firebase'
    }),
    new webpack.DefinePlugin({
      MODE: JSON.stringify(process.env.npm_lifecycle_script.substr(process.env.npm_lifecycle_script.indexOf('--mode ') + '--mode '.length, process.env.npm_lifecycle_script.substr(process.env.npm_lifecycle_script.indexOf('--mode ') + '--mode '.length).search(/($|\s)/))),
      PACKAGE: {
        VERSION: JSON.stringify(process.env.npm_package_version)
      }
    })
  ]
}