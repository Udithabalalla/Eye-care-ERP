import { Plus, Package } from 'lucide-react'

const Products = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products & Inventory</h1>
          <p className="text-gray-600 mt-1">Manage products and stock levels</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Add Product
        </button>
      </div>

      <div className="card">
        <p className="text-gray-600">Products list coming soon...</p>
      </div>
    </div>
  )
}

export default Products
