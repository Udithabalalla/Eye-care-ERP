import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { basicDataApi } from '@/api/basic-data.api'
import {
  RiAddLine, RiAlertLine, RiBox3Line, RiEditLine, RiPrinterLine,
  RiQrCodeLine, RiSearchLine, RiDeleteBinLine, RiArrowDownCircleLine,
  RiEqualizer2Line, RiMore2Line, RiCloseLine, RiFilterLine,
} from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import Loading from '@/components/common/Loading'
import Pagination from '@/components/common/Pagination'
import ProductModal from '@/components/products/ProductModal'
import StockAdjustmentModal from '@/components/products/StockAdjustmentModal'
import { CreatePODrawer } from '@/components/inventory/CreatePODrawer'
import QRScanner from '@/components/common/QRScanner'
import { formatCurrency } from '@/utils/formatters'
import { Product } from '@/types/product.types'
import { StockBadge } from '@/components/frames/StockBadge'
import toast from 'react-hot-toast'

export default function GeneralInventory() {
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false)

  // Row selection
  const [selectedProducts, setSelectedProducts] = useState<Map<string, Product>>(new Map())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', page, pageSize, search, categoryFilter],
    queryFn: () => productsApi.getAll({ page, page_size: pageSize, search, category: categoryFilter }),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => basicDataApi.getProductCategories({ page: 1, page_size: 200, is_active: true }),
    staleTime: 5 * 60 * 1000,
  })
  const categories = categoriesData?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Product deleted')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => toast.error('Failed to delete product'),
  })

  const handleQRScan = async (scannedCode: string) => {
    try {
      const product = await productsApi.lookupByCode(scannedCode)
      setSearch(product.sku || product.name)
      setPage(1)
      toast.success(`Found: ${product.name}`)
      setBarcodeInput('')
    } catch {
      toast.error('Product not found for this barcode')
      setBarcodeInput('')
    }
  }

  const toggleProductSelect = (p: Product) => {
    setSelectedProducts((prev) => {
      const next = new Map(prev)
      if (next.has(p.product_id)) next.delete(p.product_id)
      else next.set(p.product_id, p)
      return next
    })
  }
  const clearSelection = () => setSelectedProducts(new Map())
  const singleSelected = selectedProducts.size === 1 ? [...selectedProducts.values()][0] : null

  const openAdjust = (p: Product) => { setSelectedProduct(p); setAdjustModalOpen(true) }
  const openReceive = (p: Product) => { setSelectedProduct(p); setReceiveDrawerOpen(true) }
  const openEdit = (p: Product) => { setSelectedProduct(p); setIsModalOpen(true) }

  const openPrintLabel = async (p: Product) => {
    try {
      const blob = await productsApi.getLabel(p.product_id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch { toast.error('Failed to fetch label') }
  }

  const lowStockCount = data?.data.filter((p) => p.current_stock <= p.min_stock_level).length ?? 0
  const inventoryValue = data?.data.reduce((sum, p) => sum + p.current_stock * p.cost_price, 0) ?? 0

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">General Inventory</h1>
          <p className="text-sm text-muted-foreground">Contact lenses, eye drops, accessories, and other products.</p>
        </div>
        <Button size="sm" onClick={() => { setSelectedProduct(null); setIsModalOpen(true) }}>
          <RiAddLine className="size-4" />
          Add Product
        </Button>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold">{data?.total ?? 0}</p>
            </div>
            <RiBox3Line className="w-8 h-8 text-primary/60" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-destructive' : ''}`}>{lowStockCount}</p>
            </div>
            <RiAlertLine className={`w-8 h-8 ${lowStockCount > 0 ? 'text-destructive' : 'text-muted-foreground/40'}`} />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Inventory Value</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(inventoryValue)}</p>
            </div>
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground text-xs font-semibold">LKR</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Product Records</CardTitle>
              <CardDescription>Search, filter, and manage all general inventory products.</CardDescription>
            </div>
            <Badge variant="secondary">{data?.total ?? 0} total</Badge>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            <div className="relative w-40">
              <RiQrCodeLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Scan barcode…"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="pl-9 h-9"
                onKeyDown={(e) => { if (e.key === 'Enter' && barcodeInput.trim()) handleQRScan(barcodeInput.trim()) }}
              />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setIsScannerOpen(true)}>
              <RiQrCodeLine className="size-4" />
            </Button>
            <div className="relative w-52">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search products…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9"
              />
            </div>
            <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(categoryFilter || search) && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={() => { setCategoryFilter(''); setSearch(''); setPage(1) }}>
                <RiFilterLine className="size-3.5" />Clear
              </Button>
            )}
          </div>

          {/* Selection toolbar */}
          {selectedProducts.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium text-primary">{selectedProducts.size} selected</span>
              <Separator orientation="vertical" className="h-5" />
              {singleSelected && (
                <>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => { openReceive(singleSelected); clearSelection() }}>
                    <RiArrowDownCircleLine className="size-3.5" />Receive Stock
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={() => { openAdjust(singleSelected); clearSelection() }}>
                    <RiEqualizer2Line className="size-3.5" />Adjust Stock
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={() => { openEdit(singleSelected); clearSelection() }}>
                    <RiEditLine className="size-3.5" />Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={() => { openPrintLabel(singleSelected); clearSelection() }}>
                    <RiPrinterLine className="size-3.5" />Print Label
                  </Button>
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <RiMore2Line className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {singleSelected && (
                    <>
                      <DropdownMenuItem onClick={() => { openReceive(singleSelected); clearSelection() }}>
                        <RiArrowDownCircleLine className="mr-2 size-4" />Receive Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { openAdjust(singleSelected); clearSelection() }}>
                        <RiEqualizer2Line className="mr-2 size-4" />Adjust Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { openEdit(singleSelected); clearSelection() }}>
                        <RiEditLine className="mr-2 size-4" />Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { openPrintLabel(singleSelected); clearSelection() }}>
                        <RiPrinterLine className="mr-2 size-4" />Print Label
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      const ids = [...selectedProducts.keys()]
                      if (confirm(`Delete ${ids.length} product${ids.length > 1 ? 's' : ''}?`)) {
                        ids.forEach((id) => deleteMutation.mutate(id))
                        clearSelection()
                      }
                    }}
                  >
                    <RiDeleteBinLine className="mr-2 size-4" />
                    Delete {selectedProducts.size > 1 ? `${selectedProducts.size} products` : 'product'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clearSelection}>
                <RiCloseLine className="size-4" />
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-12"><Loading /></div>
          ) : (
            <>
              <div className="overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            (data?.data.length ?? 0) > 0 &&
                            data!.data.every((p) => selectedProducts.has(p.product_id))
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const next = new Map(selectedProducts)
                              data?.data.forEach((p) => next.set(p.product_id, p))
                              setSelectedProducts(next)
                            } else {
                              clearSelection()
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Min Level</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead colSpan={2} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.data ?? []).map((product) => {
                      const isSelected = selectedProducts.has(product.product_id)
                      return (
                        <TableRow
                          key={product.product_id}
                          className={`group transition-colors duration-100 ${isSelected ? 'bg-primary/[0.06]' : 'hover:bg-muted/25'}`}
                        >
                          {/* Checkbox */}
                          <TableCell className="w-10 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleProductSelect(product)}
                              className="bg-background"
                            />
                          </TableCell>

                          {/* Product name + SKU */}
                          <TableCell className="py-2.5">
                            <div>
                              <p className="font-medium text-sm leading-tight">{product.name}</p>
                              <p className="text-xs text-muted-foreground/70 font-mono mt-0.5">{product.sku}</p>
                            </div>
                          </TableCell>

                          <TableCell className="py-2.5">
                            <Badge variant="secondary" className="capitalize text-xs">{product.category.replace('-', ' ')}</Badge>
                          </TableCell>

                          <TableCell className="py-2.5 text-sm text-muted-foreground">{product.brand || '—'}</TableCell>

                          {/* Stock */}
                          <TableCell className="py-2.5">
                            <StockBadge stock={product.current_stock} reorderLevel={product.min_stock_level} showCount />
                          </TableCell>

                          <TableCell className="py-2.5 text-sm text-muted-foreground tabular-nums">{product.min_stock_level}</TableCell>

                          <TableCell className="py-2.5 text-right tabular-nums font-medium text-sm">
                            {formatCurrency(product.selling_price)}
                          </TableCell>

                          {/* Hover actions */}
                          <TableCell className="py-2 text-right" colSpan={2} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                      onClick={() => openReceive(product)}
                                    >
                                      <RiArrowDownCircleLine className="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Receive Stock</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openAdjust(product)}>
                                      <RiEqualizer2Line className="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Adjust Stock</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openPrintLabel(product)}>
                                      <RiPrinterLine className="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Print Label</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Separator orientation="vertical" className="h-4 mx-0.5" />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(product)}>
                                      <RiEditLine className="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => { if (confirm('Delete this product?')) deleteMutation.mutate(product.product_id) }}
                                    >
                                      <RiDeleteBinLine className="size-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!isLoading && !data?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          No products found. Add your first product.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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

      {/* Edit/Create modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedProduct(null) }}
        product={selectedProduct}
        onSuccess={() => refetch()}
      />

      {/* Receive Stock — creates a Draft PO for the selected product */}
      <CreatePODrawer
        open={receiveDrawerOpen}
        onClose={() => { setReceiveDrawerOpen(false); setSelectedProduct(null) }}
        subject={selectedProduct ? { kind: 'product', item: selectedProduct } : null}
        onSuccess={() => refetch()}
      />

      {/* Adjust Stock modal */}
      {selectedProduct && (
        <StockAdjustmentModal
          isOpen={adjustModalOpen}
          onClose={() => { setAdjustModalOpen(false); setSelectedProduct(null) }}
          product={selectedProduct}
          onSuccess={() => refetch()}
        />
      )}

      <QRScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleQRScan} />
    </div>
  )
}
