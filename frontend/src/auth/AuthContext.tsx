/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigurationError } from './supabase'
import { isDuplicateUserError } from './validation'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  created_at: string
  updated_at: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  configurationError: string | null
  profileError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<boolean>
  signInWithGoogle: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function parseProfile(value: unknown): UserProfile | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  if (
    !('id' in value) ||
    !('full_name' in value) ||
    !('email' in value) ||
    !('created_at' in value) ||
    !('updated_at' in value) ||
    typeof value.id !== 'string' ||
    typeof value.full_name !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.created_at !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    full_name: value.full_name,
    email: value.email,
    created_at: value.created_at,
    updated_at: value.updated_at,
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      supabaseConfigurationError ?? 'Supabase authentication is unavailable.',
    )
  }
  return supabase
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const user = session?.user ?? null

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        if (!nextSession) {
          setProfile(null)
          setProfileError(null)
        }
        setLoading(false)
      }
    })

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return
        }
        if (error) {
          setProfileError('Your saved session could not be verified. Sign in again.')
          setSession(null)
        } else {
          setSession(data.session)
        }
        setLoading(false)
      })
      .catch(() => {
        if (active) {
          setProfileError('Your saved session could not be verified. Sign in again.')
          setSession(null)
          setLoading(false)
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (!supabase || !userId) {
      return
    }

    let active = true
    const client = supabase
    const loadProfile = async () => {
      setProfileLoading(true)
      setProfileError(null)
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, email, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle()

      if (!active) {
        return
      }

      if (error) {
        setProfileError('Your profile could not be loaded.')
      } else {
        const parsedProfile = parseProfile(data)
        if (data !== null && !parsedProfile) {
          setProfileError('Your profile response was invalid.')
        } else {
          setProfile(parsedProfile)
        }
      }
      setProfileLoading(false)
    }

    void loadProfile().catch(() => {
      if (active) {
        setProfileError('Your profile could not be loaded.')
        setProfileLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [userId])

  const signIn = useCallback(async (email: string, password: string) => {
    const client = requireSupabase()
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
      throw error
    }
  }, [])

  const signUp = useCallback(
    async (fullName: string, email: string, password: string) => {
      const client = requireSupabase()
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) {
          if (isDuplicateUserError(error)) {
            return false
          }
          throw error
        }
        return data.session !== null
      } catch (err) {
        if (isDuplicateUserError(err)) {
          return false
        }
        throw err
      }
    },
    [],
  )

  const signInWithGoogle = useCallback(async () => {
    const client = requireSupabase()
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      throw error
    }
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const client = requireSupabase()
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      throw error
    }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const client = requireSupabase()
    const { error } = await client.auth.updateUser({ password })
    if (error) {
      throw error
    }
  }, [])

  const updateProfile = useCallback(
    async (fullName: string) => {
      const client = requireSupabase()
      if (!user) {
        throw new Error('You must be signed in to update your profile.')
      }

      const trimmedName = fullName.trim()
      const previousName = profile?.full_name

      const { data, error: profileError } = await client
        .from('profiles')
        .update({ full_name: trimmedName })
        .eq('id', user.id)
        .select('id, full_name, email, created_at, updated_at')
        .single()

      if (profileError) {
        throw profileError
      }
      const parsedProfile = parseProfile(data)
      if (!parsedProfile) {
        throw new Error('Your profile response was invalid.')
      }

      const { data: authData, error: authError } = await client.auth.updateUser({
        data: { full_name: trimmedName },
      })

      if (authError) {
        if (previousName && previousName !== trimmedName) {
          try {
            await client
              .from('profiles')
              .update({ full_name: previousName })
              .eq('id', user.id)
          } catch {
            // Rollback failure ignored to ensure root authError is thrown
          }
        }
        throw authError
      }

      setProfile(parsedProfile)
      if (authData?.user) {
        setSession((current) =>
          current ? { ...current, user: authData.user } : current,
        )
      }
    },
    [user, profile],
  )

  const signOut = useCallback(async () => {
    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) {
      throw error
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile: profile?.id === user?.id ? profile : null,
      loading,
      profileLoading,
      configurationError: supabaseConfigurationError,
      profileError,
      signIn,
      signUp,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      signOut,
    }),
    [
      session,
      user,
      profile,
      loading,
      profileLoading,
      profileError,
      signIn,
      signUp,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }
  return context
}
