// Checks every structured-output JSON schema in api/ against the subset the
// Messages API actually accepts.
//
// Why this exists: a schema keyword outside that subset is a 400 at request
// time, not a type error, so nothing local catches it. The Scent DNA route
// shipped with `minimum: 0, maximum: 100` on fifty-one integers and every one
// of its six operations failed in production — the client's fallbacks hid it,
// so the site looked fine and no model was ever reached. This runs in `npm run
// build`, which means Vercel cannot deploy a schema the API would reject.
//
// Rules: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
//   - additionalProperties must be false on every object
//   - minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf,
//     minLength, maxLength, pattern, maxItems and uniqueItems are unsupported
//   - minItems accepts only 0 or 1
// State a bound in `description` instead and clamp the value when it arrives.

import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const ROUTES = [
  ["api/scent-ai.ts", "SCHEMAS"],
  ["api/conceive.ts", "SCHEMA"],
  ["api/marketing.ts", "SCHEMA"],
];

const UNSUPPORTED = [
  "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "pattern", "maxItems", "uniqueItems",
];

function audit(node, path, found) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n, i) => audit(n, `${path}[${i}]`, found));
    return;
  }
  for (const key of UNSUPPORTED) {
    if (key in node) found.push(`${path}: unsupported "${key}": ${JSON.stringify(node[key])}`);
  }
  if ("minItems" in node && node.minItems !== 0 && node.minItems !== 1) {
    found.push(`${path}: minItems ${node.minItems} — only 0 or 1 is supported`);
  }
  if (node.type === "object" && node.additionalProperties !== false) {
    found.push(`${path}: objects must set additionalProperties: false`);
  }
  for (const prop of Object.keys(node.properties ?? {})) {
    audit(node.properties[prop], `${path}.${prop}`, found);
  }
  if (node.items) audit(node.items, `${path}[]`, found);
  for (const kw of ["anyOf", "allOf", "oneOf"]) {
    (node[kw] ?? []).forEach((n, i) => audit(n, `${path}|${kw}${i}`, found));
  }
}

// The routes are plain ES modules for Vercel and import the SDK, which we don't
// need: strip the imports, stub the two identifiers, and evaluate what's left.
async function schemasIn(file, binding) {
  const src = readFileSync(file, "utf8")
    .replace(/^import[\s\S]*?from\s+".*?";$/gm, "")
    .replace(/^export const config[\s\S]*?;$/gm, "");
  const stub = "const Anthropic = {}; const createClient = () => ({});\n";
  const { code } = await transform(stub + src + `\nexport { ${binding} };\n`, {
    loader: "ts",
    format: "esm",
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const value = mod[binding];
  // scent-ai holds one schema per operation; the others hold a single schema.
  return binding === "SCHEMAS" ? Object.entries(value) : [[file.split("/").pop(), value]];
}

let failures = 0;
for (const [file, binding] of ROUTES) {
  for (const [name, schema] of await schemasIn(file, binding)) {
    const found = [];
    audit(schema, name, found);
    if (found.length) {
      failures += found.length;
      console.error(`\n${file} — ${name}`);
      for (const line of found) console.error(`  ${line}`);
    }
  }
}

if (failures) {
  console.error(`\n${failures} schema problem(s). The Messages API would answer 400.`);
  process.exit(1);
}
console.log("Output schemas: all within the supported JSON Schema subset.");
