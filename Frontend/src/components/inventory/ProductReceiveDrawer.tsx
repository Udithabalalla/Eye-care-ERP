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
import { Product } from '@/types/product.types'
import { ReceiveFields, Row, Section } from './drawerForm'
import { intakePayload, receiveDefaults, receiveSchema, type ReceiveValues } from './drawerFormSchema'

interface Props {
  open: boolean
  onClose: () => void
  product: Product | null
  onSuccess?: () => void
}

export function ProductReceiveDrawer({ open, onClose, product, onSuccess }: Props) {
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
      if (!product) throw new Error('No product')
      const { qty, cost_price, ...header } = intakePayload(values, product.cost_price ?? 0)
      const created = await quickIntakesApi.create({
        ...header,
        items: [{ product_id: product.product_id, sku: product.sku ?? '', qty, cost_price }],
      })
      await quickIntakesApi.commit(created.intake_id)
      return qty
    },
    onSuccess: (qty) => {
      toast.success(`${qty} units received — stock updated`)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['quick-intakes'] })
      form.reset(receiveDefaults())
      onSuccess?.()
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Receive failed'),
  })

  const handleClose = () => { form.reset(receiveDefaults()); onClose() }

  if (!product) return null

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
                <Section icon={RiBox3Line} title="Product">
                  <Row label="Name">{product.name}</Row>
                  <Row label="SKU">
                    <Badge variant="outline" className="font-mono text-xs">{product.sku}</Badge>
                  </Row>
                  {product.brand && <Row label="Brand">{product.brand}</Row>}
                  <Row label="Current Stock">
                    <span className="tabular-nums">{product.current_stock} units</span>
                  </Row>
                </Section>

                <ReceiveFields
                  form={form}
                  defaultCost={product.cost_price ?? 0}
                  currentStock={product.current_stock ?? 0}
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
