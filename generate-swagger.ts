import fs from 'fs';
import swaggerSpec from './src/config/swagger';

fs.writeFileSync('api_teamsever_openapi.json', JSON.stringify(swaggerSpec, null, 2));
console.log('OpenAPI JSON generated at api_teamsever_openapi.json');
