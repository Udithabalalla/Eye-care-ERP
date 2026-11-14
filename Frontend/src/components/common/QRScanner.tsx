import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { RiCameraLine, RiAlertLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'

interface QRScannerProps {
    onScan: (data: string) => void
    onClose: () => void
    isOpen: boolean
}

const qrCodeRegionId = 'qr-reader'

const QRScanner = ({ onScan, onClose, isOpen }: QRScannerProps) => {
    const [error, setError] = useState<string | null>(null)
    // The camera view mounts inside the dialog's portal a moment after it opens;
    // start the scanner once that element exists
    const [region, setRegion] = useState<HTMLDivElement | null>(null)
    const scannerRef = useRef<Html5Qrcode | null>(null)

    const stopScanning = async () => {
        const scanner = scannerRef.current
        scannerRef.current = null
        // Read the library's own flag: a state value captured by the effect would be stale
        if (scanner?.isScanning) {
            try {
                await scanner.stop()
                scanner.clear()
            } catch (err) {
                console.error('Error stopping scanner:', err)
            }
        }
    }

    useEffect(() => {
        if (!isOpen || !region) return

        let cancelled = false
        const startScanning = async () => {
            try {
                setError(null)
                const scanner = new Html5Qrcode(qrCodeRegionId)
                scannerRef.current = scanner
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        onScan(decodedText)
                        stopScanning()
                        onClose()
                    },
                    () => {
                        // suppress per-frame decode errors
                    },
                )
                if (cancelled) stopScanning()
            } catch (err: any) {
                console.error('Error starting scanner:', err)
                if (!cancelled) setError(err?.message || 'Failed to start camera. Please check permissions.')
            }
        }

        startScanning()
        return () => {
            cancelled = true
            stopScanning()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, region])

    const close = () => {
        stopScanning()
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RiCameraLine className="size-5" />
                        Scan QR Code
                    </DialogTitle>
                    <DialogDescription>Position the QR code within the frame.</DialogDescription>
                </DialogHeader>

                {error ? (
                    <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                        <RiAlertLine />
                        <AlertDescription className="flex flex-col items-start gap-2">
                            {error}
                            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div
                        id={qrCodeRegionId}
                        ref={setRegion}
                        className="w-full overflow-hidden rounded-lg border-2 border-border"
                    />
                )}

                <DialogFooter>
                    <Button variant="outline" className="w-full" onClick={close}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default QRScanner
