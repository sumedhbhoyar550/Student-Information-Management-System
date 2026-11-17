import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import 'dotenv/config';

// Load from environment or local .env.deploy if present
let token = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN;
if (!token && fs.existsSync('.env.deploy')) {
  const envContent = fs.readFileSync('.env.deploy', 'utf-8');
  const match = envContent.match(/VERCEL_API_TOKEN=(.*)/);
  if (match) token = match[1].trim();
}

if (!token) {
  console.error('Error: VERCEL_API_TOKEN is required. Set it in environment or .env.deploy.');
  process.exit(1);
}

const distDir = path.resolve('frontend/dist');
const projectName = process.argv[2] || 'campusdesk-sis';

async function main() {
  console.log(`Checking / creating Vercel project: ${projectName}...`);
  const projRes = await fetch('https://api.vercel.com/v9/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: projectName })
  });
  const projData = await projRes.json().catch(() => ({}));
  console.log('Project response:', projData.id ? `ID: ${projData.id}` : projData.message || 'Ready');

  function getFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        files = files.concat(getFiles(full));
      } else {
        files.push(full);
      }
    }
    return files;
  }

  const allFiles = getFiles(distDir);
  const fileManifest = [];

  for (const filePath of allFiles) {
    const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
    const buffer = fs.readFileSync(filePath);
    const sha = crypto.createHash('sha1').update(buffer).digest('hex');

    const uploadRes = await fetch('https://api.vercel.com/v2/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'x-vercel-digest': sha,
        'Content-Length': String(buffer.length)
      },
      body: buffer
    });

    fileManifest.push({
      file: rel,
      sha,
      size: buffer.length
    });
  }

  console.log('\nCreating production deployment on Vercel...');
  const deployPayload = {
    name: projectName,
    project: projectName,
    target: 'production',
    files: fileManifest,
    projectSettings: {
      framework: null
    },
    routes: [
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html' }
    ]
  };

  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(deployPayload)
  });

  const deployData = await deployRes.json();
  if (!deployRes.ok) {
    console.error('Deployment error:', deployData);
    process.exit(1);
  }

  console.log('\n=======================================');
  console.log('✅ VERCEL DEPLOYMENT SUCCESSFUL!');
  console.log('Deployment ID:', deployData.id);
  console.log('Deployment URL:', `https://${deployData.url}`);
  console.log('State:', deployData.readyState || deployData.status);
  console.log('Inspect URL:', deployData.inspectorUrl);
  console.log('=======================================\n');
}

main().catch(console.error);
