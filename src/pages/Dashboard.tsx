/**
 * Dashboard Page
 * Main application interface
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, FileText, Building2, Wallet, TrendingUp, Settings, Download, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DangerMeter } from '@/components/DangerMeter';
import { useStore } from '@/stores/useStore';
import { hasSavedData } from '@/utils/storage';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear, getRecentTaxYears } from '@/lib/taxYear';

export function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | 'family'>('family');
  
  const entities = useStore((state) => state.entities);
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const incomes = useStore((state) => state.incomes);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const setCurrentTaxYear = useStore((state) => state.setCurrentTaxYear);
  const saveToStorage = useStore((state) => state.saveToStorage);

  useEffect(() => {
    const checkSetup = async () => {
      const hasData = await hasSavedData();
      if (!hasData && entities.length === 0) {
        setNeedsSetup(true);
        navigate('/setup');
      }
      setIsLoading(false);
    };
    checkSetup();
  }, [entities.length, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (needsSetup) {
    return null;
  }

  // Filter data based on selected entity
  const filteredAssets = selectedEntityId === 'family' 
    ? assets 
    : assets.filter((a) => {
        // Include assets owned directly by this entity
        if (a.ownerId === selectedEntityId) return true;
        // Include assets with joint ownership where this entity has a share
        if (a.ownershipShares && a.ownershipShares.some((s) => s.entityId === selectedEntityId)) return true;
        return false;
      });
  
  const filteredLiabilities = selectedEntityId === 'family'
    ? liabilities
    : liabilities.filter((l) => {
        // Include liabilities owned directly by this entity
        if (l.ownerId === selectedEntityId) return true;
        // Include liabilities with joint ownership where this entity has a share
        if (l.ownershipShares && l.ownershipShares.some((s) => s.entityId === selectedEntityId)) return true;
        return false;
      });
  
  const filteredIncomes = selectedEntityId === 'family'
    ? incomes
    : incomes.filter((i) => i.ownerId === selectedEntityId);

  const totalAssetValue = filteredAssets
    .filter((a) => !a.disposed)
    .reduce((sum, a) => {
      // For individual view, calculate based on ownership percentage
      if (selectedEntityId !== 'family' && a.ownershipShares && a.ownershipShares.length > 0) {
        const ownershipShare = a.ownershipShares.find((s) => s.entityId === selectedEntityId);
        if (ownershipShare) {
          return sum + (a.financials.marketValue * ownershipShare.percentage / 100);
        }
        return sum;
      }
      // For family view or single owner, use full value
      return sum + a.financials.marketValue;
    }, 0);

  const totalLiabilities = filteredLiabilities.reduce((sum, l) => {
    // For individual view, calculate based on ownership percentage
    if (selectedEntityId !== 'family' && l.ownershipShares && l.ownershipShares.length > 0) {
      const ownershipShare = l.ownershipShares.find((s) => s.entityId === selectedEntityId);
      if (ownershipShare) {
        return sum + (l.currentBalance * ownershipShare.percentage / 100);
      }
      return sum;
    }
    // For family view or single owner, use full value
    return sum + l.currentBalance;
  }, 0);

  const currentYearIncome = filteredIncomes
    .filter((i) => i.taxYear === currentTaxYear)
    .reduce((sum, income) => {
      if (income.schedule === '1') {
        return sum + income.details.grossRemuneration;
      } else if (income.schedule === '2') {
        return sum + income.details.netProfit;
      } else if (income.schedule === '3') {
        return sum + income.details.grossAmount;
      }
      return sum;
    }, 0);

  const netWorth = totalAssetValue - totalLiabilities;
  
  const selectedEntity = selectedEntityId === 'family' 
    ? null 
    : entities.find((e) => e.id === selectedEntityId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">WealthGuard LK</h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-600">Tax Year:</p>
                  <select
                    className="text-sm px-2 py-1 border rounded bg-white font-medium"
                    value={currentTaxYear}
                    onChange={(e) => {
                      setCurrentTaxYear(e.target.value);
                      saveToStorage();
                    }}
                  >
                    {getRecentTaxYears(6).map((year) => (
                      <option key={year} value={year}>
                        {formatTaxYear(year)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Profile Selector */}
              {entities.length > 1 && (
                <div className="ml-4">
                  <select
                    className="px-4 py-2 border rounded-lg bg-white font-medium text-sm"
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                  >
                    <option value="family">👨‍👩‍👧‍👦 Combined Family View</option>
                    <option disabled>──────────</option>
                    {entities.map((entity, index) => (
                      <option key={entity.id} value={entity.id}>
                        {index === 0 ? '👤' : '👥'} {entity.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">
                {selectedEntityId === 'family' 
                  ? '👨‍👩‍👧‍👦 Combined Family Overview' 
                  : `${selectedEntity?.name || ''}'s Profile`}
              </h2>
              <p className="text-slate-600">
                {selectedEntityId === 'family'
                  ? `Showing combined data for ${entities.length} family member${entities.length > 1 ? 's' : ''}`
                  : `Individual taxpayer view • TIN: ${selectedEntity?.tin || 'Not Set'}`}
              </p>
            </div>
            {selectedEntityId !== 'family' && (
              <Button 
                variant="outline" 
                onClick={() => setSelectedEntityId('family')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Family View
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Assets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatLKR(totalAssetValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredAssets.filter(a => !a.disposed).length} items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Liabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatLKR(totalLiabilities)}</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredLiabilities.length} loans</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Net Worth</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{formatLKR(netWorth)}</p>
              <p className="text-xs text-muted-foreground mt-1">Assets - Liabilities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Income ({currentTaxYear})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{formatLKR(currentYearIncome)}</p>
              <p className="text-xs text-muted-foreground mt-1">{incomes.filter(i => i.taxYear === currentTaxYear).length} sources</p>
            </CardContent>
          </Card>
        </div>

        {/* Danger Meter */}
        <div className="mb-8">
          <DangerMeter />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/income')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Income Schedules
              </CardTitle>
              <CardDescription>Manage employment, business, and investment income</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Schedules</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/assets')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Assets & Liabilities
              </CardTitle>
              <CardDescription>Track property, vehicles, loans, and debts</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Manage Assets & Liabilities</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/tax-computation')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tax Computation
              </CardTitle>
              <CardDescription>View tax calculation and reliefs</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Calculate Tax</Button>
            </CardContent>
          </Card>
        </div>

        {/* Family Members / Individual Taxpayer Cards */}
        {entities.length > 0 && selectedEntityId === 'family' && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Individual Family Member Breakdown</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                Manage Family
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {entities.map((entity, index) => {
                // Calculate stats for this specific entity
                const entityIncomes = incomes.filter((i) => i.ownerId === entity.id);
                const entityAssets = assets.filter((a) => a.ownerId === entity.id && !a.disposed);
                const entityLiabilities = liabilities.filter((l) => l.ownerId === entity.id);
                
                const entityTotalIncome = entityIncomes.reduce((sum, i) => sum + i.details.grossAmount, 0);
                const entityTotalAssets = entityAssets.reduce((sum, a) => sum + a.financials.marketValue, 0);
                const entityTotalLiabilities = entityLiabilities.reduce((sum, l) => sum + l.currentBalance, 0);
                const entityNetWorth = entityTotalAssets - entityTotalLiabilities;
                
                return (
                  <Card 
                    key={entity.id} 
                    className="border-2 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedEntityId(entity.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {index === 0 ? '👤' : '👥'} {entity.name}
                          </CardTitle>
                          <CardDescription>
                            TIN: {entity.tin || 'Not Set'} • {entity.type || 'Individual'}
                          </CardDescription>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntityId(entity.id);
                          }}
                        >
                          View →
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Total Income</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatLKR(entityTotalIncome)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Net Worth</p>
                          <p className="text-xl font-bold text-blue-600">
                            {formatLKR(entityNetWorth)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Assets</p>
                          <p className="text-lg font-semibold">
                            {formatLKR(entityTotalAssets)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Liabilities</p>
                          <p className="text-lg font-semibold text-red-600">
                            {formatLKR(entityTotalLiabilities)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Income Entries: {entityIncomes.length}</span>
                          <span>Assets: {entityAssets.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
