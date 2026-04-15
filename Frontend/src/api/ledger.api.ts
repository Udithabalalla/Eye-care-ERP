import { axiosInstance } from './axios'

export const ledgerApi = {
  getSummary: async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const res = await axiosInstance.get(`/ledger/summary?${params}`)
    return res.data.data
  },

  getTransactions: async (transactionType?: string, startDate?: string, endDate?: string, page = 1, pageSize = 100) => {
    const params = new URLSearchParams()
    if (transactionType) params.append('transaction_type', transactionType)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    params.append('skip', String((page - 1) * pageSize))
    params.append('limit', String(pageSize))
    const res = await axiosInstance.get(`/ledger/transactions?${params}`)
    return res.data
  },

  getBalance: async (accountType?: string) => {
    const params = new URLSearchParams()
    if (accountType) params.append('account_type', accountType)
    const res = await axiosInstance.get(`/ledger/balance?${params}`)
    return res.data.data
  },

  getDailySummary: async (days = 7) => {
    const params = new URLSearchParams()
    params.append('days', String(days))
    const res = await axiosInstance.get(`/ledger/daily-summary?${params}`)
    return res.data.data
  },
}
