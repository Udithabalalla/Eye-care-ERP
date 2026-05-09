import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { Prescription, PrescriptionFormData, Medication } from '@/types/prescription.types'
import { toast } from 'react-hot-toast'
import { RiAddLine, RiDeleteBinLine } from '@remixicon/react'
import SearchableLOV, { LOVOption } from '@/components/common/SearchableLOV'
import { patientsApi } from '@/api/patients.api'
import { doctorsApi } from '@/api/doctors.api'
import { safeDate } from '@/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PrescriptionFormProps {
    prescription?: Prescription | null
    onSuccess: () => void
    onCancel: () => void
    readOnly?: boolean
    onSwitchToEdit?: (prescription: Prescription) => void
}

const inputClass = 'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background'
const labelClass = 'block text-sm font-medium text-muted-foreground mb-2'

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
                <div className="bg-brand-50 dark:bg-brand-950 border-l-4 border-brand-500 p-4 mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-medium text-brand-700 dark:text-brand-300">Existing Prescription Found</p>
                            <p className="text-sm text-brand-600 dark:text-brand-400">
                                This patient already has a prescription from {new Date(existingPrescription.prescription_date).toLocaleDateString()}.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onSwitchToEdit?.(existingPrescription)}
                            >
                                Edit Existing
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setExistingPrescription(null)}
                            >
                                Create New
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <fieldset disabled={readOnly} className="space-y-6">
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
                        <label className={labelClass}>Prescription Date *</label>
                        <Input
                            type="date"
                            value={formData.prescription_date}
                            onChange={(e) => setFormData({ ...formData, prescription_date: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Valid Until *</label>
                        <Input
                            type="date"
                            value={formData.valid_until}
                            onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>Diagnosis *</label>
                    <textarea
                        value={formData.diagnosis}
                        onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                        className={inputClass}
                        rows={2}
                        required
                        placeholder="Enter diagnosis..."
                    />
                </div>

                <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Eye Prescription</h3>
                        {!showEyePrescription && !readOnly && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={initializeEyePrescription}
                            >
                                <RiAddLine className="w-4 h-4 mr-1" /> Add Eye Prescription
                            </Button>
                        )}
                    </div>

                    {showEyePrescription && formData.eye_prescription && (
                        <div className="space-y-4 bg-secondary p-4 rounded-lg">
                            <div>
                                <label className={labelClass}>Prescription Type</label>
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
                                    className={inputClass}
                                >
                                    <option value="single-vision">Single Vision</option>
                                    <option value="bifocal">Bifocal</option>
                                    <option value="progressive">Progressive</option>
                                </select>
                            </div>

                            <div>
                                <h4 className="font-medium mb-2">Right Eye (OD)</h4>
                                <div className="grid grid-cols-5 gap-2">
                                    {(['sphere', 'cylinder', 'axis', 'add'] as const).map((field) => (
                                        <div key={field}>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1 capitalize">{field}</label>
                                            <Input
                                                type="number"
                                                step={field === 'axis' ? '1' : '0.25'}
                                                min={field === 'axis' ? '0' : undefined}
                                                max={field === 'axis' ? '180' : undefined}
                                                value={formData.eye_prescription!.right_eye[field]}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        eye_prescription: {
                                                            ...formData.eye_prescription!,
                                                            right_eye: {
                                                                ...formData.eye_prescription!.right_eye,
                                                                [field]: field === 'axis' ? parseInt(e.target.value) : parseFloat(e.target.value),
                                                            },
                                                        },
                                                    })
                                                }
                                                className="text-sm"
                                            />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">PD</label>
                                        <Input
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
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-medium mb-2">Left Eye (OS)</h4>
                                <div className="grid grid-cols-5 gap-2">
                                    {(['sphere', 'cylinder', 'axis', 'add'] as const).map((field) => (
                                        <div key={field}>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1 capitalize">{field}</label>
                                            <Input
                                                type="number"
                                                step={field === 'axis' ? '1' : '0.25'}
                                                min={field === 'axis' ? '0' : undefined}
                                                max={field === 'axis' ? '180' : undefined}
                                                value={formData.eye_prescription!.left_eye[field]}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        eye_prescription: {
                                                            ...formData.eye_prescription!,
                                                            left_eye: {
                                                                ...formData.eye_prescription!.left_eye,
                                                                [field]: field === 'axis' ? parseInt(e.target.value) : parseFloat(e.target.value),
                                                            },
                                                        },
                                                    })
                                                }
                                                className="text-sm"
                                            />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="block text-xs font-medium text-muted-foreground mb-1">PD</label>
                                        <Input
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
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Medications</h3>
                        {!readOnly && (
                            <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                                <RiAddLine className="w-4 h-4 mr-1" /> Add Medication
                            </Button>
                        )}
                    </div>

                    {formData.medications && formData.medications.length > 0 && (
                        <div className="space-y-3">
                            {formData.medications.map((med: Medication, index: number) => (
                                <div key={index} className="bg-secondary p-4 rounded-lg relative">
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => removeMedication(index)}
                                            className="absolute top-2 right-2 text-error-600 hover:text-error-800"
                                        >
                                            <RiDeleteBinLine className="w-4 h-4" />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Medication Name</label>
                                            <Input
                                                type="text"
                                                value={med.medication_name}
                                                onChange={(e) => updateMedication(index, 'medication_name', e.target.value)}
                                                className="text-sm"
                                                placeholder="e.g., Eye Drops"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Dosage</label>
                                            <Input
                                                type="text"
                                                value={med.dosage}
                                                onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                                                className="text-sm"
                                                placeholder="e.g., 1 drop"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Frequency</label>
                                            <Input
                                                type="text"
                                                value={med.frequency}
                                                onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                                                className="text-sm"
                                                placeholder="e.g., 3 times daily"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Duration</label>
                                            <Input
                                                type="text"
                                                value={med.duration}
                                                onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                                                className="text-sm"
                                                placeholder="e.g., 7 days"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity</label>
                                            <Input
                                                type="number"
                                                value={med.quantity}
                                                onChange={(e) => updateMedication(index, 'quantity', parseInt(e.target.value))}
                                                className="text-sm"
                                                min="1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-muted-foreground mb-1">Instructions</label>
                                            <Input
                                                type="text"
                                                value={med.instructions}
                                                onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                                                className="text-sm"
                                                placeholder="Special instructions"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label className={labelClass}>Additional Notes</label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className={inputClass}
                        rows={3}
                        placeholder="Any additional notes or instructions..."
                    />
                </div>
            </fieldset>

            {!readOnly && (
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                    >
                        {createMutation.isPending || updateMutation.isPending
                            ? 'Saving...'
                            : prescription
                                ? 'Update Prescription'
                                : 'Create Prescription'}
                    </Button>
                </div>
            )}
            {readOnly && (
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Close
                    </Button>
                </div>
            )}
        </form>
    )
}

export default PrescriptionForm
