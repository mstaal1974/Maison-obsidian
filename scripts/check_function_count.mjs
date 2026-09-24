// Vercel's Hobby plan deploys at most 12 serverless functions; a 13th fails
// the deployment. Every .ts/.js file under api/ is a function, except the
// underscore-prefixed helpers (api/_lib). Fail the build here instead, with
// the list, so a new route gets folded into an existing one.
import { readdirSync } from "node:fs";
import { join } from "node:path";

const LIMIT = 12;
const found = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|js|mjs|cjs)$/.test(e.name) && !e.name.endsWith(".d.ts")) found.push(p);
  }
})("api");

if (found.length > LIMIT) {
  console.error(`api/ has ${found.length} serverless functions; the Vercel Hobby plan allows ${LIMIT}:\n  ${found.join("\n  ")}\nMerge a route into an existing function (see api/marketing.ts and api/_lib/waitlist.ts).`);
  process.exit(1);
}
console.log(`api/: ${found.length} of ${LIMIT} serverless functions`);
