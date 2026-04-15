import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/common/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Loading from './components/common/Loading'

// Lazy load pages for better initial bundle size
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Patients = lazy(() => import('./pages/Patients'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Prescriptions = lazy(() => import('./pages/Prescriptions'))
const Products = lazy(() => import('./pages/Products'))
const Invoices = lazy(() => import('./pages/Invoices'))
const SalesOrders = lazy(() => import('./pages/SalesOrders'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Payments = lazy(() => import('./pages/Payments'))
const Refunds = lazy(() => import('./pages/Refunds'))
const InventoryMovements = lazy(() => import('./pages/InventoryMovements'))
const StockAdjustments = lazy(() => import('./pages/StockAdjustments'))
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'))
const RolesPermissions = lazy(() => import('./pages/RolesPermissions'))
const Ledger = lazy(() => import('./pages/Ledger'))
const Doctors = lazy(() => import('./pages/Doctors'))
const Reports = lazy(() => import('./pages/Reports'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const StockReceipts = lazy(() => import('./pages/StockReceipts'))
const SupplierInvoices = lazy(() => import('./pages/SupplierInvoices'))
const SupplierPayments = lazy(() => import('./pages/SupplierPayments'))
const Users = lazy(() => import('./pages/Users'))
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
        <Route
          path="/forgot-password"
          element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />}
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
            <Route path="/sales-orders" element={<SalesOrders />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/stock-receipts" element={<StockReceipts />} />
            <Route path="/supplier-invoices" element={<SupplierInvoices />} />
            <Route path="/supplier-payments" element={<SupplierPayments />} />
            <Route path="/users" element={<Users />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/inventory-movements" element={<InventoryMovements />} />
            <Route path="/stock-adjustments" element={<StockAdjustments />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="/roles-permissions" element={<RolesPermissions />} />
            <Route path="/settings" element={<ClinicSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
