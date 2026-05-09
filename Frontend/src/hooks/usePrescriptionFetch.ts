import { useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'

export const usePrescriptionFetch = (patientId?: string) => {
  return useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: () => prescriptionsApi.getAll({ patient_id: patientId, page: 1, page_size: 100 }),
    enabled: !!patientId,
  })
}
