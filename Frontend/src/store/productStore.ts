import { create } from 'zustand'
import { Product } from '@/types/product.types'

interface ProductState {
  products: Product[]
  selectedProduct: Product | null
  isLoading: boolean
  setProducts: (products: Product[]) => void
  setSelectedProduct: (product: Product | null) => void
  setLoading: (loading: boolean) => void
  updateProduct: (product: Product) => void
  removeProduct: (productId: string) => void
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  selectedProduct: null,
  isLoading: false,

  setProducts: (products) => set({ products }),
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  setLoading: (loading) => set({ isLoading: loading }),

  updateProduct: (updatedProduct) =>
    set((state) => ({
      products: state.products.map((p) =>
        p.product_id === updatedProduct.product_id ? updatedProduct : p
      ),
    })),

  removeProduct: (productId) =>
    set((state) => ({
      products: state.products.filter((p) => p.product_id !== productId),
    })),
}))
