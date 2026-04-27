import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { prescriptionsApi } from '@/api/prescriptions.api'
import { RiAddLine, RiSearchLine, RiFileTextLine, RiCalendarLine, RiEyeLine, RiDownloadLine } from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl bg-background shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Prescriptions</p>
              <p className="text-2xl font-bold text-foreground">{data?.total || 0}</p>
            </div>
            <RiFileTextLine className="w-8 h-8 text-brand-600" />
          </div>
        </div>
        <div className="rounded-xl bg-background shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Eye Prescriptions</p>
              <p className="text-2xl font-bold text-brand-600">
                {data?.data.filter((p) => p.eye_prescription).length || 0}
              </p>
            </div>
            <RiEyeLine className="w-8 h-8 text-brand-600" />
          </div>
        </div>
        <div className="rounded-xl bg-background shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">With Medications</p>
              <p className="text-2xl font-bold text-success-600">
                {data?.data.filter((p) => p.medications && p.medications.length > 0).length || 0}
              </p>
            </div>
            <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center text-success-600 text-lg">💊</div>
          </div>
        </div>
        <div className="rounded-xl bg-background shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-error-600">
                {data?.data.filter((p) => new Date(p.valid_until) < new Date()).length || 0}
              </p>
            </div>
            <RiCalendarLine className="w-8 h-8 text-error-600" />
          </div>
        </div>
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
                    <TableHead />
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
                            <Badge variant="outline" className="border-brand-200 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                              {prescription.eye_prescription.prescription_type}
                            </Badge>
                          )}
                          {prescription.medications && prescription.medications.length > 0 && (
                            <Badge variant="outline" className="border-success-200 bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400">
                              {prescription.medications.length} Med{prescription.medications.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {prescription.contact_lenses && (
                            <Badge variant="outline" className="border-warning-200 bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400">
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
                            <span className={isExpired ? 'text-error-600 font-medium' : 'text-foreground'}>
                              {formatDate(prescription.valid_until)}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(prescription)} aria-label="View">
                                  <RiEyeLine className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View prescription</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(prescription.prescription_id)} aria-label="Download PDF">
                                  <RiDownloadLine className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download PDF</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
