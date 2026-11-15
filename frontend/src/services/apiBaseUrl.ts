const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
const configuredApiBaseUrl = env?.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredApiBaseUrl ||
  (env?.DEV ? 'http://localhost:3001' : '')
).replace(/\/+$/, '');
