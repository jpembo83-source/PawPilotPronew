// Preflight for `npm run build`: fail loudly when the Supabase client
// config is missing. Without these values the app builds fine and then
// crashes on its first line at runtime (stuck on the splash screen) —
// which once shipped all the way to TestFlight before anyone noticed.
import { existsSync, readFileSync } from "node:fs";

const REQUIRED = ["VITE_SUPABASE_PROJECT_ID", "VITE_SUPABASE_ANON_KEY"];
const ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

let text = "";
for (const f of ENV_FILES) {
  if (existsSync(f)) text += readFileSync(f, "utf8") + "\n";
}

const missing = REQUIRED.filter(
  (k) => !process.env[k] && !new RegExp(`^${k}=.+`, "m").test(text),
);

if (missing.length > 0) {
  console.error(
    `\n✖ Build blocked — missing required config: ${missing.join(", ")}\n` +
      `  Provide them via portal/.env (see .env.example) or environment variables.\n` +
      `  The app crashes at startup without them.\n`,
  );
  process.exit(1);
}
