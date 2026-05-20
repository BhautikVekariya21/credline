export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type JsonInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export function buildApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const cleanBase = API_BASE.replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

export async function requestJson<T>(endpoint: string, init: JsonInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const devApiKey = import.meta.env.VITE_API_KEY || 'changeme-generate-a-secure-key';
  const res = await fetch(buildApiUrl(endpoint), {
    ...rest,
    headers: {
      Accept: 'application/json',
      'X-API-Key': devApiKey,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errorBody = await res.json();
      detail = typeof errorBody?.detail === 'string' ? errorBody.detail : '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `${res.status} ${res.statusText}`.trim());
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(endpoint: string): Promise<T> {
  return requestJson<T>(endpoint);
}

export function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return requestJson<T>(endpoint, { method: 'POST', body });
}

export function unwrapArray<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[key])) {
    return (value as Record<string, unknown>)[key] as T[];
  }
  return [];
}
