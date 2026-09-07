const { spawnSync } = require('node:child_process');

const nodeOptions = [process.env.NODE_OPTIONS, '--no-experimental-webstorage']
  .filter(Boolean)
  .join(' ')
  .trim();

const jestBin = require.resolve('jest/bin/jest');
const result = spawnSync(process.execPath, [jestBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
