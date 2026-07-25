// Minimal Cloudflare runtime globals for local TypeScript and CI validation.
// The deployed Worker receives the real binding implementations from Cloudflare.
type D1Database = any;
type R2Bucket = any;
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
