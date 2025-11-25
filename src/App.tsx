import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Setup } from './pages/Setup'
import { IncomePage } from './pages/IncomePage'
import { AssetsPage } from './pages/AssetsPage'
import { TaxComputationPage } from './pages/TaxComputationPage'
import { SettingsPage } from './pages/SettingsPage'
import { useStore } from './stores/useStore'
import { getStoredPassphrase } from './utils/storage'

function App() {
  const loadFromStorage = useStore((state) => state.loadFromStorage);

  useEffect(() => {
    // Auto-load data if passphrase exists in localStorage
    const autoLoad = async () => {
      const storedPassphrase = getStoredPassphrase();
      if (storedPassphrase) {
        try {
          await loadFromStorage(storedPassphrase);
          console.log('Auto-loaded data from cookies');
        } catch (error) {
          console.error('Failed to auto-load data:', error);
        }
      }
    };
    
    autoLoad();
  }, [loadFromStorage]);

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
