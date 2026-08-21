/**
 * The signing secret, resolved in exactly one place.
 *
 * It used to be inlined with a fallback at each of the three sites that needed
 * it, which meant a deployment that forgot to set JWT_SECRET would quietly sign
 * with a value written in this repository — and anyone who could read the
 * repository could mint themselves a SUPER_ADMIN token. Silent is the failure
 * mode that matters here, so outside development an unset secret stops the app
 * from starting rather than letting it serve forged sessions.
 */
let warned = false;

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  if (isProduction) {
    throw new Error(
      secret
        ? 'JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48'
        : 'JWT_SECRET is not set. Generate one with: openssl rand -base64 48',
    );
  }

  if (secret) return secret;
  if (!warned) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn('[auth] JWT_SECRET is not set — using the development fallback. Never deploy this.');
  }
  return 'recruitment-secret-key';
}

export function jwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '7d';
}
