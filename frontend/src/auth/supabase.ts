import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const nodeEnv =
  typeof globalThis !== 'undefined' && 'process' in globalThis
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    : undefined;

export const supabaseUrl = (
  import.meta.env?.VITE_SUPABASE_URL ?? nodeEnv?.VITE_SUPABASE_URL
)?.trim();

export const supabasePublishableKey = (
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? nodeEnv?.VITE_SUPABASE_PUBLISHABLE_KEY
)?.trim();

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) {
    return false
  }

  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname))
    )
  } catch {
    return false
  }
}

export const supabaseConfigurationError = !supabaseUrl
  ? 'VITE_SUPABASE_URL is not configured.'
  : !isValidSupabaseUrl(supabaseUrl)
    ? 'VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL.'
    : !supabasePublishableKey
      ? 'VITE_SUPABASE_PUBLISHABLE_KEY is not configured.'
      : null

const REMEMBER_SESSION_KEY = 'cybersaathi_auth_remember_session'

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function readRememberPreference(): boolean {
  const session = getSessionStorage()
  if (!session) {
    return true
  }
  try {
    const value = session.getItem(REMEMBER_SESSION_KEY)
    if (value === 'false') {
      return false
    }
    if (value === 'true') {
      return true
    }
    const local = getLocalStorage()
    if (local) {
      for (let i = 0; i < session.length; i++) {
        const key = session.key(i)
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          if (!local.getItem(key)) {
            return false
          }
        }
      }
    }
  } catch {
    // Storage access restricted; return default
  }
  return true
}

let rememberAuthSession = readRememberPreference()

const authStorage = {
  getItem(key: string): string | null {
    const isRemember = rememberAuthSession
    const preferred = isRemember ? getLocalStorage() : getSessionStorage()
    const fallback = isRemember ? getSessionStorage() : getLocalStorage()

    try {
      const preferredVal = preferred?.getItem(key)
      if (preferredVal !== null && preferredVal !== undefined) {
        return preferredVal
      }
    } catch {
      // Ignore storage read errors
    }

    try {
      const fallbackVal = fallback?.getItem(key)
      if (fallbackVal !== null && fallbackVal !== undefined) {
        return fallbackVal
      }
    } catch {
      // Ignore storage read errors
    }

    return null
  },
  setItem(key: string, value: string): void {
    const isRemember = rememberAuthSession
    const preferred = isRemember ? getLocalStorage() : getSessionStorage()
    const fallback = isRemember ? getSessionStorage() : getLocalStorage()

    try {
      preferred?.setItem(key, value)
    } catch {
      try {
        fallback?.setItem(key, value)
      } catch {
        // Ignore fallback write errors
      }
    }

    try {
      fallback?.removeItem(key)
    } catch {
      // Ignore cleanup error
    }
  },
  removeItem(key: string): void {
    try {
      getLocalStorage()?.removeItem(key)
    } catch {
      // Ignore storage remove errors
    }
    try {
      getSessionStorage()?.removeItem(key)
    } catch {
      // Ignore storage remove errors
    }
  },
}

export function setAuthSessionPersistence(remember: boolean) {
  rememberAuthSession = remember
  const session = getSessionStorage()
  if (session) {
    try {
      session.setItem(REMEMBER_SESSION_KEY, remember ? 'true' : 'false')
    } catch {
      // Storage access or quota error
    }
  }
}

export const supabase =
  supabaseConfigurationError === null && supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          storage: authStorage,
        },
      })
    : null

export function getAuthenticatedSupabaseClient(accessToken?: string): SupabaseClient {
  if (accessToken && supabaseUrl && supabasePublishableKey) {
    return createClient(supabaseUrl, supabasePublishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    })
  }
  if (supabase) {
    return supabase
  }
  throw new Error('Supabase is not configured.')
}

