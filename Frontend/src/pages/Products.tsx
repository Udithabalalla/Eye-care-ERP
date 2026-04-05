import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { Plus, SearchLg, AlertTriangle, Package, QrCode01, Edit01, Printer, Settings01 } from '@untitledui/icons'
import { Table, TableCard, PaginationPageDefault, Button, Input, BadgeWithDot, Select, SelectItem, Tooltip } from '@/components/ui'
import Loading from '@/components/common/Loading'
import ProductModal from '@/components/products/ProductModal'
import StockAdjustmentModal from '@/components/products/StockAdjustmentModal'
import QRScanner from '@/components/common/QRScanner'
import { formatCurrency } from '@/utils/formatters'
import { Product } from '@/types/product.types'
import { Key } from 'react-aria-components'
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
      setBarcodeInput('') // Clear input after successful scan
    } catch (error) {
      console.error('Product not found:', error)
      alert('Product not found. Please add it manually.')
      setBarcodeInput('') // Clear input even on error
    }
  }

  const handlePageSizeChange = (key: Key | null) => {
    if (key) {
      setPageSize(Number(key))
      setPage(1)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-tertiary">Total Products</p>
              <p className="text-2xl font-bold text-primary">{data?.total || 0}</p>
            </div>
            <Package className="w-8 h-8 text-brand-600" />
          </div>
        </div>
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-tertiary">Low Stock Items</p>
              <p className="text-2xl font-bold text-error-600">
                {data?.data.filter((p) => p.current_stock <= p.min_stock_level).length || 0}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-error-600" />
          </div>
        </div>
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-tertiary">Total Inventory Value</p>
              <p className="text-2xl font-bold text-success-600">
                {formatCurrency(
                  data?.data.reduce(
                    (sum, p) => sum + p.current_stock * p.cost_price,
                    0
                  ) || 0
                )}
              </p>
            </div>
                      <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center text-success-600 text-xs font-semibold">LKR</div>
          </div>
        </div>
      </div>

      {/* Table Card with Untitled UI Structure */}
      <TableCard.Root>
        <TableCard.Header
          title="Products & Inventory"
          badge={data?.total || 0}
          description="Manage products and stock levels"
          contentTrailing={
            <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Input
                  placeholder="Scan barcode..."
                  value={barcodeInput}
                  onChange={setBarcodeInput}
                  iconLeading={QrCode01}
                  aria-label="Barcode scanner"
                  className="w-full lg:w-40"
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && barcodeInput.trim()) {
                      handleQRScan(barcodeInput.trim())
                    }
                  }}
                />
              </div>
              <Button onClick={() => setIsScannerOpen(true)} iconLeading={QrCode01} size="sm">
                Scan Barcode
              </Button>
              <Input
                placeholder="Search products..."
                value={search}
                onChange={setSearch}
                iconLeading={SearchLg}
                aria-label="Search products"
                className="w-full lg:w-48"
              />
              <Select
                selectedKey={categoryFilter || 'all'}
                onSelectionChange={(key) => setCategoryFilter(key === 'all' ? '' : String(key))}
                placeholder="Category"
                aria-label="Filter by category"
                className="w-full lg:w-40"
              >
                <SelectItem id="all">All Categories</SelectItem>
                <SelectItem id="contact-lenses">Contact Lenses</SelectItem>
                <SelectItem id="eyeglasses">Eyeglasses</SelectItem>
                <SelectItem id="frames">Frames</SelectItem>
                <SelectItem id="sunglasses">Sunglasses</SelectItem>
                <SelectItem id="eye-drops">Eye Drops</SelectItem>
                <SelectItem id="accessories">Accessories</SelectItem>
              </Select>
              <Select
                selectedKey={String(pageSize)}
                onSelectionChange={handlePageSizeChange}
                placeholder="Rows"
                aria-label="Rows per page"
                className="w-full lg:w-28"
              >
                <SelectItem id="10">10 rows</SelectItem>
                <SelectItem id="25">25 rows</SelectItem>
                <SelectItem id="50">50 rows</SelectItem>
              </Select>
              <Button onClick={handleAdd} iconLeading={Plus} size="sm">
                Add Product
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : (
          <>
            <Table aria-label="Products table" selectionMode="multiple" selectionBehavior="toggle">
              <Table.Header>
                <Table.Head label="Product" isRowHeader />
                <Table.Head label="Category" />
                <Table.Head label="Brand" />
                <Table.Head label="Price" />
                <Table.Head label="Stock" />
                <Table.Head label="Min Level" />
                <Table.Head label="Status" />
                <Table.Head />
              </Table.Header>
              <Table.Body items={data?.data || []}>
                {(product) => (
                  <Table.Row id={product.product_id}>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-primary">{product.name}</p>
                        <p className="text-sm text-tertiary">{product.sku}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <BadgeWithDot size="sm" color="brand">
                        {product.category.replace('-', ' ')}
                      </BadgeWithDot>
                    </Table.Cell>
                    <Table.Cell>{product.brand || '-'}</Table.Cell>
                    <Table.Cell>{formatCurrency(product.selling_price)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${product.current_stock <= product.min_stock_level ? 'text-error-600' : 'text-success-600'}`}>
                          {product.current_stock}
                        </span>
                        {product.current_stock <= product.min_stock_level && (
                          <AlertTriangle className="w-4 h-4 text-error-600" />
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{product.min_stock_level}</Table.Cell>
                    <Table.Cell>
                      <BadgeWithDot size="md" color={product.is_active ? 'success' : 'error'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </BadgeWithDot>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip title="Edit product">
                          <Button
                            color="link-gray"
                            onClick={() => handleEdit(product)}
                            iconLeading={Edit01}
                            aria-label="Edit"
                            size="sm"
                          />
                        </Tooltip>
                        <Tooltip title="Adjust stock">
                          <Button
                            color="link-gray"
                            onClick={() => handleStockAdjustment(product)}
                            iconLeading={Settings01}
                            aria-label="Adjust Stock"
                            size="sm"
                          />
                        </Tooltip>
                        <Tooltip title="Print label">
                          <Button
                            color="link-gray"
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
                            iconLeading={Printer}
                            aria-label="Print Label"
                            size="sm"
                          />
                        </Tooltip>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
            {data && (
              <PaginationPageDefault
                page={page}
                total={data.total_pages}
                onPageChange={setPage}
                className="border-t border-secondary px-6 py-4"
              />
            )}
          </>
        )}
      </TableCard.Root>

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedProduct(null)
        }}
        product={selectedProduct}
        onSuccess={() => refetch()}
      />

      {/* Stock Adjustment Modal */}
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
