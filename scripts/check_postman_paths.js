const fs = require('fs');
const post = JSON.parse(fs.readFileSync('api_teamsever.json','utf8'));
const keys = new Set();
(function walk(items){ if(!Array.isArray(items)) return; for(const it of items){ if(it.request && it.request.url){ let raw=''; if(typeof it.request.url==='string') raw=it.request.url; else if(it.request.url.raw) raw=it.request.url.raw; else if(it.request.url.path) raw='/' + it.request.url.path.join('/'); const idx=raw.indexOf('/api/'); const p = idx>=0 ? raw.slice(idx) : raw; keys.add(p); } if(it.item) walk(it.item); } })(post.item);
const want = [
  '/api/workspaces/{{workspaceId}}/custom-roles',
  '/api/workspaces/{{workspaceId}}/custom-roles/{{roleId}}',
  '/api/performance/user/{{userId}}/workspace/{{workspaceId}}/details'
];
for(const w of want) console.log(w + ' -> ' + keys.has(w));
console.log('\nAll custom-roles keys:');
for(const k of [...keys].filter(k=>k.includes('custom-roles'))) console.log(k);
console.log('\nTotal keys:', keys.size);
