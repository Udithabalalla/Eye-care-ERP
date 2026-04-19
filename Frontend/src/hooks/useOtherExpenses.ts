import { useQuery } from '@tanstack/react-query'
import { basicDataApi } from '@/api/basic-data.api'
import { MasterDataQueryParams } from '@/types/basic-data.types'

export const useOtherExpenses = (params: MasterDataQueryParams = {}) => {
  return useQuery({
    queryKey: ['basic-data', 'other-expenses', params],
    queryFn: () => basicDataApi.getOtherExpenses(params),
  })
}
