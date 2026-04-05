import { formatCurrency } from '@/utils/formatters'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, SearchLg, Edit02, Trash02, Phone01, Mail01, Clock, CurrencyDollar } from '@untitledui/icons'
import { toast } from 'react-hot-toast'
import { doctorsApi } from '@/api/doctors.api'
import { Doctor, DoctorFormData } from '@/types/doctor.types'
import Modal from '@/components/common/Modal'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'

const Doctors = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const queryClient = useQueryClient()

    const { data: doctors, isLoading } = useQuery({
        queryKey: ['doctors'],
        queryFn: () => doctorsApi.getAll({ limit: 100 }),
    })

    const createMutation = useMutation({
        mutationFn: doctorsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] })
            queryClient.invalidateQueries({ queryKey: ['doctors-list'] })
            toast.success('Doctor added successfully')
            setIsModalOpen(false)
        },
        onError: (error: any) => {
            const msg = error?.response?.data?.detail || error?.message || 'Failed to add doctor'
            toast.error(typeof msg === 'string' ? msg : 'Failed to add doctor')
            console.error('Add doctor error:', error?.response?.data || error)
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<DoctorFormData> }) =>
            doctorsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] })
            queryClient.invalidateQueries({ queryKey: ['doctors-list'] })
            toast.success('Doctor updated successfully')
            setIsModalOpen(false)
            setSelectedDoctor(null)
        },
        onError: (error: any) => {
            const msg = error?.response?.data?.detail || error?.message || 'Failed to update doctor'
            toast.error(typeof msg === 'string' ? msg : 'Failed to update doctor')
            console.error('Update doctor error:', error?.response?.data || error)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: doctorsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] })
            queryClient.invalidateQueries({ queryKey: ['doctors-list'] })
            toast.success('Doctor deleted successfully')
        },
        onError: (error: any) => {
            const msg = error?.response?.data?.detail || error?.message || 'Failed to delete doctor'
            toast.error(typeof msg === 'string' ? msg : 'Failed to delete doctor')
            console.error('Delete doctor error:', error?.response?.data || error)
        },
    })

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        // Helper to get available days from checkboxes
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        const selectedDays = days.filter(day => formData.get(`day_${day}`) === 'on')

        // Get raw values
        const emailVal = (formData.get('email') as string)?.trim()
        const qualificationVal = (formData.get('qualification') as string)?.trim()
        const contactVal = (formData.get('contact_number') as string)?.trim()

        const data: DoctorFormData = {
            name: formData.get('name') as string,
            specialization: formData.get('specialization') as string,
            qualification: qualificationVal || undefined,
            experience_years: Number(formData.get('experience_years')) || 0,
            contact_number: contactVal || undefined,
            email: emailVal || undefined,
            consultation_fee: Number(formData.get('consultation_fee')) || 0,
            available_days: selectedDays.length > 0 ? selectedDays : ['Monday'],
            available_time_start: formData.get('available_time_start') as string,
            available_time_end: formData.get('available_time_end') as string,
            is_active: true,
        }

        if (selectedDoctor) {
            updateMutation.mutate({ id: selectedDoctor.doctor_id, data })
        } else {
            createMutation.mutate(data)
        }
    }

    const filteredDoctors = doctors?.filter((doctor) =>
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Doctors</h1>
                    <p className="text-secondary">Manage medical staff and specialists</p>
                </div>
                <Button onClick={() => { setSelectedDoctor(null); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Doctor
                </Button>
            </div>

            <div className="flex items-center space-x-4 bg-secondary p-4 rounded-xl border border-secondary">
                <SearchLg className="w-5 h-5 text-tertiary" />
                <input
                    type="text"
                    placeholder="Search doctors by name or specialization..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-primary placeholder-tertiary w-full"
                />
            </div>

            {isLoading ? (
                <div className="text-center py-8">Loading doctors...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDoctors?.map((doctor) => (
                        <div key={doctor.doctor_id} className="bg-secondary p-6 rounded-xl border border-secondary hover:border-brand-500/50 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-primary">{doctor.name}</h3>
                                    <p className="text-brand-500 text-sm">{doctor.specialization}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => { setSelectedDoctor(doctor); setIsModalOpen(true); }}
                                        className="p-2 hover:bg-tertiary rounded-lg text-secondary hover:text-brand-500 transition-colors"
                                    >
                                        <Edit02 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this doctor?')) {
                                                deleteMutation.mutate(doctor.doctor_id)
                                            }
                                        }}
                                        className="p-2 hover:bg-tertiary rounded-lg text-secondary hover:text-error-500 transition-colors"
                                    >
                                        <Trash02 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm text-secondary">
                                <div className="flex items-center">
                                    <span className="font-medium w-24">Qualification:</span>
                                    <span>{doctor.qualification}</span>
                                </div>
                                <div className="flex items-center">
                                    <Phone01 className="w-4 h-4 mr-2 text-tertiary" />
                                    <span>{doctor.contact_number}</span>
                                </div>
                                <div className="flex items-center">
                                    <Mail01 className="w-4 h-4 mr-2 text-tertiary" />
                                    <span>{doctor.email}</span>
                                </div>
                                <div className="flex items-center">
                                    <CurrencyDollar className="w-4 h-4 mr-2 text-tertiary" />
                                    <span>{formatCurrency(doctor.consultation_fee)} / visit</span>
                                </div>
                                <div className="pt-3 border-t border-secondary mt-3">
                                    <div className="flex items-center mb-2">
                                        <Clock className="w-4 h-4 mr-2 text-tertiary" />
                                        <span>{doctor.available_time_start} - {doctor.available_time_end}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {doctor.available_days.map(day => (
                                            <span key={day} className="text-xs bg-tertiary px-2 py-1 rounded-md">
                                                {day.slice(0, 3)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedDoctor(null); }}
                title={selectedDoctor ? 'Edit Doctor' : 'Add New Doctor'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Full Name"
                        name="name"
                        defaultValue={selectedDoctor?.name}
                        required
                        placeholder="Dr. John Doe"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-secondary mb-1.5">
                                Specialization
                            </label>
                            <select
                                name="specialization"
                                defaultValue={selectedDoctor?.specialization || "Ophthalmologist"}
                                className="w-full px-3 py-2 bg-primary border border-secondary rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                required
                            >
                                <option value="Ophthalmologist">Ophthalmologist</option>
                                <option value="Optometrist">Optometrist</option>
                                <option value="Optician">Optician</option>
                                <option value="Surgeon">Surgeon</option>
                                <option value="Consultant">Consultant</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <Input
                            label="Qualification"
                            name="qualification"
                            defaultValue={selectedDoctor?.qualification}
                            placeholder="MBBS, MD"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Experience (Years)"
                            name="experience_years"
                            type="number"
                            defaultValue={selectedDoctor?.experience_years}
                        />
                        <Input
                            label="Consultation Fee"
                            name="consultation_fee"
                            type="number"
                            defaultValue={selectedDoctor?.consultation_fee}
                            required
                            min="0"
                            step="0.01"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Contact Number"
                            name="contact_number"
                            defaultValue={selectedDoctor?.contact_number}
                        />
                        <Input
                            label="Email"
                            name="email"
                            type="email"
                            defaultValue={selectedDoctor?.email}
                        />
                    </div>

                    <div className="border-t border-border pt-4">
                        <h4 className="font-medium mb-3">Availability</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <Input
                                label="Start Time"
                                name="available_time_start"
                                type="time"
                                defaultValue={selectedDoctor?.available_time_start || "09:00"}
                                required
                            />
                            <Input
                                label="End Time"
                                name="available_time_end"
                                type="time"
                                defaultValue={selectedDoctor?.available_time_end || "17:00"}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary">Available Days</label>
                            <div className="flex flex-wrap gap-4">
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                    <label key={day} className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name={`day_${day}`}
                                            defaultChecked={selectedDoctor?.available_days.includes(day)}
                                            className="rounded border-border text-brand-600 focus:ring-brand-500"
                                        />
                                        <span className="text-sm">{day.slice(0, 3)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => { setIsModalOpen(false); setSelectedDoctor(null); }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
                            {selectedDoctor ? 'Update Doctor' : 'Add Doctor'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Doctors
