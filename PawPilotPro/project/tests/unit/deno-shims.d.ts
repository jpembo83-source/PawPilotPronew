// tsc-side counterpart of the vitest.config.ts resolve.alias block: unit tests
// import Supabase Edge Function modules (Deno runtime, npm:/jsr: specifiers),
// which vitest resolves via aliases at runtime but tsc cannot. These ambient
// declarations map the Deno-style specifiers onto the installed node packages
// and provide the tiny Deno.env surface the setup shim implements, so server
// modules pulled into unit tests type-check instead of collapsing to `any`.
// Server code itself is still properly checked by `npm run typecheck:server`
// (deno check).

declare module "npm:hono" {
  export * from "hono";
}

declare module "npm:zod" {
  export * from "zod";
}

declare module "npm:@supabase/supabase-js" {
  export * from "@supabase/supabase-js";
}

declare module "jsr:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

// kv_store.tsx pins a full version (jsr:@supabase/supabase-js@2.49.8).
declare module "jsr:@supabase/supabase-js@*" {
  export * from "@supabase/supabase-js";
}

declare const Deno: {
  env: { get(key: string): string | undefined };
};
