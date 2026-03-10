const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

fs.writeFileSync('./src/sw/version.ts', `export const VERSION = '${pkg.version}';\n`);

const folderPath = './.next';

function getAllFilesInDir(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`Directory ${dir} does not exist. Creating empty file list.`);
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? getAllFilesInDir(fullPath) : [fullPath];
  });
}

const files = getAllFilesInDir(folderPath)
  .filter(f => {
    // Filter out source maps and unnecessary files
    return !f.endsWith('.map') && !f.includes('node_modules');
  })
  .map((f) => `'${f.slice(5)}'`); // Remove '.next/' prefix

const fileList = `export const APP_FILE_LIST = ["/", ${files.join(',\n')}];\n`;
fs.writeFileSync('./src/sw/app-file-list.ts', fileList);

console.log(`Generated app-file-list.ts with ${files.length} files`);
