import { loopApiBase, runtimeEnv } from "./loop";

const TEST_USER_KEYS = ["A", "B", "C"] as const;
export type LocalTestUserKey = (typeof TEST_USER_KEYS)[number];

export type LocalTestUser = {
  key: LocalTestUserKey;
  label: string;
  accessToken: string;
  expiresIn: number;
};

function isLocalBackend(): boolean {
  try {
    const url = new URL(loopApiBase());
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function localTestAuthEnabled(): boolean {
  return runtimeEnv("LOCAL_TEST_AUTH") === "true" && runtimeEnv("NODE_ENV") !== "production" && isLocalBackend();
}

function expiresInFor(key: LocalTestUserKey): number {
  const raw = runtimeEnv(`LOCAL_TEST_USER_${key}_ACCESS_TOKEN_EXPIRES_IN`) || runtimeEnv("LOCAL_TEST_ACCESS_TOKEN_EXPIRES_IN");
  const value = Number(raw || 900);
  return Number.isInteger(value) && value > 0 ? value : 900;
}

export function localTestUsers(): LocalTestUser[] {
  if (!localTestAuthEnabled()) return [];

  return TEST_USER_KEYS.flatMap((key) => {
    const accessToken = runtimeEnv(`LOCAL_TEST_USER_${key}_ACCESS_TOKEN`);
    if (!accessToken) return [];
    return [{
      key,
      label: runtimeEnv(`LOCAL_TEST_USER_${key}_LABEL`) || `User ${key}`,
      accessToken,
      expiresIn: expiresInFor(key),
    }];
  });
}

export function localTestUser(key: string): LocalTestUser | undefined {
  const normalized = key.trim().toUpperCase() as LocalTestUserKey;
  return localTestUsers().find((user) => user.key === normalized);
}
