import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')

  if (mode === 'production') {
    const missingVariables = [
      ...(!environment.VITE_SUPABASE_URL?.trim() ? ['VITE_SUPABASE_URL'] : []),
      ...(!environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
        ? ['VITE_SUPABASE_PUBLISHABLE_KEY']
        : []),
    ]
    if (missingVariables.length) {
      throw new Error(
        `Missing production environment variables: ${missingVariables.join(', ')}`,
      )
    }
    if (
      /^(your[-_]|replace[-_]|<.*>|changeme|example)/i.test(
        environment.VITE_SUPABASE_PUBLISHABLE_KEY!.trim(),
      )
    ) {
      throw new Error(
        'VITE_SUPABASE_PUBLISHABLE_KEY must be an actual publishable key, not an example value.',
      )
    }

    let supabaseUrl: URL
    try {
      supabaseUrl = new URL(environment.VITE_SUPABASE_URL!)
    } catch {
      throw new Error('VITE_SUPABASE_URL must be a valid HTTPS URL.')
    }
    if (
      supabaseUrl.protocol !== 'https:' ||
      supabaseUrl.hostname.startsWith('your-project-ref.') ||
      supabaseUrl.username ||
      supabaseUrl.password
    ) {
      throw new Error('VITE_SUPABASE_URL must be a valid HTTPS URL without credentials.')
    }

    const apiBaseUrl = environment.VITE_API_BASE_URL?.trim()
    if (apiBaseUrl) {
      let parsedApiUrl: URL
      try {
        parsedApiUrl = new URL(apiBaseUrl)
      } catch {
        throw new Error('VITE_API_BASE_URL must be an absolute HTTPS URL or empty for same-origin API requests.')
      }
      if (
        parsedApiUrl.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '::1'].includes(parsedApiUrl.hostname) ||
        parsedApiUrl.username ||
        parsedApiUrl.password
      ) {
        throw new Error('VITE_API_BASE_URL must be an HTTPS production API URL without credentials.')
      }
    }
  }

  return {
    plugins: [react()],
  }
})
