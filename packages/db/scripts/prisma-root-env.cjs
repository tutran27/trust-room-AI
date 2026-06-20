const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env'),
});

const prismaCli = require.resolve('prisma/build/index.js');
const args = process.argv.slice(2);

const child = spawn(process.execPath, [prismaCli, ...args], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
