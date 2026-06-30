/**
 * Load .env.local into process.env (Next.js does this automatically; tsx does not).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env.local');
if (existsSync(ENV_PATH)) {
  const raw = readFileSync(ENV_PATH, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  console.log(`✅ Loaded .env.local (${Object.keys(process.env).filter(k => k.includes('FIREBASE') || k.includes('NEXT_PUBLIC')).length} keys)`);
} else {
  console.warn(`⚠️  No .env.local at ${ENV_PATH}`);
}