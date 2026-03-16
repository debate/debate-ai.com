#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LECTURES_PATH = path.join(__dirname, '../lib/debate-data/debate-videos/debate-lectures.json');

console.log('🔧 Fixing lectures JSON file...\n');

// Read the file as text
const content = fs.readFileSync(LECTURES_PATH, 'utf8');

// Try to parse it first to see if it's valid
try {
  const data = JSON.parse(content);
  console.log('✅ JSON is already valid!');
  console.log(`📊 Total entries: ${data.data.length}`);
  process.exit(0);
} catch (e) {
  console.log('❌ JSON is invalid, attempting to fix...');
  console.log(`   Error: ${e.message}\n`);
}

// Remove trailing commas before closing brackets/braces
let fixed = content;

// Fix trailing commas in arrays
fixed = fixed.replace(/,(\s*])/g, '$1');

// Fix trailing commas in objects
fixed = fixed.replace(/,(\s*})/g, '$1');

// Try to parse the fixed content
try {
  const data = JSON.parse(fixed);
  console.log('✅ Successfully fixed the JSON!');
  console.log(`📊 Total entries: ${data.data.length}`);

  // Write back with proper formatting
  fs.writeFileSync(LECTURES_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('💾 File saved successfully');

} catch (e) {
  console.error('❌ Could not fix the JSON automatically');
  console.error(`   Error: ${e.message}`);
  process.exit(1);
}
