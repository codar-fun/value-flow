import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { allowedAppOrigin, codeChallenge } = await import(new URL("../app/lib/juluo-oauth.ts", import.meta.url).href);

test("PKCE S256 matches the RFC 7636 vector", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await codeChallenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("only the flow site and local dev may start 聚落 login", () => {
  assert.equal(allowedAppOrigin("https://flow.sola.day"), true);
  assert.equal(allowedAppOrigin("http://localhost:3000"), true);
  assert.equal(allowedAppOrigin("http://127.0.0.1:3000"), true);
  assert.equal(allowedAppOrigin("http://flow.sola.day"), false);
  assert.equal(allowedAppOrigin("https://flow.sola.day.evil.example"), false);
  assert.equal(allowedAppOrigin("https://evil.example"), false);
});
