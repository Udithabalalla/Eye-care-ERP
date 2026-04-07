import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/common/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Loading from './components/common/Loading'

// Lazy load pages for better initial bundle size
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Patients = lazy(() => import('./pages/Patients'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Prescriptions = lazy(() => import('./pages/Prescriptions'))
const Products = lazy(() => import('./pages/Products'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Doctors = lazy(() => import('./pages/Doctors'))
const Reports = lazy(() => import('./pages/Reports'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const StockReceipts = lazy(() => import('./pages/StockReceipts'))
const SupplierInvoices = lazy(() => import('./pages/SupplierInvoices'))
const SupplierPayments = lazy(() => import('./pages/SupplierPayments'))
const ClinicSettings = lazy(() => import('./pages/ClinicSettings'))

// Suspense fallback component
const PageLoader = () => <Loading fullScreen text="Loading..." />

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />}
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/stock-receipts" element={<StockReceipts />} />
            <Route path="/supplier-invoices" element={<SupplierInvoices />} />
            <Route path="/supplier-payments" element={<SupplierPayments />} />
            <Route path="/settings" element={<ClinicSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
