const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const VERSION = pkg.version;
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

// App routes to cache for offline navigation (excluded to prevent aggressive caching)
const appRoutes = [];

// Public static assets
const publicAssets = [
  '/favicon.ico',
  '/favicon-192.png',
  '/favicon-512.png',
  '/apple-touch-icon.png',
  '/site.webmanifest',
];

// Next.js static files served at /_next/static/...
const staticFiles = getAllFilesInDir(folderPath)
  .filter(f => !f.endsWith('.map') && !f.includes('node_modules'))
  .map(f => f.replace(/^\.next/, '/_next'));

const allFiles = [...appRoutes, ...publicAssets, ...staticFiles];

const fileList = `export const APP_FILE_LIST = [\n  ${allFiles.map(f => `'${f}'`).join(',\n  ')}\n];\n`;
fs.writeFileSync('./lib/serviceworker/app-file-list.ts', fileList);

const versionFile = `export const VERSION = '${VERSION}';\n`;
fs.writeFileSync('./lib/serviceworker/version.ts', versionFile);

console.log(`Generated app-file-list.ts and version.ts with ${allFiles.length} files`);

