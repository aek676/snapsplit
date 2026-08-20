export function parseCorsOrigin(
  raw: string | undefined,
  nodeEnv: string | undefined = Bun.env.NODE_ENV,
): string[] | true {
  const origins =
    raw
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  if (origins.length === 0 && nodeEnv === 'production')
    throw new Error('CORS_ORIGIN must be set in production');
  // No configured origins means non-production: keep the permissive default.
  return origins.length > 0 ? origins : true;
}
