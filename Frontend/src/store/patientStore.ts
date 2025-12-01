import { create } from 'zustand'
import { Patient } from '@/types/patient.types'

interface PatientState {
  patients: Patient[]
  selectedPatient: Patient | null
  isLoading: boolean
  setPatients: (patients: Patient[]) => void
  setSelectedPatient: (patient: Patient | null) => void
  setLoading: (loading: boolean) => void
  updatePatient: (patient: Patient) => void
  removePatient: (patientId: string) => void
}

export const usePatientStore = create<PatientState>((set) => ({
  patients: [],
  selectedPatient: null,
  isLoading: false,

  setPatients: (patients) => set({ patients }),
  
  setSelectedPatient: (patient) => set({ selectedPatient: patient }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  updatePatient: (updatedPatient) =>
    set((state) => ({
      patients: state.patients.map((p) =>
        p.patient_id === updatedPatient.patient_id ? updatedPatient : p
      ),
      selectedPatient:
        state.selectedPatient?.patient_id === updatedPatient.patient_id
          ? updatedPatient
          : state.selectedPatient,
    })),
  
  removePatient: (patientId) =>
    set((state) => ({
      patients: state.patients.filter((p) => p.patient_id !== patientId),
      selectedPatient:
        state.selectedPatient?.patient_id === patientId ? null : state.selectedPatient,
    })),
}))
