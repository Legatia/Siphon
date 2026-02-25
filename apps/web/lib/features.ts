function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export function isLendingEnabled(): boolean {
  const serverOverride = process.env.ENABLE_LENDING;
  const publicFlag = process.env.NEXT_PUBLIC_ENABLE_LENDING;
  return parseBooleanEnv(serverOverride ?? publicFlag, false);
}

export const LENDING_ENABLED = isLendingEnabled();
