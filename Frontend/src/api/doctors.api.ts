import { axiosInstance } from './axios'
import { Doctor, DoctorFormData } from '@/types/doctor.types'


export const doctorsApi = {
    getAll: async (params: {
        skip?: number
        limit?: number
        active_only?: boolean
    }): Promise<Doctor[]> => {
        const response = await axiosInstance.get<Doctor[]>('/doctors', { params })
        return response.data
    },

    getById: async (id: string): Promise<Doctor> => {
        const response = await axiosInstance.get<Doctor>(`/doctors/${id}`)
        return response.data
    },

    create: async (data: DoctorFormData): Promise<Doctor> => {
        const response = await axiosInstance.post<Doctor>('/doctors', data)
        return response.data
    },

    update: async (id: string, data: Partial<DoctorFormData>): Promise<Doctor> => {
        const response = await axiosInstance.put<Doctor>(`/doctors/${id}`, data)
        return response.data
    },

    delete: async (id: string): Promise<void> => {
        await axiosInstance.delete(`/doctors/${id}`)
    },
}
