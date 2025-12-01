import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/products.api'
import { Plus, Search, AlertTriangle, Package } from 'lucide-react'
import Table from '@/components/common/Table'
import Pagination from '@/components/common/Pagination'
import Loading from '@/components/common/Loading'
import ProductModal from '@/components/products/ProductModal'
import StockAdjustmentModal from '@/components/products/StockAdjustmentModal'
import { formatCurrency } from '@/utils/formatters'
import { Product } from '@/types/product.types'

const Products = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
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
    setIsStockModalOpen(true)
  }

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (product: Product) => (
        <div>
          <p className="font-medium text-gray-900">{product.name}</p>
          <p className="text-sm text-gray-500">{product.sku}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (product: Product) => (
        <span className="badge-info capitalize">
          {product.category.replace('-', ' ')}
        </span>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (product: Product) => product.brand || '-',
    },
    {
      key: 'selling_price',
      header: 'Price',
      render: (product: Product) => formatCurrency(product.selling_price),
    },
    {
      key: 'current_stock',
      header: 'Stock',
      render: (product: Product) => (
        <div className="flex items-center space-x-2">
          <span
            className={`font-semibold ${
              product.current_stock <= product.min_stock_level
                ? 'text-red-600'
                : 'text-green-600'
            }`}
          >
            {product.current_stock}
          </span>
          {product.current_stock <= product.min_stock_level && (
            <AlertTriangle className="w-4 h-4 text-red-600" />
          )}
        </div>
      ),
    },
    {
      key: 'min_stock_level',
      header: 'Min Level',
      render: (product: Product) => product.min_stock_level,
    },
    {
      key: 'status',
      header: 'Status',
      render: (product: Product) => (
        <span className={product.is_active ? 'badge-success' : 'badge-danger'}>
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (product: Product) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleStockAdjustment(product)
          }}
          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          Adjust Stock
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products & Inventory</h1>
          <p className="text-gray-600 mt-1">Manage products and stock levels</p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input"
          >
            <option value="">All Categories</option>
            <option value="contact-lenses">Contact Lenses</option>
            <option value="eyeglasses">Eyeglasses</option>
            <option value="frames">Frames</option>
            <option value="sunglasses">Sunglasses</option>
            <option value="eye-drops">Eye Drops</option>
            <option value="accessories">Accessories</option>
          </select>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="lowStock"
              checked={lowStockFilter}
              onChange={(e) => setLowStockFilter(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="lowStock" className="text-sm text-gray-700">
              Low Stock Only
            </label>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{data?.total || 0}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-red-600">
                {data?.data.filter((p) => p.current_stock <= p.min_stock_level).length || 0}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  data?.data.reduce(
                    (sum, p) => sum + p.current_stock * p.cost_price,
                    0
                  ) || 0
                )}
              </p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {isLoading ? (
          <div className="p-12">
            <Loading />
          </div>
        ) : (
          <>
            <Table data={data?.data || []} columns={columns} onRowClick={handleEdit} />
            {data && (
              <Pagination
                currentPage={page}
                totalPages={data.total_pages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                totalItems={data.total}
              />
            )}
          </>
        )}
      </div>

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
          }}
          product={selectedProduct}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}

export default Products
