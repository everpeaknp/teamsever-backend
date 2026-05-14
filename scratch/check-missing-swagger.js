const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/routes/**/*.ts');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  let currentSwagger = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('@swagger')) {
      currentSwagger = true;
    }
    
    // reset swagger block if we see router.METHOD without a swagger recently
    if (line.match(/router\.(get|post|put|patch|delete)\(/) || line.match(/\.(get|post|put|patch|delete)\(/)) {
      // Check last 15 lines for swagger
      let hasSwagger = false;
      for(let j = Math.max(0, i - 30); j < i; j++) {
        if(lines[j].includes('@swagger') || lines[j].includes('route(')) {
          hasSwagger = true;
          break;
        }
      }
      
      if (!hasSwagger && !line.includes('//') && !line.includes('module.exports')) {
         console.log(`Missing Swagger in ${file}:${i+1} -> ${line.trim()}`);
      }
    }
  }
}
