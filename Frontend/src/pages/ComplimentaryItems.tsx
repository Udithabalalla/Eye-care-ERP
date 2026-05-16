import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { basicDataApi } from '@/api/basic-data.api'
import { productsApi } from '@/api/products.api'
import { CasePriceRule, CasePriceRuleFormData } from '@/types/basic-data.types'
import {
  RiAddLine,
  RiEditLine,
  RiDeleteBin6Line,
  RiSearchLine,
  RiGiftLine,
  RiCloseLine,
  RiCheckLine,
  RiMoreLine,
  RiArrowRightSLine,
} from '@remixicon/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import SearchableLOV from '@/components/common/SearchableLOV'
import { formatCurrency } from '@/utils/formatters'
import toast from 'react-hot-toast'

// ── Zod schema ────────────────────────────────────────────────────────────────

const ruleSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  min_price: z.number().min(0, 'Must be ≥ 0'),
  max_price: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().min(0).nullable().optional()
  ),
  product_id: z.string().min(1, 'Select a product'),
  product_name: z.string().min(1),
  priority: z.number().min(0).default(0),
  is_active: z.boolean().default(true),
})

type RuleFormValues = z.infer<typeof ruleSchema>

// ── Rule Dialog ───────────────────────────────────────────────────────────────

interface RuleDialogProps {
  open: boolean
  onClose: () => void
  rule?: CasePriceRule | null
}

const RuleDialog = ({ open, onClose, rule }: RuleDialogProps) => {
  const queryClient = useQueryClient()

  const { data: productsData } = useQuery({
    queryKey: ['products-for-rules'],
    queryFn: async () => {
      const first = await productsApi.getAll({ page: 1, page_size: 100 })
      if (first.total_pages <= 1) return first
      const all = [...first.data]
      for (let p = 2; p <= first.total_pages; p++) {
        const next = await productsApi.getAll({ page: p, page_size: 100 })
        all.push(...next.data)
      }
      return { ...first, data: all }
    },
    staleTime: 60_000,
  })

  const productOptions = (productsData?.data ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({
      value: p.product_id,
      label: p.name,
      subtitle: `${p.sku} · ${p.category} · ${formatCurrency(p.selling_price)}`,
    }))

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: rule
      ? {
          name: rule.name,
          min_price: rule.min_price,
          max_price: rule.max_price ?? null,
          product_id: rule.product_id,
          product_name: rule.product_name,
          priority: rule.priority,
          is_active: rule.is_active,
        }
      : { name: '', min_price: 0, max_price: null, product_id: '', product_name: '', priority: 0, is_active: true },
  })

  const createMutation = useMutation({
    mutationFn: (data: CasePriceRuleFormData) => basicDataApi.createCasePriceRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-price-rules'] })
      toast.success('Price rule created')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to create rule'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CasePriceRuleFormData>) => basicDataApi.updateCasePriceRule(rule!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-price-rules'] })
      toast.success('Price rule updated')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to update rule'),
  })

  const onSubmit = (values: RuleFormValues) => {
    const payload: CasePriceRuleFormData = { ...values, max_price: values.max_price ?? null }
    if (rule) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleProductChange = (productId: string) => {
    form.setValue('product_id', productId)
    const product = productsData?.data.find((p) => p.product_id === productId)
    if (product) form.setValue('product_name', product.name)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Price Rule' : 'Add Complimentary Price Rule'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Rule Name *</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Frame Case for Premium Frames" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="min_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Frame Price *</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="max_price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Frame Price <span className="text-muted-foreground text-xs">(blank = no limit)</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="No limit"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="product_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Complimentary Product *</FormLabel>
                <FormControl>
                  <SearchableLOV
                    placeholder="Search and select a product…"
                    value={field.value ?? ''}
                    onChange={handleProductChange}
                    options={productOptions}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Product must exist in your inventory. It is given free when frame price is in this range.
                </p>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="priority" render={({ field }) => (
              <FormItem>
                <FormLabel>Priority <span className="text-muted-foreground text-xs">(lower number = higher priority)</span></FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="cursor-pointer font-normal">Active</FormLabel>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending || productOptions.length === 0}>
                {productOptions.length === 0
                  ? 'No products in inventory'
                  : isPending ? 'Saving…' : rule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ComplimentaryItems = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState<CasePriceRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CasePriceRule | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['case-price-rules', search],
    queryFn: () => basicDataApi.getCasePriceRules({ page: 1, page_size: 100, search: search || undefined }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      basicDataApi.setCasePriceRuleStatus(id, is_active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case-price-rules'] }),
    onError: () => toast.error('Failed to update status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => basicDataApi.deleteCasePriceRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-price-rules'] })
      toast.success('Rule deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete rule'),
  })

  const openAdd = () => { setSelected(null); setDialogOpen(true) }
  const openEdit = (rule: CasePriceRule) => { setSelected(rule); setDialogOpen(true) }

  const rules = data?.data ?? []

  const priceRange = (rule: CasePriceRule) =>
    rule.max_price != null
      ? `${formatCurrency(rule.min_price)} – ${formatCurrency(rule.max_price)}`
      : `${formatCurrency(rule.min_price)}+`

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Complimentary Price Rules</h1>
          <p className="text-sm text-muted-foreground">
            Map frame price ranges to inventory products — offered free in sales orders.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <RiAddLine className="size-4" />
          Add Rule
        </Button>
      </section>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <RiGiftLine className="size-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Setup guide</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="rounded bg-background border border-border px-2 py-0.5">1. Create product category (e.g. "Frame Case")</span>
                <RiArrowRightSLine className="size-3" />
                <span className="rounded bg-background border border-border px-2 py-0.5">2. Add product in that category via Products</span>
                <RiArrowRightSLine className="size-3" />
                <span className="rounded bg-background border border-border px-2 py-0.5">3. Add rule here linking price range → product</span>
                <RiArrowRightSLine className="size-3" />
                <span className="rounded bg-background border border-border px-2 py-0.5">4. Product auto-suggested in Sales Orders</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Price Rules</CardTitle>
              <CardDescription>{data?.total ?? 0} rules configured</CardDescription>
            </div>
            <Badge variant="secondary">{rules.filter((r) => r.is_active).length} active</Badge>
          </div>
          <div className="relative w-full max-w-xs">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search rules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <RiGiftLine className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No price rules yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Rules tell the system which product to include free with an order.</p>
              <Button size="sm" className="mt-4" onClick={openAdd}>
                <RiAddLine className="size-4" />
                Add First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Frame Price Range</TableHead>
                  <TableHead>Complimentary Product</TableHead>
                  <TableHead className="text-center">Priority</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className="group">
                    <TableCell className="font-medium text-foreground">{rule.name}</TableCell>
                    <TableCell className="text-sm tabular-nums">{priceRange(rule)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{rule.product_name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{rule.product_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">{rule.priority}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-xs">
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0">
                            <RiMoreLine className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(rule)}>
                            <RiEditLine className="size-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: rule.id, is_active: !rule.is_active })}>
                            {rule.is_active
                              ? <><RiCloseLine className="size-4 mr-2" />Deactivate</>
                              : <><RiCheckLine className="size-4 mr-2" />Activate</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(rule)}
                          >
                            <RiDeleteBin6Line className="size-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RuleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} rule={selected} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete price rule?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ComplimentaryItems
