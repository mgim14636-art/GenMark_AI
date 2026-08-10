import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminDashboard from './admin/AdminDashboard'
import './admin-demo.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminDashboard standalone />
  </StrictMode>,
)
