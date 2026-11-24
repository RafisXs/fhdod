const path = require('node:path');

// First value wins; externally supplied environment variables retain priority.
require('dotenv').config({
  path: [path.resolve(__dirname, '../../.env'), path.resolve(__dirname, '../../../.env'), path.resolve(__dirname, '../../../../.env')],
  quiet: true,
});
