import { useQuery } from '@tanstack/react-query'
import { basicDataApi } from '@/api/basic-data.api'
import { MasterDataQueryParams } from '@/types/basic-data.types'

export const useComplimentaryItems = (params: MasterDataQueryParams & { item_type?: string } = {}) => {
  return useQuery({
    queryKey: ['basic-data', 'complimentary-items', params],
    queryFn: () => basicDataApi.getComplimentaryItems(params),
  })
}
