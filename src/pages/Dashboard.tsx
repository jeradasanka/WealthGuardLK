/**
 * Dashboard Page
 * Main application interface
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, Wallet, Settings, ArrowLeft, Upload, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DangerMeter } from '@/components/DangerMeter';
import { PDFImportWizard } from '@/components/PDFImportWizard';
import { useStore } from '@/stores/useStore';
import { hasSavedData } from '@/utils/storage';
import { formatLKR, filterAssetsForTaxYear, calculateTotalIncome, getJewelleryMarketValue } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart, getTaxYearDateRange } from '@/lib/taxYear';
import { downloadDetailedTaxReport, downloadDetailedTaxReportPDF } from '@/utils/export';

export function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | 'family'>('family');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const reportMenuRef = useRef<HTMLDivElement>(null);
  
  const entities = useStore((state) => state.entities);
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const incomes = useStore((state) => state.incomes);
  const certificates = useStore((state) => state.certificates);
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

  // Close report menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target as Node)) {
        setShowReportMenu(false);
      }
    };

    if (showReportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReportMenu]);

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

  // Filter data based on selected entity and tax year
  const { start: taxYearStart, end: taxYearEnd } = getTaxYearDateRange(currentTaxYear);
  const taxYearEndString = `${parseInt(currentTaxYear) + 1}-03-31`;
  
  const filteredAssets = selectedEntityId === 'family' 
    ? filterAssetsForTaxYear(assets, currentTaxYear)
    : filterAssetsForTaxYear(assets, currentTaxYear).filter((a) => 
        a.ownerId === selectedEntityId || 
        (a.ownershipShares && a.ownershipShares.some((s) => s.entityId === selectedEntityId))
      );
  
  const filteredLiabilities = selectedEntityId === 'family'
    ? liabilities.filter((l) => {
        // Liability must be acquired before or during the tax year
        return l.dateAcquired <= taxYearEndString;
      })
    : liabilities.filter((l) => {
        // Liability must be acquired before or during the tax year
        if (l.dateAcquired > taxYearEndString) return false;
        
        // Include liabilities owned directly by this entity
        if (l.ownerId === selectedEntityId) return true;
        // Include liabilities with joint ownership where this entity has a share
        if (l.ownershipShares && l.ownershipShares.some((s) => s.entityId === selectedEntityId)) return true;
        return false;
      });
  
  const filteredIncomes = selectedEntityId === 'family'
    ? incomes.filter((i) => i.taxYear === currentTaxYear)
    : incomes.filter((i) => i.ownerId === selectedEntityId && i.taxYear === currentTaxYear);

  // Helper function to get display value for an asset (same as AssetsPage)
  const getAssetDisplayValue = (asset: any): number => {
    // For immovable properties with expenses, use latest market value if available
    if (asset.cageCategory === 'A' && asset.propertyExpenses && asset.propertyExpenses.length > 0) {
      const sortedExpenses = [...asset.propertyExpenses].sort((a: any, b: any) => b.taxYear.localeCompare(a.taxYear));
      const latestExpense = sortedExpenses[0];
      if (latestExpense.marketValue && latestExpense.marketValue > 0) {
        return latestExpense.marketValue;
      }
    }
    // For jewellery, calculate market value based on price appreciation
    if (asset.cageCategory === 'Bvi') {
      return getJewelleryMarketValue(asset, currentTaxYear);
    }
    // Otherwise use the asset's market value
    return asset.financials.marketValue;
  };

  const totalAssetValue = filteredAssets
    .filter((a) => {
      const isDisposedBeforeYearEnd = a.disposed && a.disposed.date && a.disposed.date <= taxYearEndString;
      const isClosedBeforeYearEnd = a.closed && a.closed.date && a.closed.date <= taxYearEndString;
      return !isDisposedBeforeYearEnd && !isClosedBeforeYearEnd;
    })
    .reduce((sum, a) => {
      const assetValue = getAssetDisplayValue(a);
      
      // For individual view, calculate based on ownership percentage
      if (selectedEntityId !== 'family' && a.ownershipShares && a.ownershipShares.length > 0) {
        const ownershipShare = a.ownershipShares.find((s) => s.entityId === selectedEntityId);
        if (ownershipShare) {
          return sum + (assetValue * ownershipShare.percentage / 100);
        }
        return sum;
      }
      // For family view or single owner, use full value
      return sum + assetValue;
    }, 0);
  
  // Calculate total cost of assets (including property expenses)
  const totalAssetCost = filteredAssets
    .filter((a) => {
      const isDisposedBeforeYearEnd = a.disposed && a.disposed.date && a.disposed.date <= taxYearEndString;
      const isClosedBeforeYearEnd = a.closed && a.closed.date && a.closed.date <= taxYearEndString;
      return !isDisposedBeforeYearEnd && !isClosedBeforeYearEnd;
    })
    .reduce((sum, a) => {
      let cost = a.financials.cost;
      // Add property expenses to the cost
      if (a.cageCategory === 'A' && a.propertyExpenses && a.propertyExpenses.length > 0) {
        const totalExpenses = a.propertyExpenses.reduce((expSum: number, e: any) => expSum + e.amount, 0);
        cost += totalExpenses;
      }
      
      // For individual view, calculate based on ownership percentage
      if (selectedEntityId !== 'family' && a.ownershipShares && a.ownershipShares.length > 0) {
        const ownershipShare = a.ownershipShares.find((s) => s.entityId === selectedEntityId);
        if (ownershipShare) {
          return sum + (cost * ownershipShare.percentage / 100);
        }
        return sum;
      }
      // For family view or single owner, use full cost
      return sum + cost;
    }, 0);

  const totalLiabilities = filteredLiabilities.reduce((sum, l) => {
    // Calculate balance as of the end of the selected tax year
    let balanceAtYearEnd = l.originalAmount;
    
    // Subtract all payments made up to and including the selected tax year
    if (l.payments && l.payments.length > 0) {
      const paymentsUpToYear = l.payments.filter(p => p.taxYear <= parseInt(currentTaxYear));
      const totalPrincipalPaid = paymentsUpToYear.reduce((total, p) => total + p.principalPaid, 0);
      balanceAtYearEnd = l.originalAmount - totalPrincipalPaid;
    }
    
    // For individual view, calculate based on ownership percentage
    if (selectedEntityId !== 'family' && l.ownershipShares && l.ownershipShares.length > 0) {
      const ownershipShare = l.ownershipShares.find((s) => s.entityId === selectedEntityId);
      if (ownershipShare) {
        return sum + (balanceAtYearEnd * ownershipShare.percentage / 100);
      }
      return sum;
    }
    // For family view or single owner, use full value
    return sum + balanceAtYearEnd;
  }, 0);

  const incomeSummary = calculateTotalIncome(
    filteredIncomes.filter((i) => i.taxYear === currentTaxYear),
    filteredAssets,
    currentTaxYear
  );
  const currentYearIncome = incomeSummary.totalIncome;

  const netWorth = totalAssetValue - totalLiabilities;
  
  const selectedEntity = selectedEntityId === 'family' 
    ? null 
    : entities.find((e) => e.id === selectedEntityId);

  const handleDownloadTaxReport = (format: 'txt' | 'pdf') => {
    if (format === 'pdf') {
      downloadDetailedTaxReportPDF(
        entities,
        incomes,
        assets,
        liabilities,
        certificates,
        currentTaxYear,
        selectedEntityId === 'family',
        selectedEntityId === 'family' ? undefined : selectedEntityId
      );
    } else {
      downloadDetailedTaxReport(
        entities,
        incomes,
        assets,
        liabilities,
        certificates,
        currentTaxYear,
        selectedEntityId === 'family',
        selectedEntityId === 'family' ? undefined : selectedEntityId
      );
    }
    setShowReportMenu(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/icon.png" alt="WealthGuard LK Logo" className="w-8 h-8" />
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
                    {getTaxYearsFromStart(entities[0]?.taxYear || '2022').map((year) => (
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
              <Button variant="outline" size="sm" onClick={() => setShowImportWizard(true)}>
                <Upload className="w-4 h-4 mr-2" />
                {useStore.getState().useAiParsing ? 'Import PDF (AI)' : 'Import PDF'}
              </Button>
              <div className="relative" ref={reportMenuRef}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowReportMenu(!showReportMenu)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Tax Report
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
                {showReportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-50">
                    <button
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                      onClick={() => handleDownloadTaxReport('pdf')}
                    >
                      <FileText className="w-4 h-4" />
                      Download as PDF
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 border-t"
                      onClick={() => handleDownloadTaxReport('txt')}
                    >
                      <FileText className="w-4 h-4" />
                      Download as Text
                    </button>
                  </div>
                )}
              </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Assets Cost</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{formatLKR(totalAssetCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">Cost + property expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Assets Market Value</CardDescription>
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
              <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatLKR(netWorth)}</p>
              <p className="text-xs text-muted-foreground mt-1">Market Value - Liabilities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Income</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{formatLKR(currentYearIncome)}</p>
              <p className="text-xs text-muted-foreground mt-1">{incomes.filter(i => i.taxYear === currentTaxYear).length} sources</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tax Year</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-700">{formatTaxYear(currentTaxYear)}</p>
              <p className="text-xs text-muted-foreground mt-1">Current reporting period</p>
            </CardContent>
          </Card>
        </div>

        {/* Danger Meter */}
        <div className="mb-8">
          <DangerMeter />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/certificates')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Tax Certificates
              </CardTitle>
              <CardDescription>Track APIT and WHT certificates and deductions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Certificates</Button>
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
                // Include incomes for current tax year only
                const entityIncomes = incomes.filter((i) => i.ownerId === entity.id && i.taxYear === currentTaxYear);
                
                // Include assets owned directly or with joint ownership
                const entityAssets = assets.filter((a) => {
                  if (a.disposed) return false;
                  if (a.ownerId === entity.id) return true;
                  if (a.ownershipShares && a.ownershipShares.some((s) => s.entityId === entity.id)) return true;
                  return false;
                });
                
                // Include liabilities owned directly or with joint ownership
                const entityLiabilities = liabilities.filter((l) => {
                  if (l.ownerId === entity.id) return true;
                  if (l.ownershipShares && l.ownershipShares.some((s) => s.entityId === entity.id)) return true;
                  return false;
                });
                
                const entityTotalIncome = calculateTotalIncome(entityIncomes, entityAssets, currentTaxYear).totalIncome;
                
                // Calculate assets with ownership percentage
                const entityTotalAssets = entityAssets.reduce((sum, a) => {
                  const marketValue = a.financials.marketValue || 0;
                  if (!a.ownershipShares) {
                    // Fully owned by this entity
                    return sum + marketValue;
                  } else {
                    // Jointly owned - get this entity's share
                    const ownershipShare = a.ownershipShares.find((s) => s.entityId === entity.id);
                    const percentage = ownershipShare ? ownershipShare.percentage : 0;
                    return sum + (marketValue * percentage / 100);
                  }
                }, 0);
                
                // Calculate liabilities with ownership percentage
                const entityTotalLiabilities = entityLiabilities.reduce((sum, l) => {
                  const currentBalance = l.currentBalance || 0;
                  if (!l.ownershipShares) {
                    // Fully owned by this entity
                    return sum + currentBalance;
                  } else {
                    // Jointly owned - get this entity's share
                    const ownershipShare = l.ownershipShares.find((s) => s.entityId === entity.id);
                    const percentage = ownershipShare ? ownershipShare.percentage : 0;
                    return sum + (currentBalance * percentage / 100);
                  }
                }, 0);
                
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

      {/* PDF Import Wizard */}
      <PDFImportWizard 
        open={showImportWizard} 
        onClose={() => setShowImportWizard(false)} 
      />
    </div>
  );
}
