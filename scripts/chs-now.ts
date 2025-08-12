#!/usr/bin/env tsx
// Minimal helper to query /api/now when dev server is running
const url = process.argv[2] || "http://localhost:3000/api/now";
fetch(url).then(r=>r.json()).then(j=>{ console.log(JSON.stringify(j, null, 2)); }).catch(e=>{ console.error(String(e)); process.exit(1); });
