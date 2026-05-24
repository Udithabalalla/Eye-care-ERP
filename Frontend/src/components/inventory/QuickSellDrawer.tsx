import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RiReceiptLine, RiUserLine, RiGridLine, RiBox3Line,
  RiAddLine, RiDeleteBinLine, RiSearchLine, RiCheckLine,
} from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import { patientsApi } from '@/api/patients.api'
import { productsApi } from '@/api/products.api'
import { salesOrdersApi } from '@/api/erp.api'
import { FrameVariant } from '@/types/frames.types'
import { VariantPicker } from '@/components/frames/VariantPicker'
import { formatCurrency } from '@/utils/formatters'
import { Product } from '@/types/product.types'
import { Patient } from '@/types/patient.types'

interface VariantLineItem {
  variant: FrameVariant
  qty: number
  unit_price: number
}

interface GeneralLineItem {
  product: Product
  qty: number
  unit_price: number
}

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
  onSuccess?: () => void
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

export function QuickSellDrawer({ open, onClose, variant, onSuccess }: Props) {
  const qc = useQueryClient()

  // Patient
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  // Frame variants section
  const [variantItems, setVariantItems] = useState<VariantLineItem[]>([])
  const [pendingVariant, setPendingVariant] = useState<FrameVariant | null>(null)
  const [pendingVariantQty, setPendingVariantQty] = useState('1')

  // General inventory section
  const [productSearch, setProductSearch] = useState('')
  const [generalItems, setGeneralItems] = useState<GeneralLineItem[]>([])

  const today = new Date().toISOString().split('T')[0]

  // Patients search
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-quick-search', patientSearch],
    queryFn: () => patientsApi.getAll({ page: 1, page_size: 10, search: patientSearch }),
    enabled: open && patientSearch.length >= 2,
    staleTime: 10_000,
  })

  // Products search
  const { data: productsData } = useQuery({
    queryKey: ['products-quick-sell', productSearch],
    queryFn: () => productsApi.getAll({ page: 1, page_size: 20, search: productSearch }),
    enabled: open && productSearch.length >= 2,
    staleTime: 10_000,
  })

  // Reset state when drawer opens/closes
  const handleOpen = (open: boolean) => {
    if (open && variant) {
      setVariantItems([{ variant, qty: 1, unit_price: variant.selling_price }])
    }
    if (!open) {
      handleClose()
    }
  }

  const handleClose = () => {
    setPatientSearch('')
    setSelectedPatient(null)
    setVariantItems([])
    setPendingVariant(null)
    setPendingVariantQty('1')
    setProductSearch('')
    setGeneralItems([])
    onClose()
  }

  const addVariant = () => {
    if (!pendingVariant) return
    const qty = parseInt(pendingVariantQty, 10) || 1
    setVariantItems((prev) => {
      const existing = prev.find((i) => i.variant.variant_id === pendingVariant.variant_id)
      if (existing) {
        return prev.map((i) => i.variant.variant_id === pendingVariant.variant_id ? { ...i, qty: i.qty + qty } : i)
      }
      return [...prev, { variant: pendingVariant, qty, unit_price: pendingVariant.selling_price }]
    })
    setPendingVariant(null)
    setPendingVariantQty('1')
  }

  const removeVariant = (variantId: string) => setVariantItems((prev) => prev.filter((i) => i.variant.variant_id !== variantId))
  const updateVariantQty = (variantId: string, qty: number) => setVariantItems((prev) => prev.map((i) => i.variant.variant_id === variantId ? { ...i, qty } : i))
  const updateVariantPrice = (variantId: string, price: number) => setVariantItems((prev) => prev.map((i) => i.variant.variant_id === variantId ? { ...i, unit_price: price } : i))

  const addProduct = (p: Product) => {
    setGeneralItems((prev) => {
      const existing = prev.find((i) => i.product.product_id === p.product_id)
      if (existing) return prev.map((i) => i.product.product_id === p.product_id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { product: p, qty: 1, unit_price: p.selling_price }]
    })
    setProductSearch('')
  }

  const removeProduct = (productId: string) => setGeneralItems((prev) => prev.filter((i) => i.product.product_id !== productId))
  const updateProductQty = (productId: string, qty: number) => setGeneralItems((prev) => prev.map((i) => i.product.product_id === productId ? { ...i, qty } : i))
  const updateProductPrice = (productId: string, price: number) => setGeneralItems((prev) => prev.map((i) => i.product.product_id === productId ? { ...i, unit_price: price } : i))

  const totalItems = variantItems.length + generalItems.length
  const grandTotal = [
    ...variantItems.map((i) => i.qty * i.unit_price),
    ...generalItems.map((i) => i.qty * i.unit_price),
  ].reduce((s, v) => s + v, 0)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error('Select a patient')
      if (totalItems === 0) throw new Error('Add at least one item')

      const items = [
        ...variantItems.map((i) => ({
          product_id: i.variant.variant_id,
          product_name: `${i.variant.frame_master_ref?.brand ?? ''} ${i.variant.frame_master_ref?.model_code ?? ''} – ${i.variant.color}`.trim(),
          sku: i.variant.sku,
          quantity: i.qty,
          unit_price: i.unit_price,
          total: i.qty * i.unit_price,
          master_data_id: i.variant.frame_master_id,
          line_type: 'product' as const,
          track_stock: true,
        })),
        ...generalItems.map((i) => ({
          product_id: i.product.product_id,
          product_name: i.product.name,
          sku: i.product.sku,
          quantity: i.qty,
          unit_price: i.unit_price,
          total: i.qty * i.unit_price,
          master_data_id: i.product.product_id,
          line_type: 'product' as const,
          track_stock: true,
        })),
      ]

      return salesOrdersApi.create({
        patient_id: selectedPatient.patient_id,
        items,
        expected_delivery_date: `${today}T00:00:00Z`,
        date_of_full_payment: `${today}T00:00:00Z`,
        status: 'draft',
      })
    },
    onSuccess: (so) => {
      toast.success(`Draft SO ${so.order_number} created`)
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      onSuccess?.()
      handleClose()
    },
    onError: (e: any) => toast.error(e?.message || e?.response?.data?.detail || 'Failed to create sales order'),
  })

  if (!variant) return null

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-5 flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <RiReceiptLine className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-base">New Sales Order</SheetTitle>
              <p className="text-xs text-muted-foreground">Quick sale from inventory. Creates a draft SO.</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">

            {/* ── Patient ─────────────────────────────────────────────────── */}
            <Section icon={RiUserLine} title="Customer / Patient">
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">{selectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPatient.phone}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedPatient(null)}>Change</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name or phone…"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {patientsLoading && <p className="text-xs text-muted-foreground px-1">Searching…</p>}
                  {(patientsData?.data ?? []).length > 0 && !selectedPatient && (
                    <div className="rounded-lg border divide-y overflow-hidden">
                      {(patientsData?.data ?? []).map((p) => (
                        <button
                          key={p.patient_id}
                          type="button"
                          className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => { setSelectedPatient(p); setPatientSearch('') }}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {p.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* ── Section 1: Frame Variants ─────────────────────────────────── */}
            <Section icon={RiGridLine} title="Frame Variants">
              {variantItems.map((item) => (
                <div key={item.variant.variant_id} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {item.variant.frame_master_ref?.brand} {item.variant.frame_master_ref?.model_code} – {item.variant.color}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Badge variant="outline" className="font-mono text-xs mr-1">{item.variant.sku}</Badge>
                        eye {item.variant.eye_size}mm{item.variant.temple_length ? ` · arm ${item.variant.temple_length}mm` : ''}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive shrink-0" onClick={() => removeVariant(item.variant.variant_id)}>
                      <RiDeleteBinLine className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Qty</label>
                      <Input type="number" min={1} value={item.qty} onChange={(e) => updateVariantQty(item.variant.variant_id, parseInt(e.target.value, 10) || 1)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Unit Price</label>
                      <Input type="number" step="0.01" min={0} value={item.unit_price} onChange={(e) => updateVariantPrice(item.variant.variant_id, parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <Row label="Subtotal">{formatCurrency(item.qty * item.unit_price)}</Row>
                </div>
              ))}

              {/* Add variant */}
              <div className="space-y-2 pt-1">
                <label className="text-xs text-muted-foreground">Add frame variant</label>
                <VariantPicker value={pendingVariant} onChange={setPendingVariant} showStock showPrice={false} placeholder="Search variant…" />
                {pendingVariant && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={pendingVariantQty}
                      onChange={(e) => setPendingVariantQty(e.target.value)}
                      placeholder="Qty"
                      className="h-8 w-20"
                    />
                    <Button size="sm" className="h-8 gap-1" onClick={addVariant}>
                      <RiAddLine className="size-3.5" />Add
                    </Button>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Section 2: General Inventory ──────────────────────────────── */}
            <Section icon={RiBox3Line} title="General Inventory">
              {generalItems.map((item) => (
                <div key={item.product.product_id} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{item.product.sku}</span> · {item.product.category}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive shrink-0" onClick={() => removeProduct(item.product.product_id)}>
                      <RiDeleteBinLine className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Qty</label>
                      <Input type="number" min={1} value={item.qty} onChange={(e) => updateProductQty(item.product.product_id, parseInt(e.target.value, 10) || 1)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Unit Price</label>
                      <Input type="number" step="0.01" min={0} value={item.unit_price} onChange={(e) => updateProductPrice(item.product.product_id, parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <Row label="Subtotal">{formatCurrency(item.qty * item.unit_price)}</Row>
                </div>
              ))}

              {/* Product search */}
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search products…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(productsData?.data ?? []).length > 0 && productSearch.length >= 2 && (
                  <div className="rounded-lg border divide-y overflow-hidden max-h-48 overflow-y-auto">
                    {(productsData?.data ?? []).map((p) => (
                      <button
                        key={p.product_id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => addProduct(p)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku} · {p.category}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums ml-4 shrink-0">{formatCurrency(p.selling_price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* ── Order Summary ─────────────────────────────────────────────── */}
            {totalItems > 0 && (
              <Section icon={RiReceiptLine} title="Summary">
                <Row label="Total Items">{totalItems}</Row>
                <Row label="Grand Total">
                  <span className="text-base font-bold">{formatCurrency(grandTotal)}</span>
                </Row>
              </Section>
            )}

          </div>
        </div>

        <div className="border-t px-6 py-4 flex-shrink-0 flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !selectedPatient || totalItems === 0}
          >
            <RiCheckLine className="size-4" />
            {mutation.isPending ? 'Creating…' : 'Create Sales Order'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
