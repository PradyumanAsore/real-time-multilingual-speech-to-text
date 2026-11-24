import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/ui/Layout'
import DashboardPage from './pages/DashboardPage'
import TranscribePage from './pages/TranscribePage'
import HistoryPage from './pages/HistoryPage'
import TranscriptionDetailPage from './pages/TranscriptionDetailPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transcribe" element={<TranscribePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/transcriptions/:id" element={<TranscriptionDetailPage />} />
      </Routes>
    </Layout>
  )
}
