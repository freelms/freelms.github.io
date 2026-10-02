import { execSync } from 'node:child_process';

const host = process.env.DEPLOY_HOST;
const user = process.env.DEPLOY_USER;
const path = process.env.DEPLOY_PATH ?? '/var/www/learnhub';

if (!host || !user) {
  console.error('Set DEPLOY_HOST and DEPLOY_USER env vars (see .env.example).');
  process.exit(1);
}
execSync('npm run build', { stdio: 'inherit' });
// rsync over ssh; works from Git Bash / WSL / macOS / Linux. On Windows PowerShell, run via WSL or use scp.
execSync(`rsync -avz --delete dist/ ${user}@${host}:${path}/`, { stdio: 'inherit' });
console.log('Deployed dist/ to', `${user}@${host}:${path}`);
