#!/usr/bin/env node
const lt = require('localtunnel');
const { writeFileSync } = require('fs');

(async () => {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const tunnel = await lt({ port });
  writeFileSync('.tunnel-url', tunnel.url, 'utf8');
  console.log('[tunnel]', tunnel.url);
  tunnel.on('close', () => process.exit(0));
})();