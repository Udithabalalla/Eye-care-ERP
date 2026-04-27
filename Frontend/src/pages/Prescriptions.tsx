import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { RiAddLine, RiSearchLine, RiFileTextLine, RiCalendarLine, RiEyeLine, RiMore2Line } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Loading from '@/components/common/Loading'
import Pagination from '@/components/common/Pagination'
import PrescriptionModal from '@/components/prescriptions/PrescriptionModal'
import { Prescription } from '@/types/prescription.types'
import { formatDate } from '@/utils/formatters'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

const Prescriptions = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['prescriptions', page, pageSize, patientFilter, doctorFilter],
    queryFn: () =>
      prescriptionsApi.getAll({
        page,
        page_size: pageSize,
        patient_id: patientFilter || undefined,
        doctor_id: doctorFilter || undefined,
      }),
  })

  const handleEdit = (prescription: Prescription) => {
    setSelectedPrescription(prescription)
    setIsModalOpen(true)
  }

  useEffect(() => {
    const detailId = searchParams.get('detail')
    if (!detailId) return

    let isActive = true

    const openDetail = async () => {
      try {
        const prescription = await prescriptionsApi.getById(detailId)
        if (!isActive) return
        setSelectedPrescription(prescription)
        setIsModalOpen(true)
      } catch (error) {
        if (!isActive) return
        toast.error('Failed to load prescription details')
        setSearchParams({}, { replace: true })
      }
    }

    openDetail()
    return () => { isActive = false }
  }, [searchParams, setSearchParams])

  const handleAdd = () => {
    setSelectedPrescription(null)
    setIsModalOpen(true)
  }

  const handleDownloadPDF = async (prescriptionId: string) => {
    try {
      const blob = await prescriptionsApi.downloadPDF(prescriptionId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prescription-${prescriptionId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  const filteredData = data?.data.filter((prescription) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      prescription.prescription_id.toLowerCase().includes(searchLower) ||
      prescription.patient_name.toLowerCase().includes(searchLower) ||
      prescription.doctor_name.toLowerCase().includes(searchLower) ||
      prescription.diagnosis.toLowerCase().includes(searchLower)
    )
  })

  const summaryStats = useMemo(() => {
    const rows = data?.data || []
    return {
      total: data?.total || 0,
      eyePrescriptions: rows.filter((p) => p.eye_prescription).length,
      withMedications: rows.filter((p) => p.medications && p.medications.length > 0).length,
      expired: rows.filter((p) => new Date(p.valid_until) < new Date()).length,
    }
  }, [data])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Total Prescriptions</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.total}</p>
            </div>
            <RiFileTextLine className="size-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Eye Prescriptions</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.eyePrescriptions}</p>
            </div>
            <RiEyeLine className="size-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">With Medications</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.withMedications}</p>
            </div>
            <RiFileTextLine className="size-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-foreground">{summaryStats.expired}</p>
            </div>
            <RiCalendarLine className="size-8 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Prescriptions</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Manage patient prescriptions</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-48">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search prescriptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              placeholder="Filter by Patient ID"
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              className="w-full sm:w-36"
            />
            <Input
              placeholder="Filter by Doctor ID"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="w-full sm:w-36"
            />
            <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-28">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} size="sm">
              <RiAddLine className="size-4 mr-1" />
              New Prescription
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12"><Loading /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prescription ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredData || []).map((prescription) => (
                    <TableRow key={prescription.prescription_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{prescription.prescription_id}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(prescription.prescription_date)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{prescription.patient_name}</p>
                          <p className="text-sm text-muted-foreground">{prescription.patient_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground">{prescription.doctor_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground">{prescription.diagnosis}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {prescription.eye_prescription && (
                            <Badge variant="secondary">
                              {prescription.eye_prescription.prescription_type}
                            </Badge>
                          )}
                          {prescription.medications && prescription.medications.length > 0 && (
                            <Badge variant="secondary">
                              {prescription.medications.length} Med{prescription.medications.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {prescription.contact_lenses && (
                            <Badge variant="secondary">
                              Contact Lenses
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const validDate = new Date(prescription.valid_until)
                          const isExpired = validDate < new Date()
                          return (
                            <span className={isExpired ? 'text-destructive font-medium' : 'text-foreground'}>
                              {formatDate(prescription.valid_until)}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="data-[state=open]:bg-muted"
                              aria-label="Open prescription actions"
                            >
                              <RiMore2Line className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => handleEdit(prescription)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPDF(prescription.prescription_id)}>
                              Download PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(filteredData || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No prescriptions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {data && (
                <Pagination
                  currentPage={page}
                  totalPages={data.total_pages}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
                  totalItems={data.total}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PrescriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedPrescription(null)
          setSearchParams({}, { replace: true })
        }}
        prescription={selectedPrescription}
        onSuccess={() => refetch()}
        onSwitchToEdit={handleEdit}
      />
    </div>
  )
}

export default Prescriptions
