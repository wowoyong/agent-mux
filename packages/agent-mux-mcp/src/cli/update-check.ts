import https from 'node:https';

export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const latest = await getLatestVersion('agent-mux-mcp');
    if (latest && latest !== currentVersion && isNewer(latest, currentVersion)) {
      console.log(`  Update available: ${currentVersion} → ${latest}`);
      console.log(`  Run: npm update -g agent-mux-mcp\n`);
    }
  } catch {} // silent fail
}

function getLatestVersion(pkg: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.get(`https://registry.npmjs.org/${pkg}/latest`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).version); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}
