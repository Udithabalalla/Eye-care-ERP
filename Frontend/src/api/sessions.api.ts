import { axiosInstance } from './axios'

/** A signed-in device: a refresh token that hasn't expired or been signed out */
export interface Session {
  session_id: string
  user_id: string
  user_name?: string
  user_email?: string
  user_role?: string
  user_is_active: boolean
  signed_in_at: string
  last_seen_at?: string
  expires_at: string
  ip_address?: string
  user_agent?: string
  /** The session this browser is using */
  is_current: boolean
}

export const sessionsApi = {
  list: async (userId?: string): Promise<Session[]> => {
    const res = await axiosInstance.get('/sessions', { params: userId ? { user_id: userId } : undefined })
    return res.data.data ?? []
  },

  revoke: async (sessionId: string) => {
    const res = await axiosInstance.delete(`/sessions/${sessionId}`)
    return res.data
  },
}
