// Post-build fix for the OpenNext Cloudflare bundle.
//
// @opennextjs/aws imports `cookie` as a default import (`cookieParser.parse`), but cookie@1.1 is an ES-module
// style CJS build without a default export, so every request that carries a cookie crashed with
// "Cannot read properties of undefined (reading 'parse')". This rewrites the access to fall back to the
// module namespace. Idempotent; prints a notice (and does nothing) if a future OpenNext version fixed it.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = ".open-next";
const pattern = /\b(import_cookie\d*)\.default\.(parse|serialize)\b/g;
let patched = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (/\.(m?js)$/.test(name)) {
      const src = readFileSync(file, "utf8");
      if (!pattern.test(src)) continue;
      pattern.lastIndex = 0;
      writeFileSync(file, src.replace(pattern, (_m, mod, fn) => `(${mod}.default ?? ${mod}).${fn}`));
      patched++;
    }
  }
}

walk(root);
console.log(patched ? `patch-open-next: fixed cookie import in ${patched} file(s)` : "patch-open-next: nothing to patch");
