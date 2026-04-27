import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { RiAddLine, RiSearchLine, RiAlertLine, RiBox3Line, RiQrCodeLine, RiEditLine, RiPrinterLine, RiSettings4Line } from '@remixicon/react'
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

const Products = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockFilter] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isFromQRScan, setIsFromQRScan] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', page, pageSize, search, categoryFilter, lowStockFilter],
    queryFn: () =>
      productsApi.getAll({
        page,
        page_size: pageSize,
        search,
        category: categoryFilter,
        low_stock: lowStockFilter,
      }),
  })

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedProduct(null)
    setIsModalOpen(true)
  }

  const handleStockAdjustment = (product: Product) => {
    setSelectedProduct(product)
    setIsFromQRScan(false)
    setIsStockModalOpen(true)
  }

  const handleQRScan = async (scannedCode: string) => {
    try {
      const product = await productsApi.lookupByCode(scannedCode)
      setSearch(product.sku || product.name)
      setPage(1)
      toast.success(`Found product: ${product.name}`)
      setBarcodeInput('')
    } catch (error) {
      console.error('Product not found:', error)
      alert('Product not found. Please add it manually.')
      setBarcodeInput('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl bg-background shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold text-foreground">{data?.total || 0}</p>
            </div>
            <RiBox3Line className="w-8 h-8 text-brand-600" />
          </div>
        </div>
        <div className="rounded-xl bg-background shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
              <p className="text-2xl font-bold text-error-600">
                {data?.data.filter((p) => p.current_stock <= p.min_stock_level).length || 0}
              </p>
            </div>
            <RiAlertLine className="w-8 h-8 text-error-600" />
          </div>
        </div>
        <div className="rounded-xl bg-background shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Inventory Value</p>
              <p className="text-2xl font-bold text-success-600">
                {formatCurrency(
                  data?.data.reduce((sum, p) => sum + p.current_stock * p.cost_price, 0) || 0
                )}
              </p>
            </div>
            <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center text-success-600 text-xs font-semibold">LKR</div>
          </div>
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Products & Inventory</CardTitle>
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </div>
            <CardDescription>Manage products and stock levels</CardDescription>
          </div>
          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-40">
              <RiQrCodeLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Scan barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                aria-label="Barcode scanner"
                className="pl-9"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && barcodeInput.trim()) {
                    handleQRScan(barcodeInput.trim())
                  }
                }}
              />
            </div>
            <Button onClick={() => setIsScannerOpen(true)} size="sm" variant="outline">
              <RiQrCodeLine className="size-4 mr-1" />
              Scan Barcode
            </Button>
            <div className="relative w-full lg:w-48">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search products"
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter || 'all'} onValueChange={(val) => setCategoryFilter(val === 'all' ? '' : val)}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="contact-lenses">Contact Lenses</SelectItem>
                <SelectItem value="eyeglasses">Eyeglasses</SelectItem>
                <SelectItem value="frames">Frames</SelectItem>
                <SelectItem value="sunglasses">Sunglasses</SelectItem>
                <SelectItem value="eye-drops">Eye Drops</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1) }}>
              <SelectTrigger className="w-full lg:w-28">
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
              Add Product
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
                  {(data?.data || []).map((product) => (
                    <TableRow key={product.product_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-brand-200 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400">
                          {product.category.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{product.brand || '-'}</TableCell>
                      <TableCell>{formatCurrency(product.selling_price)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${product.current_stock <= product.min_stock_level ? 'text-error-600' : 'text-success-600'}`}>
                            {product.current_stock}
                          </span>
                          {product.current_stock <= product.min_stock_level && (
                            <RiAlertLine className="w-4 h-4 text-error-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.min_stock_level}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={product.is_active
                            ? 'border-success-200 bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
                            : 'border-error-200 bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(product)} aria-label="Edit">
                                  <RiEditLine className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit product</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => handleStockAdjustment(product)} aria-label="Adjust Stock">
                                  <RiSettings4Line className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Adjust stock</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Print Label"
                                  onClick={async () => {
                                    try {
                                      const response = await productsApi.getLabel(product.product_id)
                                      const url = URL.createObjectURL(response)
                                      window.open(url, '_blank')
                                      setTimeout(() => URL.revokeObjectURL(url), 100)
                                    } catch (error) {
                                      console.error('Error fetching label:', error)
                                    }
                                  }}
                                >
                                  <RiPrinterLine className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Print label</TooltipContent>
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

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedProduct(null)
        }}
        product={selectedProduct}
        onSuccess={() => refetch()}
      />

      {selectedProduct && (
        <StockAdjustmentModal
          isOpen={isStockModalOpen}
          onClose={() => {
            setIsStockModalOpen(false)
            setSelectedProduct(null)
            setIsFromQRScan(false)
          }}
          product={selectedProduct}
          onSuccess={() => refetch()}
          defaultValues={isFromQRScan ? {
            quantity: 1,
            reason: 'Purchase - New stock received'
          } : undefined}
        />
      )}

      <QRScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleQRScan}
      />
    </div>
  )
}

export default Products
