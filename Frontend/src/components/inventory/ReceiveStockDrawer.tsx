import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RiArrowDownCircleLine, RiBox3Line, RiCheckLine } from '@remixicon/react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Form } from '@/components/ui/form'
import { toast } from 'sonner'
import { suppliersApi } from '@/api/suppliers.api'
import { quickIntakesApi } from '@/api/frames.api'
import { FrameVariant } from '@/types/frames.types'
import { ReceiveFields, Row, Section } from './drawerForm'
import { intakePayload, receiveDefaults, receiveSchema, type ReceiveValues } from './drawerFormSchema'

interface Props {
  open: boolean
  onClose: () => void
  variant: FrameVariant | null
  onSuccess?: () => void
}

export function ReceiveStockDrawer({ open, onClose, variant, onSuccess }: Props) {
  const qc = useQueryClient()
  const form = useForm<ReceiveValues>({ resolver: zodResolver(receiveSchema), defaultValues: receiveDefaults(), mode: 'onChange' })

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.getAll({ page_size: 100 }),
    staleTime: 60_000,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async (values: ReceiveValues) => {
      if (!variant) throw new Error('No variant selected')
      const { qty, cost_price, ...header } = intakePayload(values, variant.cost_price ?? 0)
      const created = await quickIntakesApi.create({
        ...header,
        items: [{ variant_id: variant.variant_id, sku: variant.sku, qty, cost_price }],
      })
      await quickIntakesApi.commit(created.intake_id)
      return qty
    },
    onSuccess: (qty) => {
      toast.success(`${qty} units received — stock updated`)
      qc.invalidateQueries({ queryKey: ['frame-variants-for-master'] })
      qc.invalidateQueries({ queryKey: ['frame-masters'] })
      qc.invalidateQueries({ queryKey: ['quick-intakes'] })
      form.reset(receiveDefaults())
      onSuccess?.()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Receive failed'),
  })

  const handleClose = () => { form.reset(receiveDefaults()); onClose() }

  if (!variant) return null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="flex-shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-3 pr-20">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/15">
              <RiArrowDownCircleLine className="size-5 text-success" />
            </div>
            <div className="space-y-0.5">
              <SheetTitle className="text-base">Receive Stock</SheetTitle>
              <p className="text-xs text-muted-foreground">Creates a quick intake record (QI-XXXX) and updates stock immediately on confirm.</p>
            </div>
          </div>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="flex min-h-0 flex-1 flex-col">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="divide-y divide-border">
                <Section icon={RiBox3Line} title="Item">
                  <Row label="Frame">
                    {variant.frame_master_ref?.brand} {variant.frame_master_ref?.model_code}
                  </Row>
                  <Row label="Variant">{variant.color} · {variant.eye_size}mm · <span className="capitalize">{variant.rim_type}</span></Row>
                  <Row label="SKU">
                    <Badge variant="outline" className="font-mono text-xs">{variant.sku}</Badge>
                  </Row>
                  <Row label="Current Stock">
                    <span className="tabular-nums">{variant.current_stock} units</span>
                  </Row>
                </Section>

                <ReceiveFields
                  form={form}
                  defaultCost={variant.cost_price ?? 0}
                  currentStock={variant.current_stock ?? 0}
                  suppliers={suppliersData?.data ?? []}
                />
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending || !form.formState.isValid}>
                <RiCheckLine className="size-4" />
                {mutation.isPending ? 'Receiving…' : 'Confirm Receipt'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
