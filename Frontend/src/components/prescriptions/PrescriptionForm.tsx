import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Prescription, PrescriptionFormData, Medication } from '@/types/prescription.types'
import { toast } from 'react-hot-toast'
import { Plus, Trash02 } from '@untitledui/icons'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { patientsApi } from '@/api/patients.api'
import { doctorsApi } from '@/api/doctors.api'
import { safeDate } from '@/utils/formatters'

interface PrescriptionFormProps {
    prescription?: Prescription | null
    onSuccess: () => void
    onCancel: () => void
    readOnly?: boolean
    onSwitchToEdit?: (prescription: Prescription) => void
}

const PrescriptionForm = ({ prescription, onSuccess, onCancel, readOnly = false, onSwitchToEdit }: PrescriptionFormProps) => {
    const { data: patients } = useQuery({
        queryKey: ['patients-list'],
        queryFn: () => patientsApi.getAll({ page: 1, page_size: 100 }),
    })

    const { data: doctors } = useQuery({
        queryKey: ['doctors-list'],
        queryFn: () => doctorsApi.getAll({ active_only: true }),
    })

    console.log('Doctors LOV data:', doctors)

    console.log('PrescriptionForm mounting with:', prescription)

    const [formData, setFormData] = useState<PrescriptionFormData>(() => {
        try {
            return {
                patient_id: prescription?.patient_id || '',
                doctor_id: prescription?.doctor_id || '',
                prescription_date: safeDate(prescription?.prescription_date),
                valid_until: safeDate(prescription?.valid_until, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
                diagnosis: prescription?.diagnosis || '',
                notes: prescription?.notes || '',
                eye_prescription: prescription?.eye_prescription || undefined,
                medications: prescription?.medications || [],
                contact_lenses: prescription?.contact_lenses || undefined,
            }
        } catch (error) {
            console.error('Error initializing PrescriptionForm state:', error)
            return {
                patient_id: '',
                doctor_id: '',
                prescription_date: new Date().toISOString().split('T')[0],
                valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                diagnosis: '',
                notes: '',
                eye_prescription: undefined,
                medications: [],
                contact_lenses: undefined,
            }
        }
    })

    const [showEyePrescription, setShowEyePrescription] = useState(!!prescription?.eye_prescription)
    const [existingPrescription, setExistingPrescription] = useState<Prescription | null>(null)

    // Check for existing prescription when patient changes (only in create mode)
    useEffect(() => {
        const checkExistingPrescription = async () => {
            if (!prescription && formData.patient_id) {
                try {
                    const response = await prescriptionsApi.getAll({
                        patient_id: formData.patient_id,
                        page_size: 1,
                    })
                    if (response.data.length > 0) {
                        setExistingPrescription(response.data[0])
                    } else {
                        setExistingPrescription(null)
                    }
                } catch (error) {
                    console.error('Failed to check existing prescriptions:', error)
                }
            }
        }

        const timer = setTimeout(checkExistingPrescription, 500)
        return () => clearTimeout(timer)
    }, [formData.patient_id, prescription])

    const createMutation = useMutation({
        mutationFn: prescriptionsApi.create,
        onSuccess: () => {
            toast.success('Prescription created successfully')
            onSuccess()
        },
        onError: () => {
            toast.error('Failed to create prescription')
        },
    })

    const updateMutation = useMutation({
        mutationFn: (data: Partial<PrescriptionFormData>) =>
            prescriptionsApi.update(prescription!.prescription_id, data),
        onSuccess: () => {
            toast.success('Prescription updated successfully')
            onSuccess()
        },
        onError: () => {
            toast.error('Failed to update prescription')
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const submitData = {
            ...formData,
            eye_prescription: showEyePrescription ? formData.eye_prescription : undefined,
        }

        if (prescription) {
            updateMutation.mutate(submitData)
        } else {
            createMutation.mutate(submitData)
        }
    }

    const addMedication = () => {
        setFormData({
            ...formData,
            medications: [
                ...(formData.medications || []),
                {
                    medication_name: '',
                    dosage: '',
                    frequency: '',
                    duration: '',
                    instructions: '',
                    quantity: 1,
                },
            ],
        })
    }

    const removeMedication = (index: number) => {
        setFormData({
            ...formData,
            medications: formData.medications?.filter((_: any, i: number) => i !== index) || [],
        })
    }

    const updateMedication = (index: number, field: keyof Medication, value: any) => {
        const updatedMedications = [...(formData.medications || [])]
        updatedMedications[index] = { ...updatedMedications[index], [field]: value }
        setFormData({ ...formData, medications: updatedMedications })
    }

    const initializeEyePrescription = () => {
        setFormData({
            ...formData,
            eye_prescription: {
                right_eye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pupillary_distance: 0 },
                left_eye: { sphere: 0, cylinder: 0, axis: 0, add: 0, pupillary_distance: 0 },
                prescription_type: 'single-vision',
            },
        })
        setShowEyePrescription(true)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {existingPrescription && !prescription && (
                <div className="mb-4 border-l-4 border-brand-500 bg-brand-50 p-4 dark:bg-bg-secondary">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-medium text-brand-700">Existing Prescription Found</p>
                            <p className="text-sm text-brand-600">
                                This patient already has a prescription from {new Date(existingPrescription.prescription_date).toLocaleDateString()}.
                            </p>
                        </div>
                        <div className="space-x-3">
                            <button
                                type="button"
                                onClick={() => onSwitchToEdit?.(existingPrescription)}
                                className="px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 transition-colors"
                            >
                                Edit Existing
                            </button>
                            <button
                                type="button"
                                onClick={() => setExistingPrescription(null)}
                                className="rounded-apple border border-brand-200 bg-bg-primary px-3 py-1.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
                            >
                                Create New
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <fieldset disabled={readOnly} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                    <SearchableLOV
                        label="Patient"
                        required
                        value={formData.patient_id}
                        onChange={(value: string) => setFormData({ ...formData, patient_id: value })}
                        options={
                            patients?.data?.map((patient: any): LOVOption => ({
                                value: patient.patient_id,
                                label: patient.name,
                                subtitle: patient.patient_id,
                            })) || []
                        }
                        placeholder="Select patient"
                        disabled={readOnly}
                    />
                    <SearchableLOV
                        label="Doctor"
                        required
                        value={formData.doctor_id}
                        onChange={(value: string) => setFormData({ ...formData, doctor_id: value })}
                        options={
                            doctors?.map((doctor: any): LOVOption => ({
                                value: doctor.doctor_id,
                                label: doctor.name,
                                subtitle: doctor.specialization,
                            })) || []
                        }
                        placeholder="Select doctor"
                        disabled={readOnly}
                    />
                    <div>
                        <label className="label">Prescription Date *</label>
                        <input
                            type="date"
                            value={formData.prescription_date}
                            onChange={(e) => setFormData({ ...formData, prescription_date: e.target.value })}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Valid Until *</label>
                        <input
                            type="date"
                            value={formData.valid_until}
                            onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                            className="input"
                            required
                        />
                    </div>
                </div>

                {/* Diagnosis */}
                <div>
                    <label className="label">Diagnosis *</label>
                    <textarea
                        value={formData.diagnosis}
                        onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                        className="input"
                        rows={2}
                        required
                        placeholder="Enter diagnosis..."
                    />
                </div>

                {/* Eye Prescription Section */}
                <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Eye Prescription</h3>
                        {!showEyePrescription && !readOnly && (
                            <button
                                type="button"
                                onClick={initializeEyePrescription}
                                className="btn-secondary text-sm"
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add Eye Prescription
                            </button>
                        )}
                    </div>

                    {showEyePrescription && formData.eye_prescription && (
                        <div className="space-y-4 rounded-apple-lg bg-bg-secondary p-4">
                            <div>
                                <label className="label">Prescription Type</label>
                                <select
                                    value={formData.eye_prescription.prescription_type}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            eye_prescription: {
                                                ...formData.eye_prescription!,
                                                prescription_type: e.target.value as any,
                                            },
                                        })
                                    }
                                    className="input"
                                >
                                    <option value="single-vision">Single Vision</option>
                                    <option value="bifocal">Bifocal</option>
                                    <option value="progressive">Progressive</option>
                                </select>
                            </div>

                            {/* Right Eye */}
                            <div>
                                <h4 className="mb-2 font-medium text-primary">Right Eye (OD)</h4>
                                <div className="grid grid-cols-5 gap-2">
                                    <div>
                                        <label className="label text-xs">Sphere</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            value={formData.eye_prescription.right_eye.sphere}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        right_eye: {
                                                            ...formData.eye_prescription!.right_eye,
                                                            sphere: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Cylinder</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            value={formData.eye_prescription.right_eye.cylinder}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        right_eye: {
                                                            ...formData.eye_prescription!.right_eye,
                                                            cylinder: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Axis</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="180"
                                            value={formData.eye_prescription.right_eye.axis}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        right_eye: {
                                                            ...formData.eye_prescription!.right_eye,
                                                            axis: parseInt(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Add</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            value={formData.eye_prescription.right_eye.add}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        right_eye: {
                                                            ...formData.eye_prescription!.right_eye,
                                                            add: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">PD</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={formData.eye_prescription.right_eye.pupillary_distance}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        right_eye: {
                                                            ...formData.eye_prescription!.right_eye,
                                                            pupillary_distance: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Left Eye */}
                            <div>
                                <h4 className="mb-2 font-medium text-primary">Left Eye (OS)</h4>
                                <div className="grid grid-cols-5 gap-2">
                                    <div>
                                        <label className="label text-xs">Sphere</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            value={formData.eye_prescription.left_eye.sphere}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        left_eye: {
                                                            ...formData.eye_prescription!.left_eye,
                                                            sphere: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Cylinder</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            value={formData.eye_prescription.left_eye.cylinder}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        left_eye: {
                                                            ...formData.eye_prescription!.left_eye,
                                                            cylinder: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Axis</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="180"
                                            value={formData.eye_prescription.left_eye.axis}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        left_eye: {
                                                            ...formData.eye_prescription!.left_eye,
                                                            axis: parseInt(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Add</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            value={formData.eye_prescription.left_eye.add}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        left_eye: {
                                                            ...formData.eye_prescription!.left_eye,
                                                            add: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">PD</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={formData.eye_prescription.left_eye.pupillary_distance}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    eye_prescription: {
                                                        ...formData.eye_prescription!,
                                                        left_eye: {
                                                            ...formData.eye_prescription!.left_eye,
                                                            pupillary_distance: parseFloat(e.target.value),
                                                        },
                                                    },
                                                })
                                            }
                                            className="input text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Medications Section */}
                <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-primary">Medications</h3>
                        {!readOnly && (
                            <button type="button" onClick={addMedication} className="btn-secondary text-sm">
                                <Plus className="w-4 h-4 mr-1" /> Add Medication
                            </button>
                        )}
                    </div>

                    {formData.medications && formData.medications.length > 0 && (
                        <div className="space-y-3">
                            {formData.medications.map((med: Medication, index: number) => (
                                <div key={index} className="relative rounded-apple-lg bg-bg-secondary p-4">
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => removeMedication(index)}
                                            className="absolute right-2 top-2 text-error-600 hover:text-error-700"
                                        >
                                            <Trash02 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="label text-xs">Medication Name</label>
                                            <input
                                                type="text"
                                                value={med.medication_name}
                                                onChange={(e) => updateMedication(index, 'medication_name', e.target.value)}
                                                className="input text-sm"
                                                placeholder="e.g., Eye Drops"
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs">Dosage</label>
                                            <input
                                                type="text"
                                                value={med.dosage}
                                                onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                                                className="input text-sm"
                                                placeholder="e.g., 1 drop"
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs">Frequency</label>
                                            <input
                                                type="text"
                                                value={med.frequency}
                                                onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                                                className="input text-sm"
                                                placeholder="e.g., 3 times daily"
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs">Duration</label>
                                            <input
                                                type="text"
                                                value={med.duration}
                                                onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                                                className="input text-sm"
                                                placeholder="e.g., 7 days"
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs">Quantity</label>
                                            <input
                                                type="number"
                                                value={med.quantity}
                                                onChange={(e) => updateMedication(index, 'quantity', parseInt(e.target.value))}
                                                className="input text-sm"
                                                min="1"
                                            />
                                        </div>
                                        <div>
                                            <label className="label text-xs">Instructions</label>
                                            <input
                                                type="text"
                                                value={med.instructions}
                                                onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                                                className="input text-sm"
                                                placeholder="Special instructions"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="label">Additional Notes</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="input"
                        rows={3}
                        placeholder="Any additional notes or instructions..."
                    />
                </div>
            </fieldset>

            {/* Actions */}
            {!readOnly && (
                <div className="flex justify-end space-x-3 border-t border-border pt-4">
                    <button type="button" onClick={onCancel} className="btn-secondary">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={createMutation.isPending || updateMutation.isPending}
                    >
                        {createMutation.isPending || updateMutation.isPending
                            ? 'Saving...'
                            : prescription
                                ? 'Update Prescription'
                                : 'Create Prescription'}
                    </button>
                </div>
            )}
            {readOnly && (
                <div className="flex justify-end space-x-3 border-t border-border pt-4">
                    <button type="button" onClick={onCancel} className="btn-secondary">
                        Close
                    </button>
                </div>
            )}
        </form>
    )
}

export default PrescriptionForm
