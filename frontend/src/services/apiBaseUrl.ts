export const API_BASE_URL = (
  import.meta.env?.PROD
    ? (import.meta.env.VITE_API_BASE_URL?.trim() || '')
    : (import.meta.env?.VITE_API_BASE_URL?.trim() || 'http://localhost:3001')
).replace(/\/+$/, '');

