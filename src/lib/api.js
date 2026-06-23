const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://mb.digitalleadpro.com/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'movan_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token || '');

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.blob();
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload?.error);
  }
  return payload;
}

export async function login(mobile, password) {
  const payload = await api('/auth/login', { method: 'POST', body: { mobile, password } });
  const token = payload.data?.accessToken || payload.data?.token;
  if (!token) throw new ApiError('The login response did not include an access token.', 500);
  setToken(token);
  return payload.data;
}

export function queryString(values) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export { BASE_URL };
