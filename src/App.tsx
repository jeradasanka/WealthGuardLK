import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Setup } from './pages/Setup'
import { IncomePage } from './pages/IncomePage'
import { AssetsPage } from './pages/AssetsPage'
import { TaxComputationPage } from './pages/TaxComputationPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/income" element={<IncomePage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/tax-computation" element={<TaxComputationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Router>
  )
}

export default App
