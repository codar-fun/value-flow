/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    BUBBLE_ASSISTANT_API_URL?: string;
    BUBBLE_ASSISTANT_API_KEY?: string;
    BUBBLE_ASSISTANT_MODEL?: string;
    BUBBLE_ASSISTANT_SYSTEM_PROMPT?: string;
  }
}
