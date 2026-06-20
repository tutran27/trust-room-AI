import { URL } from 'url';

type EnvInput = Record<string, unknown>;

function parseInteger(value: string, name: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function parseAbsoluteUrl(value: string, name: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error();
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL.`);
  }
}

export function validateEnv(config: EnvInput): EnvInput {
  const nodeEnv = typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  const isProduction = nodeEnv === 'production';
  const jwtSecret =
    typeof config.JWT_SECRET === 'string' && config.JWT_SECRET.length >= 32
      ? config.JWT_SECRET
      : isProduction
        ? (() => {
            throw new Error('JWT_SECRET must be set and at least 32 characters in production.');
          })()
        : 'dev-only-secret-at-least-32-bytes';

  const authDomain =
    typeof config.AUTH_DOMAIN === 'string' && config.AUTH_DOMAIN.length > 0
      ? config.AUTH_DOMAIN
      : 'localhost';
  const authUri = parseAbsoluteUrl(
    typeof config.AUTH_URI === 'string' && config.AUTH_URI.length > 0
      ? config.AUTH_URI
      : 'http://localhost:3000',
    'AUTH_URI',
  );
  const corsOriginsRaw =
    typeof config.CORS_ORIGINS === 'string' && config.CORS_ORIGINS.length > 0
      ? config.CORS_ORIGINS
      : 'http://localhost:3000';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((value) => parseAbsoluteUrl(value.trim(), 'CORS_ORIGINS'))
    .join(',');
  const jsonBodyLimit =
    typeof config.JSON_BODY_LIMIT === 'string' && /^[1-9]\d*(kb|mb)$/i.test(config.JSON_BODY_LIMIT)
      ? config.JSON_BODY_LIMIT.toLowerCase()
      : '32kb';

  return {
    ...config,
    NODE_ENV: nodeEnv,
    JWT_SECRET: jwtSecret,
    JWT_TTL_SECONDS: parseInteger(
      typeof config.JWT_TTL_SECONDS === 'string' ? config.JWT_TTL_SECONDS : '900',
      'JWT_TTL_SECONDS',
      300,
      3600,
    ),
    AUTH_NONCE_TTL_SECONDS: parseInteger(
      typeof config.AUTH_NONCE_TTL_SECONDS === 'string'
        ? config.AUTH_NONCE_TTL_SECONDS
        : '300',
      'AUTH_NONCE_TTL_SECONDS',
      60,
      900,
    ),
    AUTH_DOMAIN: authDomain,
    AUTH_URI: authUri,
    CORS_ORIGINS: corsOrigins,
    JSON_BODY_LIMIT: jsonBodyLimit,
    JWT_ISSUER: typeof config.JWT_ISSUER === 'string' && config.JWT_ISSUER.length > 0
      ? config.JWT_ISSUER
      : 'trustroom-ai',
    JWT_AUDIENCE:
      typeof config.JWT_AUDIENCE === 'string' && config.JWT_AUDIENCE.length > 0
        ? config.JWT_AUDIENCE
        : 'trustroom-api',
  };
}
