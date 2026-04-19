import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { productsApi } from '@/api/products.api'

export const useBarcodeScanner = () => {
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const lookupMutation = useMutation({
    mutationFn: (barcode: string) => productsApi.lookupByCode(barcode),
  })

  const openScanner = () => setIsScannerOpen(true)
  const closeScanner = () => setIsScannerOpen(false)

  const scanBarcode = async (barcode: string) => {
    return lookupMutation.mutateAsync(barcode)
  }

  return {
    isScannerOpen,
    openScanner,
    closeScanner,
    scanBarcode,
    isScanningProduct: lookupMutation.isPending,
  }
}
