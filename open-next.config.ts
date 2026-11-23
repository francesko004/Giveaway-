import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// All pages are rendered per request (live countdown, registrations, CSP nonces), so no incremental
// cache storage is needed — which also means no R2 bucket (and no payment method) is required.
export default defineCloudflareConfig({});
