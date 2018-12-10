const webpack = require('webpack');

module.exports = {
  context: __dirname + '/viewer',
  entry: './index',
  output: {
    path: __dirname + '/www',
    filename: 'bundle.js',
    library: 'updateViewer',
    libraryTarget: 'var'
  }
};
