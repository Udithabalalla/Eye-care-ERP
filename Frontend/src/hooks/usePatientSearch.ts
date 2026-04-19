import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '@/api/patients.api'
import { useDebounce } from '@/hooks/useDebounce'

export const usePatientSearch = (searchTerm: string) => {
  const debouncedSearchTerm = useDebounce(searchTerm.trim(), 350)

  return useQuery({
    queryKey: ['patients', 'search', debouncedSearchTerm],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 25, search: debouncedSearchTerm }),
    enabled: debouncedSearchTerm.length > 0,
  })
}
