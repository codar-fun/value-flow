// Static check of what the Docker build context would carry (F2).
//
// Docker is not available in this environment, so this does not prove what is
// inside a built image. It proves which paths the .dockerignore rules exclude
// from the context, using the same glob semantics the rules are written for.
// The image-level check stays unverified until someone runs `docker build`.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ESCAPE = /[.+?^${}()|[\]\\]/g;

function segmentMatches(pattern, segment) {
  const source = pattern.split("*").map((part) => part.replace(ESCAPE, "\\$&")).join("[^/]*");
  return new RegExp(`^${source}$`).test(segment);
}

// `**/` means "at any depth"; everything else is matched against the full
// root-relative path.
function patternMatches(pattern, path) {
  const tail = pattern.startsWith("**/") ? pattern.slice(3) : pattern;
  const candidates = pattern.startsWith("**/")
    ? path.split("/").map((_, index, all) => all.slice(index).join("/"))
    : [path];

  return candidates.some((candidate) => {
    const parts = tail.split("/");
    const segments = candidate.split("/");
    if (parts.length !== segments.length) return false;
    return parts.every((part, index) => segmentMatches(part, segments[index]));
  });
}

function isExcluded(patterns, path) {
  const segments = path.split("/");
  // A file is out as soon as any ancestor directory is excluded.
  return segments.some((_, index) => {
    const ancestor = segments.slice(0, index + 1).join("/");
    return patterns.some((pattern) => patternMatches(pattern, ancestor));
  });
}

async function patterns() {
  const raw = await readFile(new URL("../.dockerignore", import.meta.url), "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

test("local secrets, review material and agent scratch never enter the build context", async () => {
  const rules = await patterns();

  const mustBeExcluded = [
    ".dev.vars",
    ".dev.vars.local",
    ".env",
    ".env.local",
    ".env.example",
    // Real mailbox credentials and OTP-era scratch from the last review.
    ".review-tmp/mails.json",
    ".review-tmp/users.json",
    ".review-tmp/evidence.json",
    ".review-tmp/s_home_390.png",
    ".workbuddy/memory/2026-09-30.md",
    ".codex/session.json",
    ".git/config",
    "docs/visual-references/avatar-single-silhouette-reference.png",
    "tsconfig.tsbuildinfo",
    "run.log",
    "notes.下载",
    "keys/id_rsa.pem",
  ];

  for (const path of mustBeExcluded) {
    assert.equal(isExcluded(rules, path), true, `${path} must be excluded from the build context`);
  }
});

test("everything the image actually builds from stays included", async () => {
  const rules = await patterns();

  const mustBeIncluded = [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "next.config.ts",
    "vite.config.ts",
    "tsconfig.json",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "Dockerfile",
    ".dockerignore",
    "app/layout.tsx",
    "app/page.tsx",
    "app/globals.css",
    "app/lib/loop.ts",
    "app/api/bootstrap/route.ts",
    "app/api/auth/verify/route.ts",
    "app/join/[token]/join-invitation.tsx",
    "app/components/face-avatar.tsx",
    "db/runtime.ts",
    "worker/index.ts",
    "build/sites-vite-plugin.ts",
    // Runtime assets: the share image and the favicon must ship.
    "public/og.png",
    "public/favicon.svg",
    "public/globe.svg",
  ];

  for (const path of mustBeIncluded) {
    assert.equal(isExcluded(rules, path), false, `${path} must stay in the build context`);
  }
});

test("the Dockerfile does not copy anything outside the ignored context", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

  // A whole-directory copy is fine only because .dockerignore does the
  // filtering; make sure no step reaches outside the context or pulls a
  // secret in through a build arg.
  assert.match(dockerfile, /COPY \. \./);
  assert.doesNotMatch(dockerfile, /COPY .*\.dev\.vars/);
  assert.doesNotMatch(dockerfile, /ARG\s+(LOOP_|OTP|SECRET|TOKEN)/i);
  // Production must not enable the local test-auth bypass.
  assert.doesNotMatch(dockerfile, /LOCAL_TEST_AUTH/);
  assert.match(dockerfile, /NODE_ENV=production/);
});
