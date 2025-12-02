import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera } from 'lucide-react'

interface QRScannerProps {
    onScan: (data: string) => void
    onClose: () => void
    isOpen: boolean
}

const QRScanner = ({ onScan, onClose, isOpen }: QRScannerProps) => {
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const qrCodeRegionId = "qr-reader"

    useEffect(() => {
        if (!isOpen) {
            stopScanning()
            return
        }

        const startScanning = async () => {
            try {
                setError(null)

                // Create scanner instance
                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode(qrCodeRegionId)
                }

                // Start scanning
                await scannerRef.current.start(
                    { facingMode: "environment" }, // Use back camera
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText) => {
                        // Success callback
                        onScan(decodedText)
                        stopScanning()
                        onClose()
                    },
                    (errorMessage) => {
                        // Error callback (ignore, happens frequently during scanning)
                        console.debug(errorMessage)
                    }
                )

                setIsScanning(true)
            } catch (err: any) {
                console.error('Error starting scanner:', err)
                setError(err?.message || 'Failed to start camera. Please check permissions.')
                setIsScanning(false)
            }
        }

        startScanning()

        return () => {
            stopScanning()
        }
    }, [isOpen])

    const stopScanning = async () => {
        if (scannerRef.current && isScanning) {
            try {
                await scannerRef.current.stop()
                scannerRef.current.clear()
            } catch (err) {
                console.error('Error stopping scanner:', err)
            }
            setIsScanning(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
            <div className="bg-bg-secondary rounded-xl shadow-2xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center space-x-2">
                        <Camera className="w-5 h-5 text-text-primary" />
                        <h2 className="text-lg font-semibold text-text-primary">Scan QR Code</h2>
                    </div>
                    <button
                        onClick={() => {
                            stopScanning()
                            onClose()
                        }}
                        className="text-text-tertiary hover:text-text-primary transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scanner Area */}
                <div className="p-6">
                    {error ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-3 btn-secondary text-sm"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            <div
                                id={qrCodeRegionId}
                                className="rounded-lg overflow-hidden border-2 border-border"
                                style={{ width: '100%' }}
                            />
                            <p className="text-center text-text-secondary text-sm mt-4">
                                Position the QR code within the frame
                            </p>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border">
                    <button
                        onClick={() => {
                            stopScanning()
                            onClose()
                        }}
                        className="btn-secondary w-full"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

export default QRScanner
