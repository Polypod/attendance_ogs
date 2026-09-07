#!/usr/bin/env node
// Small helper to register path mappings to the compiled `dist` directory
const path = require('path');
const tsConfigPaths = require('tsconfig-paths');

const baseUrl = path.join(__dirname, '..', 'dist');

tsConfigPaths.register({
  baseUrl,
  paths: {
    '@/*': ['*']
  }
});
