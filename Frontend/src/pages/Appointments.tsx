import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appointmentsApi } from '@/api/appointments.api'
import { RiAddLine, RiCalendarLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import AppointmentCard from '@/components/appointments/AppointmentCard'
import Loading from '@/components/common/Loading'
import { Appointment } from '@/types/appointment.types'

const Appointments = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', statusFilter],
    queryFn: () => appointmentsApi.getAll({ page: 1, page_size: 50, status: statusFilter }),
  })

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedAppointment(null)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedAppointment(null)
  }

  const groupedAppointments = data?.data.reduce((acc, apt) => {
    const date = apt.appointment_date.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(apt)
    return acc
  }, {} as Record<string, Appointment[]>)

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">Appointments</CardTitle>
                <Badge variant="secondary">{data?.data.length || 0}</Badge>
              </div>
              <CardDescription className="mt-1">Manage and schedule appointments</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} size="sm" className="w-full sm:w-auto">
                <RiAddLine className="size-4" />
                New Appointment
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? (
            <Loading />
          ) : (
            <div className="space-y-6">
              {groupedAppointments &&
                Object.entries(groupedAppointments).map(([date, appointments]) => (
                  <div key={date}>
                    <h2 className="mb-3 flex items-center text-lg font-semibold text-foreground">
                      <RiCalendarLine className="mr-2 h-5 w-5" />
                      {new Date(date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {appointments.map((apt) => (
                        <AppointmentCard
                          key={apt.appointment_id}
                          appointment={apt}
                          onClick={() => handleEdit(apt)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

              {(!groupedAppointments || Object.keys(groupedAppointments).length === 0) && (
                <div className="py-12 text-center">
                  <RiCalendarLine className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="mb-4 text-muted-foreground">No appointments found</p>
                  <Button onClick={handleAdd}>
                    <RiAddLine className="size-4" />
                    Schedule First Appointment
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        appointment={selectedAppointment}
        onSuccess={() => refetch()}
      />
    </div>
  )
}

export default Appointments
