import fs from 'node:fs';

let key = process.env.RENDER_API_KEY;
if (!key && fs.existsSync('.env.deploy')) {
  const envContent = fs.readFileSync('.env.deploy', 'utf-8');
  const match = envContent.match(/RENDER_API_KEY=(.*)/);
  if (match) key = match[1].trim();
}

const ownerId = process.env.RENDER_OWNER_ID || 'tea-dbu0u6gu01pc73dbmsn0';

export async function createRenderService(repoUrl, name = 'campus-desk-api') {
  if (!key) {
    console.error('Error: RENDER_API_KEY is required. Set it in environment or .env.deploy.');
    process.exit(1);
  }

  console.log(`Creating Render Web Service [${name}] for repo: ${repoUrl}...`);
  const payload = {
    type: 'web_service',
    name: name,
    ownerId: ownerId,
    repo: repoUrl,
    autoDeploy: 'yes',
    branch: 'main',
    serviceDetails: {
      env: 'node',
      plan: 'free',
      region: 'singapore',
      rootDir: 'backend',
      healthCheckPath: '/health',
      envSpecificDetails: {
        buildCommand: 'npm install && npm run build',
        startCommand: 'npm start'
      },
      envVars: [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'MONGODB_URI', value: process.env.MONGODB_URI || 'mongodb+srv://ordhatrak855_db_user:pucTDw3KCIh8bLyh@cluster0.0enfp44.mongodb.net/?appName=Cluster0' },
        { key: 'FRONTEND_URL', value: 'https://campusdesk-sis-inky.vercel.app,https://campusdesk-sis-2.vercel.app' }
      ]
    }
  };

  const res = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log(`Render response for [${name}]:`, JSON.stringify(data, null, 2));
  return data;
}

if (process.argv[2]) {
  const repo = process.argv[2];
  const name = process.argv[3] || 'campus-desk-api';
  createRenderService(repo, name).catch(console.error);
}
