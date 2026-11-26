import { axiosInstance } from './axios'
import { ApiResponse } from '@/types/common.types'

/** Someone listed under "Tested by" on a sales order (kept by the admin in Settings) */
export interface Tester {
  id: string
  name: string
  title?: string | null
  /** false once removed: off the picker, but past orders still show the name */
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TesterFormData {
  name: string
  title?: string | null
}

const withId = (tester: Tester & { _id?: string }): Tester => ({ ...tester, id: tester.id || tester._id || '' })

export const testersApi = {
  getAll: async (params?: { is_active?: boolean }) => {
    const response = await axiosInstance.get<ApiResponse<Tester[]>>('/testers', { params })
    return response.data.data.map(withId)
  },
  create: async (data: TesterFormData) => {
    const response = await axiosInstance.post<ApiResponse<Tester>>('/testers', data)
    return withId(response.data.data)
  },
  update: async (id: string, data: TesterFormData) => {
    const response = await axiosInstance.put<ApiResponse<Tester>>(`/testers/${id}`, data)
    return withId(response.data.data)
  },
  setActive: async (id: string, is_active: boolean) => {
    const response = await axiosInstance.patch<ApiResponse<Tester>>(`/testers/${id}/status`, { is_active })
    return withId(response.data.data)
  },
}
