import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { basicDataApi } from '@/api/basic-data.api'
import {
  RiAddLine, RiAlertLine, RiBox3Line, RiEditLine, RiPrinterLine,
  RiQrCodeLine, RiSearchLine, RiSettings4Line,
} from '@remixicon/react'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Loading from '@/components/common/Loading'
import Pagination from '@/components/common/Pagination'
import ProductModal from '@/components/products/ProductModal'
import StockAdjustmentModal from '@/components/products/StockAdjustmentModal'
import QRScanner from '@/components/common/QRScanner'
import { formatCurrency } from '@/utils/formatters'
import { Product } from '@/types/product.types'
import toast from 'react-hot-toast'

export default function GeneralInventory() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

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
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-12"><Loading /></div>
          ) : (
            <>
              <div className="overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Min Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.data ?? []).map((product) => (
                      <TableRow key={product.product_id} className="group">
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{product.category.replace('-', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.brand || '—'}</TableCell>
                        <TableCell>{formatCurrency(product.selling_price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${product.current_stock <= product.min_stock_level ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                              {product.current_stock}
                            </span>
                            {product.current_stock <= product.min_stock_level && (
                              <RiAlertLine className="size-4 text-destructive" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.min_stock_level}</TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? 'default' : 'outline'}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedProduct(product); setIsModalOpen(true) }}>
                                    <RiEditLine className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedProduct(product); setIsStockModalOpen(true) }}>
                                    <RiSettings4Line className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Adjust Stock</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="sm" className="h-7 w-7 p-0"
                                    onClick={async () => {
                                      try {
                                        const blob = await productsApi.getLabel(product.product_id)
                                        const url = URL.createObjectURL(blob)
                                        window.open(url, '_blank')
                                        setTimeout(() => URL.revokeObjectURL(url), 100)
                                      } catch { toast.error('Failed to fetch label') }
                                    }}
                                  >
                                    <RiPrinterLine className="size-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Print Label</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && !data?.data?.length && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
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

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedProduct(null) }}
        product={selectedProduct}
        onSuccess={() => refetch()}
      />

      {selectedProduct && (
        <StockAdjustmentModal
          isOpen={isStockModalOpen}
          onClose={() => { setIsStockModalOpen(false); setSelectedProduct(null) }}
          product={selectedProduct}
          onSuccess={() => refetch()}
        />
      )}

      <QRScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleQRScan} />
    </div>
  )
}
