/**
 * Dashboard Page
 * Main application interface
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Building2, Wallet, Settings, ArrowLeft, Upload, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DangerMeter } from '@/components/DangerMeter';
import { PDFImportWizard } from '@/components/PDFImportWizard';
import { useStore } from '@/stores/useStore';
import { hasSavedData } from '@/utils/storage';
import { formatLKR, filterAssetsForTaxYear, calculateTotalIncome, getJewelleryMarketValue, getForeignCurrencyMarketValue } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart, getTaxYearDateRange } from '@/lib/taxYear';
import { downloadDetailedTaxReport, downloadDetailedTaxReportPDF } from '@/utils/export';

export function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | 'family'>('family');
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'pdf'>('pdf');
  const [downloadEntityId, setDownloadEntityId] = useState<string>('');
  const [downloadTaxYear, setDownloadTaxYear] = useState<string>('');
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
    // For foreign currency deposits, calculate market value in LKR
    if (asset.cageCategory === 'Bii' && asset.meta.currency && asset.meta.currency !== 'LKR') {
      return getForeignCurrencyMarketValue(asset, currentTaxYear);
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
    setDownloadFormat(format);
    // Set default entity (use primary entity if family view is selected)
    const defaultEntity = selectedEntityId === 'family' 
      ? entities[0]?.id || '' 
      : selectedEntityId;
    setDownloadEntityId(defaultEntity);
    setDownloadTaxYear(currentTaxYear);
    setShowReportMenu(false);
    setShowDownloadDialog(true);
  };

  const handleConfirmDownload = () => {
    const isFamily = downloadEntityId === 'family';
    const entityId = isFamily ? undefined : downloadEntityId;
    
    if (downloadFormat === 'pdf') {
      downloadDetailedTaxReportPDF(
        entities,
        incomes,
        assets,
        liabilities,
        certificates,
        downloadTaxYear,
        isFamily,
        entityId
      );
    } else {
      downloadDetailedTaxReport(
        entities,
        incomes,
        assets,
        liabilities,
        certificates,
        downloadTaxYear,
        isFamily,
        entityId
      );
    }
    setShowDownloadDialog(false);
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
              <a
                href="https://github.com/jeradasanka/WealthGuardLK"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-slate-700 transition-colors h-9 w-9"
                title="Contribute on GitHub"
              >
                <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
              </a>
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
          <DangerMeter selectedEntityId={selectedEntityId} />
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

        {/* GitHub Contribution Call to Action */}
        <div className="mt-12 border-t pt-8 pb-4 text-center">
          <div className="bg-slate-100/80 rounded-2xl p-6 max-w-2xl mx-auto border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <h3 className="text-lg font-bold text-slate-900">Want to help improve WealthGuard LK?</h3>
              <p className="text-sm text-slate-600 mt-1">
                This is an open-source project. Contribute features, fix bugs, or suggest improvements on GitHub!
              </p>
            </div>
            <a 
              href="https://github.com/jeradasanka/WealthGuardLK" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow transition-colors w-full md:w-auto"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              Contribute on GitHub
            </a>
          </div>
          <p className="text-xs text-slate-500 mt-6">
            Built with ❤️ for Sri Lankan taxpayers. All data is processed client-side.
          </p>
        </div>
      </main>

      {/* PDF Import Wizard */}
      <PDFImportWizard 
        open={showImportWizard} 
        onClose={() => setShowImportWizard(false)} 
      />

      {/* Tax Report Download Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Download Tax Report</DialogTitle>
            <DialogDescription>
              Select the entity and tax year for the tax report. Format: {downloadFormat.toUpperCase()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-entity">Entity</Label>
              <select
                id="report-entity"
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={downloadEntityId}
                onChange={(e) => setDownloadEntityId(e.target.value)}
              >
                {entities.length > 1 && (
                  <option value="family">👨‍👩‍👧‍👦 Combined Family Return</option>
                )}
                {entities.map((entity, index) => (
                  <option key={entity.id} value={entity.id}>
                    {index === 0 ? '👤' : '👥'} {entity.name} {entity.tin ? `(TIN: ${entity.tin})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-year">Tax Year</Label>
              <select
                id="report-year"
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={downloadTaxYear}
                onChange={(e) => setDownloadTaxYear(e.target.value)}
              >
                {getTaxYearsFromStart(entities[0]?.taxYear || '2022').map((year) => (
                  <option key={year} value={year}>
                    {formatTaxYear(year)} (Ending: {year}-03-31)
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-blue-900">
                <strong>Report Summary:</strong>
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>• Entity: {downloadEntityId === 'family' 
                  ? 'Combined Family' 
                  : entities.find(e => e.id === downloadEntityId)?.name || 'Unknown'}
                </li>
                <li>• Tax Year: {formatTaxYear(downloadTaxYear)}</li>
                <li>• Format: {downloadFormat.toUpperCase()}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
