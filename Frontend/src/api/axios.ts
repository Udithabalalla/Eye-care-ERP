/// <reference types="vite/client" />
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'

const HOSTED_API_BASE_URL = 'https://eye-care-erp-production.up.railway.app/api/v1'
const AUTH_RECOVERY_KEY = 'auth-network-recovery-attempted'

const resolveApiBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configuredBaseUrl) return configuredBaseUrl

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const isLocalHost = host === 'localhost' || host === '127.0.0.1'
    if (!isLocalHost) return HOSTED_API_BASE_URL
  }

  return 'http://localhost:8000/api/v1'
}

const API_BASE_URL = resolveApiBaseUrl()

// Request deduplication map
const pendingRequests = new Map<string, AbortController>()

// Generate unique request key
const getRequestKey = (config: InternalAxiosRequestConfig): string => {
  return `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`
}

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
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

      switch (status) {
        case 401:
          // Clear all auth data including zustand persist storage
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('auth-storage')  // Clear zustand persist storage
          
          // Only redirect if not already on login page to prevent loops
          if (!window.location.pathname.includes('/login')) {
            toast.error('Session expired. Please login again.')
            window.location.href = '/login'
          }
          break
        case 403:
          toast.error('You do not have permission to perform this action.')
          break
        case 404:
          const errorMessage = data.detail || data.message || 'Resource not found.'
          toast.error(errorMessage)
          break
        case 422:
          const errors = data.detail
          if (Array.isArray(errors)) {
            errors.forEach((err: any) => {
              toast.error(err.msg || 'Validation error')
            })
          }
          break
        case 500:
          toast.error('Server error. Please try again later.')
          break
        default:
          toast.error(data.message || 'An error occurred')
      }
    } else if (error.request) {
      const hasToken = Boolean(localStorage.getItem('token'))
      const alreadyRecovered = localStorage.getItem(AUTH_RECOVERY_KEY) === '1'

      // In hosted environments, stale/invalid persisted auth state can lead to repeated failed requests.
      // Attempt one automatic recovery by clearing auth and forcing a clean login.
      if (hasToken && !alreadyRecovered && !window.location.pathname.includes('/login')) {
        localStorage.setItem(AUTH_RECOVERY_KEY, '1')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('auth-storage')
        toast.error('Connection session reset. Please login again.')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      localStorage.removeItem(AUTH_RECOVERY_KEY)
      toast.error('No response from server. Please check your connection.')
    } else {
      toast.error('An error occurred. Please try again.')
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
