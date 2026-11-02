/// <reference types="vite/client" />
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axiosRetry, { isNetworkOrIdempotentRequestError, exponentialDelay } from 'axios-retry'
import toast from 'react-hot-toast'

const HOSTED_API_BASE_URL = 'https://eye-care-api-g01u.onrender.com/api/v1'
const AUTH_RECOVERY_KEY = 'auth-network-recovery-attempted'
const AUTH_ENDPOINTS = ['/auth/login', '/auth/me', '/auth/register']

const resolveApiBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const isLocalHost = host === 'localhost' || host === '127.0.0.1'

    if (configuredBaseUrl) {
      const configuredIsLocalHost = configuredBaseUrl.includes('localhost') || configuredBaseUrl.includes('127.0.0.1')
      if (!isLocalHost && configuredIsLocalHost) {
        return HOSTED_API_BASE_URL
      }
      return configuredBaseUrl
    }

    if (!isLocalHost) return HOSTED_API_BASE_URL
  }

  if (configuredBaseUrl) return configuredBaseUrl

  return 'http://localhost:8000/api/v1'
}

const API_BASE_URL = resolveApiBaseUrl()

export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED'
export const PASSWORD_CHANGE_REQUIRED_EVENT = 'auth:password-change-required'

// One refresh at a time: requests that fail together wait for the same new token
let refreshInFlight: Promise<string> | null = null

const refreshAccessToken = (refreshToken: string): Promise<string> => {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then((resp) => {
        const newAccess: string | undefined = resp.data?.access_token
        if (!newAccess) throw new Error('No access token in refresh response')
        localStorage.setItem('token', newAccess)
        return newAccess
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

// Clear all auth data (including zustand persist storage) and go to sign-in
const endLocalSession = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('auth-storage')
  localStorage.removeItem('refresh_token')

  // Only redirect if not already on login page to prevent loops
  if (!window.location.pathname.includes('/login')) {
    toast.error('Your session has ended. Please sign in again.')
    window.location.href = '/login'
  }
}

// Request deduplication map
const pendingRequests = new Map<string, AbortController>()

export const extractApiErrorMessage = (detail: unknown, fallback = 'An error occurred'): string => {
  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry && typeof entry === 'object') {
          const error = entry as { msg?: unknown; message?: unknown }
          if (typeof error.msg === 'string') return error.msg
          if (typeof error.message === 'string') return error.message
        }
        return ''
      })
      .filter(Boolean)
      .join(', ')
  }

  if (detail && typeof detail === 'object') {
    const error = detail as { detail?: unknown; msg?: unknown; message?: unknown }
    if (typeof error.detail === 'string') return error.detail
    if (typeof error.msg === 'string') return error.msg
    if (typeof error.message === 'string') return error.message
  }

  return fallback
}

// Generate unique request key
const getRequestKey = (config: InternalAxiosRequestConfig): string => {
  return `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`
}

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // Render's free plan sleeps when idle and takes up to ~60 s to wake;
  // axios-retry does not retry timeouts, so the first request must wait it out.
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Retry transient network/server errors with exponential backoff (skip on 4xx client errors)
axiosRetry(axiosInstance, {
  retries: 2,
  retryDelay: exponentialDelay,
  retryCondition: (error: AxiosError) => {
    // Do not retry on client errors (4xx)
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return false
    }
    return isNetworkOrIdempotentRequestError(error)
  },
})

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Give mutation requests more time — Render cold starts can take 30–60 s
    const method = config.method?.toLowerCase()
    if (method === 'post' || method === 'put' || method === 'patch') {
      config.timeout = 90000
    }

    // Deduplicate GET requests - cancel previous pending request with same key
    if (config.method?.toLowerCase() === 'get') {
      const requestKey = getRequestKey(config)
      
      // Cancel existing request if any
      if (pendingRequests.has(requestKey)) {
        pendingRequests.get(requestKey)?.abort()
      }
      
      // Create new abort controller
      const controller = new AbortController()
      config.signal = controller.signal
      pendingRequests.set(requestKey, controller)
    }
    
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Remove from pending requests
    const requestKey = getRequestKey(response.config)
    pendingRequests.delete(requestKey)
    return response
  },
  (error: AxiosError) => {
    // Remove from pending requests
    if (error.config) {
      const requestKey = getRequestKey(error.config)
      pendingRequests.delete(requestKey)
    }
    
    // Ignore cancelled requests
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }
    
    if (error.response) {
      const status = error.response.status
      const data: any = error.response.data

      // Attempt token refresh on 401 before failing
      const originalRequest: any = error.config
      const isSignIn = typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/login')
      if (status === 401 && originalRequest && !originalRequest._retry && !isSignIn) {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          originalRequest._retry = true
          return refreshAccessToken(refreshToken).then(
            (newAccess) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newAccess}`
              }
              return axiosInstance(originalRequest)
            },
            // The session was signed out (by an admin, a password change or expiry)
            () => {
              endLocalSession()
              return Promise.reject(error)
            },
          )
        }
      }

      // The user still has to replace a password an admin set; the app shows that screen
      if (status === 403 && data?.detail === PASSWORD_CHANGE_REQUIRED) {
        window.dispatchEvent(new Event(PASSWORD_CHANGE_REQUIRED_EVENT))
        return Promise.reject(error)
      }

      switch (status) {
        case 401:
          endLocalSession()
          break
        case 403:
          toast.error('You do not have permission to perform this action.')
          break
        case 404: {
          const errorMessage = data.detail || data.message || 'Resource not found.'
          toast.error(errorMessage)
          break
        }
        case 422: {
            toast.error(extractApiErrorMessage(data.detail, 'Validation error'))
          break
        }
        case 400:
          toast.error(data.detail || data.message || 'Request failed.')
          break
        case 500:
          toast.error('Server error. Please try again later.')
          break
        default:
          toast.error(data.detail || data.message || 'An error occurred')
      }
    } else if (error.request) {
      const requestUrl: string = error.config?.url || ''
      const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => requestUrl.includes(ep))
      const hasToken = Boolean(localStorage.getItem('token'))
      const alreadyRecovered = localStorage.getItem(AUTH_RECOVERY_KEY) === '1'

      // Only auto-recover on auth endpoints — never on feature endpoints like invoice creation.
      // Non-auth network failures (server down, cold start, timeout) must not log the user out.
      if (isAuthEndpoint && hasToken && !alreadyRecovered && !window.location.pathname.includes('/login')) {
        localStorage.setItem(AUTH_RECOVERY_KEY, '1')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('auth-storage')
        toast.error('Session error. Please login again.')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (!isAuthEndpoint) {
        localStorage.removeItem(AUTH_RECOVERY_KEY)
      }
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout')
      toast.error(
        isTimeout
          ? 'Request timed out — the server may be starting up. Please try again.'
          : 'No response from server. Please check your connection and try again.',
      )
    } else {
      toast.error('An error occurred. Please try again.')
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
