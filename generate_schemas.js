const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'lib/debate-data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !f.endsWith('.schema.json'));

function inferType(val) {
  if (val === null) return { type: 'null' };
  if (Array.isArray(val)) {
    if (val.length > 0) {
      if (Array.isArray(val[0])) {
         // tuple
         const prefixItems = val[0].map(inferType);
         return {
           type: 'array',
           prefixItems: prefixItems,
           items: false
         };
      }
      return { type: 'array', items: inferType(val[0]) };
    }
    return { type: 'array' };
  }
  if (typeof val === 'object') {
    const props = {};
    for (const key in val) {
      props[key] = inferType(val[key]);
    }
    return { type: 'object', properties: props };
  }
  if (typeof val === 'number') {
    return { type: Number.isInteger(val) ? 'integer' : 'number' };
  }
  return { type: typeof val };
}

for (const file of files) {
  const filePath = path.join(dataDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: `Schema for ${file}`
  };

  if (Array.isArray(data)) {
    schema.type = 'array';
    if (data.length > 0) {
      if (Array.isArray(data[0])) {
        schema.items = {
          type: 'array',
          prefixItems: data[0].map(inferType),
          items: false
        };
      } else {
        schema.items = inferType(data[0]);
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    Object.assign(schema, inferType(data));
  }

  const outPath = filePath.replace('.json', '.schema.json');
  fs.writeFileSync(outPath, JSON.stringify(schema, null, 2));
  console.log(`Generated schema for ${file}`);
}
