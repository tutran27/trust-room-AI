// Typed fetch wrapper for the TrustRoom API. Adds the JWT bearer token, prefixes
// the `/api` base path, and normalizes errors into ApiError.

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api`;

const TOKEN_KEY = 'trustroom_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean; // default true
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getToken();
    if (token) finalHeaders.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(0, 'NETWORK_ERROR', `Cannot reach the API at ${API_BASE}. Is it running?`);
  }

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    const objectPayload = payload as
      | {
          error?: { code?: string; message?: string };
          code?: string;
          message?: string | string[];
          statusCode?: number;
        }
      | null;
    const message =
      typeof objectPayload?.message === 'string'
        ? objectPayload.message
        : Array.isArray(objectPayload?.message)
          ? objectPayload.message.join(', ')
          : objectPayload?.error?.message;
    throw new ApiError(
      response.status,
      objectPayload?.code ?? objectPayload?.error?.code ?? 'REQUEST_FAILED',
      message ?? `Request failed with status ${response.status}.`,
    );
  }

  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export { API_BASE };
