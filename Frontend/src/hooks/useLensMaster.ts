import { useQuery } from '@tanstack/react-query'
import { basicDataApi } from '@/api/basic-data.api'
import { MasterDataQueryParams } from '@/types/basic-data.types'

export const useLensMaster = (params: MasterDataQueryParams = {}) => {
  return useQuery({
    queryKey: ['basic-data', 'lenses', params],
    queryFn: () => basicDataApi.getLenses(params),
  })
}
