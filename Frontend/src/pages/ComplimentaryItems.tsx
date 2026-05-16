import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RiAddLine,
  RiBriefcaseLine,
  RiDeleteBin6Line,
  RiEditLine,
  RiGiftLine,
  RiMore2Line,
  RiPriceTag3Line,
} from '@remixicon/react'
import toast from 'react-hot-toast'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import Loading from '@/components/common/Loading'
import { basicDataApi } from '@/api/basic-data.api'
import { formatCurrency } from '@/utils/formatters'
import { ComplimentaryItem, ComplimentaryItemFormData, CasePriceRule, CasePriceRuleFormData } from '@/types/basic-data.types'

// ── Complimentary Item Form ───────────────────────────────────────────────────

const emptyItemForm: ComplimentaryItemFormData = {
  name: '',
  item_type: 'case',
  description: '',
  is_active: true,
}

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: ComplimentaryItem | null
  defaultType?: 'case' | 'bag'
  onSaved: () => void
}

const ItemFormDialog = ({ open, onOpenChange, item, defaultType = 'case', onSaved }: ItemFormDialogProps) => {
  const [form, setForm] = useState<ComplimentaryItemFormData>(
    item ? { name: item.name, item_type: item.item_type, description: item.description || '', is_active: item.is_active }
         : { ...emptyItemForm, item_type: defaultType }
  )

  const saveMutation = useMutation({
    mutationFn: () =>
      item ? basicDataApi.updateComplimentaryItem(item.id, form) : basicDataApi.createComplimentaryItem(form),
    onSuccess: () => {
      toast.success(item ? 'Item updated' : 'Item created')
      onSaved()
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save'),
  })

  const handleOpen = (v: boolean) => {
    if (v) {
      setForm(item ? { name: item.name, item_type: item.item_type, description: item.description || '', is_active: item.is_active }
                   : { ...emptyItemForm, item_type: defaultType })
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : `Add ${defaultType === 'case' ? 'Case' : 'Bag'}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="item-name"
              placeholder={defaultType === 'case' ? 'e.g. Premium Hard Case' : 'e.g. Standard Carry Bag'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v as 'case' | 'bag' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="case">Case</SelectItem>
                <SelectItem value="bag">Bag</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea
              id="item-desc"
              rows={2}
              placeholder="Optional description"
              className="resize-none"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="item-active"
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: !!v })}
            />
            <Label htmlFor="item-active">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Case Price Rule Form ──────────────────────────────────────────────────────

const emptyRuleForm: CasePriceRuleFormData = {
  name: '',
  min_price: 0,
  max_price: null,
  item_id: '',
  item_name: '',
  priority: 0,
  is_active: true,
}

interface RuleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: CasePriceRule | null
  caseItems: ComplimentaryItem[]
  onSaved: () => void
}

const RuleFormDialog = ({ open, onOpenChange, rule, caseItems, onSaved }: RuleFormDialogProps) => {
  const [form, setForm] = useState<CasePriceRuleFormData>(
    rule ? {
      name: rule.name,
      min_price: rule.min_price,
      max_price: rule.max_price ?? null,
      item_id: rule.item_id,
      item_name: rule.item_name,
      priority: rule.priority,
      is_active: rule.is_active,
    } : { ...emptyRuleForm }
  )

  const saveMutation = useMutation({
    mutationFn: () =>
      rule ? basicDataApi.updateCasePriceRule(rule.id, form) : basicDataApi.createCasePriceRule(form),
    onSuccess: () => {
      toast.success(rule ? 'Rule updated' : 'Rule created')
      onSaved()
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to save rule'),
  })

  const handleOpen = (v: boolean) => {
    if (v) {
      setForm(rule ? {
        name: rule.name,
        min_price: rule.min_price,
        max_price: rule.max_price ?? null,
        item_id: rule.item_id,
        item_name: rule.item_name,
        priority: rule.priority,
        is_active: rule.is_active,
      } : { ...emptyRuleForm })
    }
    onOpenChange(v)
  }

  const handleCaseSelect = (id: string) => {
    const item = caseItems.find((c) => c.id === id)
    setForm({ ...form, item_id: id, item_name: item?.name || '' })
  }

  const isValid = form.name.trim() && form.item_id && form.min_price >= 0

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Price Rule' : 'New Price Rule'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Rule Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Premium Case for High-value Frames"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Case to Distribute <span className="text-destructive">*</span></Label>
            <Select value={form.item_id} onValueChange={handleCaseSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select case type" />
              </SelectTrigger>
              <SelectContent>
                {caseItems.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Min Frame Price ({formatCurrency(0).replace('0.00', '').trim() || 'Rs.'})</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.min_price}
                onChange={(e) => setForm({ ...form, min_price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Frame Price <span className="text-muted-foreground text-xs">(blank = unlimited)</span></Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="No limit"
                value={form.max_price ?? ''}
                onChange={(e) => setForm({ ...form, max_price: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Priority <span className="text-muted-foreground text-xs">(lower = checked first)</span></Label>
            <Input
              type="number"
              min={0}
              step="1"
              placeholder="0"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="rule-active"
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: !!v })}
            />
            <Label htmlFor="rule-active">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!isValid || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Item Table (reused for Cases and Bags) ────────────────────────────────────

interface ItemTableProps {
  items: ComplimentaryItem[]
  isLoading: boolean
  type: 'case' | 'bag'
  onEdit: (item: ComplimentaryItem) => void
  onToggleStatus: (item: ComplimentaryItem) => void
}

const ItemTable = ({ items, isLoading, type, onEdit, onToggleStatus }: ItemTableProps) => {
  const filtered = items.filter((i) => i.item_type === type)

  if (isLoading) return <div className="p-8"><Loading /></div>

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                No {type === 'case' ? 'cases' : 'bags'} configured yet.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.description || '—'}</TableCell>
                <TableCell>
                  <Badge variant={item.is_active ? 'default' : 'secondary'}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Actions">
                        <RiMore2Line className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => onEdit(item)}>
                        <RiEditLine className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleStatus(item)}>
                        {item.is_active ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ComplimentaryItems = () => {
  const queryClient = useQueryClient()
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ComplimentaryItem | null>(null)
  const [selectedRule, setSelectedRule] = useState<CasePriceRule | null>(null)
  const [addType, setAddType] = useState<'case' | 'bag'>('case')
  const [ruleToDelete, setRuleToDelete] = useState<CasePriceRule | null>(null)

  const { data: itemsData, isLoading: isLoadingItems } = useQuery({
    queryKey: ['basic-data', 'complimentary-items'],
    queryFn: () => basicDataApi.getComplimentaryItems({ page: 1, page_size: 200 }),
  })

  const { data: rulesData, isLoading: isLoadingRules } = useQuery({
    queryKey: ['basic-data', 'case-price-rules'],
    queryFn: () => basicDataApi.getCasePriceRules({ page: 1, page_size: 200 }),
  })

  const allItems = itemsData?.data || []
  const caseItems = allItems.filter((i) => i.item_type === 'case')
  const rules = rulesData?.data || []

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      basicDataApi.setComplimentaryItemStatus(id, is_active),
    onSuccess: () => {
      toast.success('Status updated')
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'complimentary-items'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to update status'),
  })

  const toggleRuleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      basicDataApi.setCasePriceRuleStatus(id, is_active),
    onSuccess: () => {
      toast.success('Status updated')
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'case-price-rules'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to update status'),
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => basicDataApi.deleteCasePriceRule(id),
    onSuccess: () => {
      toast.success('Rule deleted')
      queryClient.invalidateQueries({ queryKey: ['basic-data', 'case-price-rules'] })
      setRuleToDelete(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to delete rule'),
  })

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ['basic-data', 'complimentary-items'] })
  const invalidateRules = () => queryClient.invalidateQueries({ queryKey: ['basic-data', 'case-price-rules'] })

  const openAddItem = (type: 'case' | 'bag') => {
    setAddType(type)
    setSelectedItem(null)
    setItemDialogOpen(true)
  }

  const openEditItem = (item: ComplimentaryItem) => {
    setSelectedItem(item)
    setItemDialogOpen(true)
  }

  const openAddRule = () => {
    setSelectedRule(null)
    setRuleDialogOpen(true)
  }

  const openEditRule = (rule: CasePriceRule) => {
    setSelectedRule(rule)
    setRuleDialogOpen(true)
  }

  const formatPriceRange = (rule: CasePriceRule) => {
    if (rule.max_price == null) return `${formatCurrency(rule.min_price)}+`
    return `${formatCurrency(rule.min_price)} – ${formatCurrency(rule.max_price)}`
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Complimentary Items</h1>
          <p className="text-sm text-muted-foreground">Configure free cases and bags included with orders.</p>
        </div>
      </section>

      <Tabs defaultValue="cases">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="cases" className="flex items-center gap-1.5">
            <RiBriefcaseLine className="size-4" />
            Cases
          </TabsTrigger>
          <TabsTrigger value="bags" className="flex items-center gap-1.5">
            <RiGiftLine className="size-4" />
            Bags
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1.5">
            <RiPriceTag3Line className="size-4" />
            Price Rules
          </TabsTrigger>
        </TabsList>

        {/* ── Cases Tab ── */}
        <TabsContent value="cases">
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Frame Cases</CardTitle>
                  <CardDescription>Cases given free with frames based on price rules.</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddItem('case')}>
                  <RiAddLine className="size-4" />
                  Add Case
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ItemTable
                items={allItems}
                isLoading={isLoadingItems}
                type="case"
                onEdit={openEditItem}
                onToggleStatus={(item) => toggleStatusMutation.mutate({ id: item.id, is_active: !item.is_active })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bags Tab ── */}
        <TabsContent value="bags">
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Carry Bags</CardTitle>
                  <CardDescription>Bags given free with every order.</CardDescription>
                </div>
                <Button size="sm" onClick={() => openAddItem('bag')}>
                  <RiAddLine className="size-4" />
                  Add Bag
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ItemTable
                items={allItems}
                isLoading={isLoadingItems}
                type="bag"
                onEdit={openEditItem}
                onToggleStatus={(item) => toggleStatusMutation.mutate({ id: item.id, is_active: !item.is_active })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Price Rules Tab ── */}
        <TabsContent value="rules">
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Case Price Rules</CardTitle>
                  <CardDescription>
                    Automatically assign a case based on the frame price. Rules are evaluated in priority order.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openAddRule} disabled={caseItems.length === 0}>
                  <RiAddLine className="size-4" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {caseItems.length === 0 && !isLoadingItems && (
                <div className="px-6 pb-6">
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 p-4 text-sm text-amber-700 dark:text-amber-400">
                    Add at least one case type in the <strong>Cases</strong> tab before creating price rules.
                  </div>
                </div>
              )}
              {isLoadingRules ? (
                <div className="p-8"><Loading /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule</TableHead>
                        <TableHead>Frame Price Range</TableHead>
                        <TableHead>Case</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            No price rules configured yet. Add rules to auto-assign cases.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium">{rule.name}</TableCell>
                            <TableCell className="tabular-nums">{formatPriceRange(rule)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{rule.item_name}</Badge>
                            </TableCell>
                            <TableCell>{rule.priority}</TableCell>
                            <TableCell>
                              <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label="Actions">
                                    <RiMore2Line className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => openEditRule(rule)}>
                                    <RiEditLine className="size-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleRuleStatusMutation.mutate({ id: rule.id, is_active: !rule.is_active })}>
                                    {rule.is_active ? 'Deactivate' : 'Activate'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setRuleToDelete(rule)}
                                  >
                                    <RiDeleteBin6Line className="size-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ItemFormDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={selectedItem}
        defaultType={addType}
        onSaved={invalidateItems}
      />

      <RuleFormDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={selectedRule}
        caseItems={caseItems.filter((c) => c.is_active)}
        onSaved={invalidateRules}
      />

      <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => { if (!open) setRuleToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete price rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the rule{' '}
              <span className="font-medium text-foreground">{ruleToDelete?.name}</span>.
              Existing orders are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => ruleToDelete && deleteRuleMutation.mutate(ruleToDelete.id)}
              disabled={deleteRuleMutation.isPending}
            >
              {deleteRuleMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ComplimentaryItems
