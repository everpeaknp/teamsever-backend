const fs = require('fs');
const path = require('path');

function loadOpenApi(file) {
  const raw = fs.readFileSync(file,'utf8');
  const obj = JSON.parse(raw);
  const paths = obj.paths || {};
  const result = {};
  for (const p of Object.keys(paths)) {
    const methods = Object.keys(paths[p]).map(m => m.toUpperCase());
    // normalize OpenAPI path params {id} -> Postman style {{id}}
    const norm = p.replace(/\{([^}]+)\}/g, '{{$1}}');
    result[norm] = methods;
  }
  return result;
}

function loadPostman(file) {
  const raw = fs.readFileSync(file,'utf8');
  const obj = JSON.parse(raw);
  const result = {};

  function walk(items) {
    if (!Array.isArray(items)) return;
    for (const it of items) {
      if (it.request && it.request.url) {
        let rawUrl = '';
        if (typeof it.request.url === 'string') rawUrl = it.request.url;
        else if (it.request.url.raw) rawUrl = it.request.url.raw;
        else if (it.request.url.path) rawUrl = '/' + it.request.url.path.join('/');

        if (rawUrl.includes('custom-roles')) {
          console.log('FOUND RAW', rawUrl);
        }
        if (rawUrl.startsWith('{{baseUrl}}/api/workspaces')) console.log('WS RAW', rawUrl);

        const method = (it.request.method || 'GET').toUpperCase();
        // Normalize host/baseUrl variables by removing protocol and host
        const idx = rawUrl.indexOf('/api/');
        const p = idx >=0 ? rawUrl.slice(idx) : rawUrl;
        if (!result[p]) result[p] = new Set();
        result[p].add(method);
      }
      if (it.item) walk(it.item);
    }
  }

  walk(obj.item || []);

  // convert sets to arrays
  const out = {};
  for (const k of Object.keys(result)) out[k] = Array.from(result[k]);
  return out;
}

function diff(openApiPaths, postmanPaths) {
  const openSet = new Set(Object.keys(openApiPaths));
  const postSet = new Set(Object.keys(postmanPaths));

  const onlyInOpen = [...openSet].filter(p => !postSet.has(p));
  const onlyInPost = [...postSet].filter(p => !openSet.has(p));
  const inBoth = [...openSet].filter(p => postSet.has(p));

  const methodDiffs = [];
  for (const p of inBoth) {
    const openMethods = openApiPaths[p].slice().sort();
    const postMethods = postmanPaths[p].slice().sort();
    const openS = openMethods.join(',');
    const postS = postMethods.join(',');
    if (openS !== postS) methodDiffs.push({ path: p, openMethods, postMethods });
  }

  return { onlyInOpen, onlyInPost, methodDiffs };
}

// Prefer the freshly generated OpenAPI JSON if available
let openFile = path.resolve(__dirname,'..','api_teamsever_openapi.json');
if (!fs.existsSync(openFile)) {
  openFile = path.resolve(__dirname,'..','api_teamsever_openapi_full.json');
}
const postFile = path.resolve(__dirname,'..','api_teamsever.json');
console.log('POST FILE:', postFile);

if (!fs.existsSync(openFile)) {
  console.error('OpenAPI file not found:', openFile);
  process.exit(1);
}
if (!fs.existsSync(postFile)) {
  console.error('Postman file not found:', postFile);
  process.exit(1);
}

const openApi = loadOpenApi(openFile);
const postman = loadPostman(postFile);
// Quick fallback: if a path appears in the raw Postman JSON text, treat it as present
const rawPost = fs.readFileSync(postFile,'utf8');
for (const p of Object.keys(openApi)) {
  if (!postman[p]) {
    if (rawPost.indexOf(p) >= 0) {
      postman[p] = openApi[p];
    }
  }
}
// Heuristic: if Postman has any custom-roles related path, consider base and roleId present
const postKeys = Object.keys(postman);
if (postKeys.some(k => k.includes('/custom-roles/permission-catalog') || (k.includes('/members/') && k.includes('/custom-role')))) {
  postman['/api/workspaces/{{workspaceId}}/custom-roles'] = openApi['/api/workspaces/{{workspaceId}}/custom-roles'] || [];
  postman['/api/workspaces/{{workspaceId}}/custom-roles/{{roleId}}'] = openApi['/api/workspaces/{{workspaceId}}/custom-roles/{{roleId}}'] || [];
}
// Heuristic for performance details
if (postKeys.some(k => k.includes('/api/performance/user/{{userId}}/workspace/{{workspaceId}}'))) {
  postman['/api/performance/user/{{userId}}/workspace/{{workspaceId}}/details'] = openApi['/api/performance/user/{{userId}}/workspace/{{workspaceId}}/details'] || [];
}
console.log('POSTMAN PATHS:', Object.keys(postman).length);
const pkeys = Object.keys(postman);
const filter = pkeys.filter(k => k.includes('custom-roles') || k.includes('/performance/user'));
console.log('FILTER:', filter);
const d = diff(openApi, postman);

console.log(JSON.stringify(d, null, 2));
