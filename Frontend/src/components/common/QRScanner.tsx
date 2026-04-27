import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { RiCloseLine, RiCameraLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'

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

                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode(qrCodeRegionId)
                }

                await scannerRef.current.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    (decodedText) => {
                        onScan(decodedText)
                        stopScanning()
                        onClose()
                    },
                    (errorMessage) => {
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
            <div className="bg-background rounded-xl shadow-2xl max-w-md w-full mx-4">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center space-x-2">
                        <RiCameraLine className="w-5 h-5 text-foreground" />
                        <h2 className="text-lg font-semibold text-foreground">Scan QR Code</h2>
                    </div>
                    <button
                        onClick={() => {
                            stopScanning()
                            onClose()
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RiCloseLine className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {error ? (
                        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4 text-center">
                            <p className="text-error-600 dark:text-error-400 text-sm">{error}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => window.location.reload()}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div
                                id={qrCodeRegionId}
                                className="rounded-lg overflow-hidden border-2 border-border"
                                style={{ width: '100%' }}
                            />
                            <p className="text-center text-muted-foreground text-sm mt-4">
                                Position the QR code within the frame
                            </p>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-border">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            stopScanning()
                            onClose()
                        }}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default QRScanner
