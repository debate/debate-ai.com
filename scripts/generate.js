const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

fs.writeFileSync('./src/sw/version.ts', `export const VERSION = '${pkg.version}';\n`);

const folderPath = './.next/static';

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

// App routes to cache for offline navigation
const appRoutes = ['/', '/debate', '/videos', '/lectures', '/rank', '/cards', '/edit'];

// Public static assets
const publicAssets = [
  '/favicon.ico',
  '/favicon-192.png',
  '/favicon-512.png',
  '/apple-touch-icon.png',
  '/site.webmanifest',
];

// Next.js static files served at /_next/static/...
// .next/static/foo.js -> /_next/static/foo.js
const staticFiles = getAllFilesInDir(folderPath)
  .filter(f => {
    // Filter out source maps and unnecessary files
    return !f.endsWith('.map') && !f.includes('node_modules');
  })
  .map((f) => {
    // .next/static/... -> /_next/static/...
    const relativePath = f.replace(/^\.next/, '/_next');
    return `'${relativePath}'`;
  });

const allFiles = [
  ...appRoutes.map(r => `'${r}'`),
  ...publicAssets.map(a => `'${a}'`),
  ...staticFiles,
];

const fileList = `export const APP_FILE_LIST = [\n  ${allFiles.join(',\n  ')}\n];\n`;
fs.writeFileSync('./src/sw/app-file-list.ts', fileList);

console.log(`Generated app-file-list.ts with ${allFiles.length} files`);
