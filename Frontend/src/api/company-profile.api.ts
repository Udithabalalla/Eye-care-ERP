import { axiosInstance } from './axios'
import { ApiResponse } from '@/types/common.types'
import { CompanyProfile, CompanyProfileFormData } from '@/types/company-profile.types'

export const companyProfileApi = {
  get: async (): Promise<CompanyProfile> => {
    const response = await axiosInstance.get<ApiResponse<CompanyProfile>>('/settings/company-profile')
    return response.data.data
  },

  update: async (data: CompanyProfileFormData): Promise<CompanyProfile> => {
    const response = await axiosInstance.put<ApiResponse<CompanyProfile>>('/settings/company-profile', data)
    return response.data.data
  },
}
