const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
function check(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'vendor') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) check(file);
    else if (/\.(c?js)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', windowsHide: true });
      if (result.status !== 0) process.exitCode = 1;
    }
  }
}
for (const dir of ['server', 'public/js', 'tests']) check(path.join(root, dir));
if (!process.exitCode) console.log('Sintaxe JavaScript válida (node --check).');
