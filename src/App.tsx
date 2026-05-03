import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ProtectedRoute, AdminRoute } from '@/contexts/AuthContext'
import Layout from '@/components/layout/Layout'
import { PageSpinner } from '@/components/ui/Spinner'

// Eagerly loaded (fast pages / auth)
import Login from '@/pages/auth/Login'
import DashboardRouter from '@/pages/DashboardRouter'

// Lazy-loaded (larger bundles — exceljs, recharts, etc.)
const EquipmentList = lazy(() => import('@/pages/equipment/EquipmentList'))
const EquipmentDetail = lazy(() => import('@/pages/equipment/EquipmentDetail'))
const AddEquipment = lazy(() => import('@/pages/equipment/AddEquipment'))
const ImportEquipment = lazy(() => import('@/pages/equipment/ImportEquipment'))
const DuplicateScanner = lazy(() => import('@/pages/equipment/DuplicateScanner'))
const QRLabels = lazy(() => import('@/pages/equipment/QRLabels'))
const MaintenanceCalendar = lazy(() => import('@/pages/admin/MaintenanceCalendar'))
const PartsInventory = lazy(() => import('@/pages/admin/PartsInventory'))
const ServiceHistory = lazy(() => import('@/pages/service/ServiceHistory'))
const LogService = lazy(() => import('@/pages/service/LogService'))
const Assignments = lazy(() => import('@/pages/admin/Assignments'))
const Analytics = lazy(() => import('@/pages/admin/Analytics'))
const UserManagement = lazy(() => import('@/pages/admin/UserManagement'))
const Settings = lazy(() => import('@/pages/admin/Settings'))
const EngineerList = lazy(() => import('@/pages/engineers/EngineerList'))
const Notifications = lazy(() => import('@/pages/Notifications'))

function Loader() {
  return (
    <Suspense fallback={<PageSpinner />}>
      {null}
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardRouter />} />

          {/* Equipment */}
          <Route path="/equipment" element={<Suspense fallback={<PageSpinner />}><EquipmentList /></Suspense>} />
          <Route path="/equipment/add" element={<AdminRoute><Suspense fallback={<PageSpinner />}><AddEquipment /></Suspense></AdminRoute>} />
          <Route path="/equipment/import" element={<AdminRoute><Suspense fallback={<PageSpinner />}><ImportEquipment /></Suspense></AdminRoute>} />
          <Route path="/equipment/duplicates" element={<AdminRoute><Suspense fallback={<PageSpinner />}><DuplicateScanner /></Suspense></AdminRoute>} />
          <Route path="/equipment/qr-labels" element={<AdminRoute><Suspense fallback={<PageSpinner />}><QRLabels /></Suspense></AdminRoute>} />
          <Route path="/equipment/qr-labels/:id" element={<AdminRoute><Suspense fallback={<PageSpinner />}><QRLabels /></Suspense></AdminRoute>} />
          <Route path="/calendar" element={<AdminRoute><Suspense fallback={<PageSpinner />}><MaintenanceCalendar /></Suspense></AdminRoute>} />
          <Route path="/parts" element={<AdminRoute><Suspense fallback={<PageSpinner />}><PartsInventory /></Suspense></AdminRoute>} />
          <Route path="/equipment/:id" element={<Suspense fallback={<PageSpinner />}><EquipmentDetail /></Suspense>} />
          <Route path="/equipment/:id/edit" element={<AdminRoute><Suspense fallback={<PageSpinner />}><AddEquipment /></Suspense></AdminRoute>} />

          {/* Service */}
          <Route path="/service-history" element={<Suspense fallback={<PageSpinner />}><ServiceHistory /></Suspense>} />
          <Route path="/service-history/:equipmentId" element={<Suspense fallback={<PageSpinner />}><ServiceHistory /></Suspense>} />
          <Route path="/service/log/:assignmentId" element={<Suspense fallback={<PageSpinner />}><LogService /></Suspense>} />
          <Route path="/service/log-new/:equipmentId" element={<Suspense fallback={<PageSpinner />}><LogService /></Suspense>} />

          {/* Engineers */}
          <Route path="/engineers" element={<AdminRoute><Suspense fallback={<PageSpinner />}><EngineerList /></Suspense></AdminRoute>} />

          {/* Admin-only */}
          <Route path="/assignments" element={<AdminRoute><Suspense fallback={<PageSpinner />}><Assignments /></Suspense></AdminRoute>} />
          <Route path="/analytics" element={<AdminRoute><Suspense fallback={<PageSpinner />}><Analytics /></Suspense></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><Suspense fallback={<PageSpinner />}><UserManagement /></Suspense></AdminRoute>} />
          <Route path="/settings" element={<AdminRoute><Suspense fallback={<PageSpinner />}><Settings /></Suspense></AdminRoute>} />

          {/* Notifications */}
          <Route path="/notifications" element={<Suspense fallback={<PageSpinner />}><Notifications /></Suspense>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
