const faviconsContext = require.context('!!file-loader?name=/[name].[ext]!.', true, /\.(png|ico)$/);
faviconsContext.keys().forEach(faviconsContext);