/**
 * Assets and Liabilities Management Page
 * Manages wealth tracking (FR-05, FR-06)
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Home, Car, Wallet as WalletIcon, CreditCard, ArrowLeft, DollarSign, TrendingUp, FileText, Building2, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { AssetForm } from '@/components/AssetForm';
import { LiabilityForm } from '@/components/LiabilityForm';
import { LiabilityPaymentForm } from '@/components/LiabilityPaymentForm';
import { FinancialAssetBalanceForm } from '@/components/FinancialAssetBalanceForm';
import { StockAccountBalanceForm } from '@/components/StockAccountBalanceForm';
import { PropertyExpenseForm } from '@/components/PropertyExpenseForm';
import { ValuationForm } from '@/components/ValuationForm';
import { SourceOfFundsWizard } from '@/components/SourceOfFundsWizard';
import { formatLKR, getJewelleryMarketValue, getForeignCurrencyMarketValue } from '@/lib/taxEngine';
import { getTaxYearsFromStart } from '@/lib/taxYear';
import type { Asset, Liability, FundingSource } from '@/types';

type ViewMode = 'list' | 'add-asset' | 'edit-asset' | 'add-liability' | 'edit-liability' | 'source-of-funds' | 'record-payment' | 'manage-balances' | 'manage-stock-balances' | 'manage-property-expenses' | 'manage-valuations';

export function AssetsPage() {
  const navigate = useNavigate();
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const removeAsset = useStore((state) => state.removeAsset);
  const updateLiability = useStore((state) => state.updateLiability);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [paymentLiability, setPaymentLiability] = useState<Liability | null>(null);
  const [balanceAsset, setBalanceAsset] = useState<Asset | null>(null);
  const [stockBalanceAsset, setStockBalanceAsset] = useState<Asset | null>(null);
  const [transactionAsset, setTransactionAsset] = useState<Asset | null>(null);
  const [expenseAsset, setExpenseAsset] = useState<Asset | null>(null);
  const [valuationAsset, setValuationAsset] = useState<Asset | null>(null);
  const [pendingAsset, setPendingAsset] = useState<Asset | null>(null);

  // Show all assets in the list (including sold/closed)
  const allAssets = assets;
  // Active assets for calculations (exclude disposed)
  const activeAssets = assets.filter((a) => !a.disposed);
  
  // Helper function to get display value for an asset
  const getAssetDisplayValue = (asset: Asset): number => {
    // For assets with valuations (A & Bi), use latest valuation if available
    if ((asset.cageCategory === 'A' || asset.cageCategory === 'Bi') && asset.valuations && asset.valuations.length > 0) {
      const sortedValuations = [...asset.valuations].sort((a, b) => b.taxYear.localeCompare(a.taxYear));
      const latestValuation = sortedValuations[0];
      if (latestValuation.marketValue > 0) {
        return latestValuation.marketValue;
      }
    }
    // For immovable properties with expenses, use latest market value if available
    if (asset.cageCategory === 'A' && asset.propertyExpenses && asset.propertyExpenses.length > 0) {
      const sortedExpenses = [...asset.propertyExpenses].sort((a, b) => b.taxYear.localeCompare(a.taxYear));
      const latestExpense = sortedExpenses[0];
      if (latestExpense.marketValue && latestExpense.marketValue > 0) {
        return latestExpense.marketValue;
      }
    }
    // For stock portfolios, use latest portfolio value if available
    if (asset.cageCategory === 'Biii' && asset.stockBalances && asset.stockBalances.length > 0) {
      const sortedBalances = [...asset.stockBalances].sort((a, b) => b.taxYear.localeCompare(a.taxYear));
      return sortedBalances[0].portfolioValue;
    }
    // For jewellery, calculate market value based on price appreciation
    if (asset.cageCategory === 'Bvi') {
      return getJewelleryMarketValue(asset, currentTaxYear);
    }
    // For foreign currency deposits, calculate LKR value using exchange rate
    if (asset.cageCategory === 'Bii' && asset.meta.currency && asset.meta.currency !== 'LKR') {
      return getForeignCurrencyMarketValue(asset, currentTaxYear);
    }
    // Otherwise use the asset's market value
    return asset.financials.marketValue;
  };
  
  // Calculate total value only from open assets, using latest valuations
  const totalAssetValue = assets
    .filter((a) => !a.disposed && !a.closed)
    .reduce((sum, a) => sum + getAssetDisplayValue(a), 0);
  
  // Calculate total cost of assets (including property expenses)
  const totalAssetCost = assets
    .filter((a) => !a.disposed && !a.closed)
    .reduce((sum, a) => {
      let cost = a.financials.cost;
      // Add property expenses to the cost
      if (a.cageCategory === 'A' && a.propertyExpenses && a.propertyExpenses.length > 0) {
        const totalExpenses = a.propertyExpenses.reduce((expSum, e) => expSum + e.amount, 0);
        cost += totalExpenses;
      }
      return sum + cost;
    }, 0);
    
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const netWorth = totalAssetValue - totalLiabilities;

  // Calculate net worth for each tax year
  const netWorthByYear = useMemo(() => {
    const taxYears = getTaxYearsFromStart(entities[0]?.taxYear || '2022');
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const currentTaxYear = currentMonth < 3 ? (currentYear - 1).toString() : currentYear.toString();
    
    return taxYears.map((year) => {
      const isCurrentYear = year === currentTaxYear;
      const yearEndDate = isCurrentYear ? new Date().toISOString().split('T')[0] : `${year}-03-31`;
      
      // Calculate assets value at year end (or current date for current year)
      const assetsAtYearEnd = assets
        .filter((a) => {
          const acquired = a.meta.dateAcquired <= yearEndDate;
          const notDisposed = !a.disposed || (a.disposed && a.disposed.date > yearEndDate);
          const notClosed = !a.closed || (a.closed && a.closed.date > yearEndDate);
          return acquired && notDisposed && notClosed;
        })
        .reduce((sum, a) => {
          // For current year, use the same logic as top tiles
          if (isCurrentYear) {
            return sum + getAssetDisplayValue(a);
          }
          
          // For historical years, calculate year-end values
          // For bank balances (Bii), use balance from records if available
          if (a.cageCategory === 'Bii' && a.balances && a.balances.length > 0) {
            const yearBalance = a.balances.find((b) => b.taxYear === year);
            if (yearBalance) {
              // Convert foreign currency to LKR using exchange rate index
              if (a.meta.currency && a.meta.currency !== 'LKR') {
                return sum + getForeignCurrencyMarketValue(a, year);
              }
              return sum + yearBalance.closingBalance;
            }
            // If no exact year match, use previous year's closing balance
            const previousBalances = a.balances.filter((b) => b.taxYear < year);
            if (previousBalances.length > 0) {
              const prevBalance = previousBalances[previousBalances.length - 1];
              // Convert foreign currency to LKR using exchange rate index
              if (a.meta.currency && a.meta.currency !== 'LKR') {
                return sum + getForeignCurrencyMarketValue(a, prevBalance.taxYear);
              }
              return sum + prevBalance.closingBalance;
            }
          }
          
          // For cash in hand (Biv) and loans given (Bv), use balance from records if available (always in LKR)
          if ((a.cageCategory === 'Biv' || a.cageCategory === 'Bv') && a.balances && a.balances.length > 0) {
            const yearBalance = a.balances.find((b) => b.taxYear === year);
            if (yearBalance) {
              return sum + yearBalance.closingBalance;
            }
            // If no exact year match, use previous year's closing balance
            const previousBalances = a.balances.filter((b) => b.taxYear < year);
            if (previousBalances.length > 0) {
              return sum + previousBalances[previousBalances.length - 1].closingBalance;
            }
          }
          
          // For immovable properties, use market value from expense records if available
          if (a.cageCategory === 'A' && a.propertyExpenses && a.propertyExpenses.length > 0) {
            // Get expenses up to this year
            const expensesUpToYear = a.propertyExpenses
              .filter((e) => e.taxYear <= year)
              .sort((x, y) => y.taxYear.localeCompare(x.taxYear));
            
            if (expensesUpToYear.length > 0 && expensesUpToYear[0].marketValue && expensesUpToYear[0].marketValue > 0) {
              return sum + expensesUpToYear[0].marketValue;
            }
          }
          
          // For jewellery (Bvi), calculate market value using appreciation
          if (a.cageCategory === 'Bvi') {
            return sum + getJewelleryMarketValue(a, year);
          }
          
          return sum + a.financials.marketValue;
        }, 0);
      
      // Calculate liabilities balance at year end
      const liabilitiesAtYearEnd = liabilities
        .filter((l) => l.dateAcquired <= yearEndDate)
        .reduce((sum, l) => {
          // Calculate balance at year end
          const paymentsUpToYear = l.payments
            ?.filter((p) => p.taxYear <= year)
            .reduce((total, p) => total + p.principalPaid, 0) || 0;
          const balance = l.originalAmount - paymentsUpToYear;
          return sum + Math.max(0, balance);
        }, 0);
      
      return {
        year,
        assets: assetsAtYearEnd,
        liabilities: liabilitiesAtYearEnd,
        netWorth: assetsAtYearEnd - liabilitiesAtYearEnd,
      };
    });
  }, [assets, liabilities, entities]);

  const getEntityName = (ownerId: string) => {
    return entities.find((e) => e.id === ownerId)?.name || 'Unknown';
  };

  const getAssetIcon = (category: string) => {
    switch (category) {
      case 'A':
        return <Home className="w-5 h-5 text-blue-600" />;
      case 'Bi':
        return <Car className="w-5 h-5 text-green-600" />;
      case 'Bii':
        return <WalletIcon className="w-5 h-5 text-purple-600" />;
      case 'Biii':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'Biv':
        return <WalletIcon className="w-5 h-5 text-yellow-600" />;
      case 'Bv':
        return <FileText className="w-5 h-5 text-orange-600" />;
      case 'Bvi':
        return <Gem className="w-5 h-5 text-amber-600" />;
      case 'C':
        return <Building2 className="w-5 h-5 text-indigo-600" />;
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'A':
        return 'Property';
      case 'Bi':
        return 'Vehicle';
      case 'Bii':
        return 'Bank/Deposit';
      case 'Biii':
        return 'Shares/Stock';
      case 'Biv':
        return 'Cash';
      case 'Bv':
        return 'Loan Given';
      case 'Bvi':
        return 'Jewellery';
      case 'C':
        return 'Business';
      default:
        return 'Asset';
    }
  };

  const getFullCategoryLabel = (category: string) => {
    switch (category) {
      case 'A':
        return 'Immovable Properties';
      case 'Bi':
        return 'Motor Vehicles';
      case 'Bii':
        return 'Bank Balances / Term Deposits';
      case 'Biii':
        return 'Shares/Stocks/Securities';
      case 'Biv':
        return 'Cash in Hand';
      case 'Bv':
        return 'Loans Given & Amount Receivable';
      case 'Bvi':
        return 'Gold, Silver, Gems, Jewellery';
      case 'C':
        return 'Properties Held as Part of Business';
      default:
        return 'Assets';
    }
  };

  // Group assets by category
  const groupAssetsByCategory = () => {
    const categories = ['A', 'Bi', 'Bii', 'Biii', 'Biv', 'Bv', 'Bvi', 'C'];
    const grouped: Record<string, Asset[]> = {};
    
    categories.forEach(category => {
      const assetsInCategory = allAssets.filter(asset => asset.cageCategory === category);
      if (assetsInCategory.length > 0) {
        grouped[category] = assetsInCategory;
      }
    });
    
    return grouped;
  };

  const assetsByCategory = groupAssetsByCategory();

  const handleDeleteAsset = async (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      removeAsset(id);
      await saveToStorage();
    }
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setViewMode('edit-asset');
  };

  const handleEditLiability = (liability: Liability) => {
    setEditingLiability(liability);
    setViewMode('edit-liability');
  };

  const handleRecordPayment = (liability: Liability) => {
    setPaymentLiability(liability);
    setViewMode('record-payment');
  };

  const handlePaymentSave = async (updatedLiability: Liability) => {
    updateLiability(updatedLiability.id, updatedLiability);
    await saveToStorage();
  };

  const handleFormClose = () => {
    setViewMode('list');
    setEditingAsset(null);
    setEditingLiability(null);
    setBalanceAsset(null);
    setStockBalanceAsset(null);
    setPendingAsset(null);
  };

  const handleManageBalances = (asset: Asset) => {
    setBalanceAsset(asset);
    setViewMode('manage-balances');
  };

  const handleManageStockBalances = (asset: Asset) => {
    setStockBalanceAsset(asset);
    setViewMode('manage-stock-balances');
  };

  const handleAssetSaveWithFunding = (asset: Asset) => {
    // Prompt for source of funds if asset cost > 500k
    if (asset.financials.cost > 500000) {
      setPendingAsset(asset);
      setViewMode('source-of-funds');
    } else {
      handleFormClose();
    }
  };

  const handleFundingComplete = (fundingSources: FundingSource[]) => {
    if (pendingAsset) {
      const assetWithFunding = {
        ...pendingAsset,
        fundingSources,
      };
      // Update asset in store with funding sources
      useStore.getState().updateAsset(assetWithFunding.id, { fundingSources });
      saveToStorage();
    }
    handleFormClose();
  };

  if (viewMode === 'source-of-funds' && pendingAsset) {
    return (
      <SourceOfFundsWizard
        asset={pendingAsset}
        onComplete={handleFundingComplete}
        onCancel={handleFormClose}
      />
    );
  }

  if (viewMode === 'manage-balances' && balanceAsset) {
    return <FinancialAssetBalanceForm asset={balanceAsset} onClose={handleFormClose} />;
  }

  if (viewMode === 'manage-stock-balances' && stockBalanceAsset) {
    return <StockAccountBalanceForm asset={stockBalanceAsset} onClose={handleFormClose} />;
  }

  if (viewMode === 'manage-property-expenses' && expenseAsset) {
    return <PropertyExpenseForm asset={expenseAsset} onClose={handleFormClose} />;
  }

  if (viewMode === 'manage-valuations' && valuationAsset) {
    return <ValuationForm asset={valuationAsset} onClose={handleFormClose} />;
  }

  if (viewMode === 'add-asset' || viewMode === 'edit-asset') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-3xl mx-auto">
          <Button variant="outline" onClick={handleFormClose} className="mb-4">
            ← Back to Assets & Liabilities
          </Button>
          <AssetForm
            asset={editingAsset || undefined}
            onSave={handleFormClose}
            onCancel={handleFormClose}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'add-liability' || viewMode === 'edit-liability') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-3xl mx-auto">
          <Button variant="outline" onClick={handleFormClose} className="mb-4">
            ← Back to Assets & Liabilities
          </Button>
          <LiabilityForm
            liability={editingLiability || undefined}
            onSave={handleFormClose}
            onCancel={handleFormClose}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'record-payment' && paymentLiability) {
    return (
      <LiabilityPaymentForm
        liability={paymentLiability}
        onSave={handlePaymentSave}
        onClose={handleFormClose}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Assets & Liabilities</h1>
            <p className="text-muted-foreground">
              Statement of Assets and Liabilities
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
              <p className="text-xs text-muted-foreground mt-1">{allAssets.length} items ({activeAssets.length} active)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Liabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatLKR(totalLiabilities)}</p>
              <p className="text-xs text-muted-foreground mt-1">{liabilities.length} loans</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Net Worth</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatLKR(netWorth)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Market Value - Liabilities</p>
            </CardContent>
          </Card>
        </div>

        {/* Net Worth Trend Chart */}
        {netWorthByYear.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Net Worth Trend</CardTitle>
              <CardDescription>Net worth by tax year (Assets - Liabilities)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {netWorthByYear.slice().reverse().map((yearData) => {
                  const maxNetWorth = Math.max(
                    ...netWorthByYear.map((d) => Math.abs(d.netWorth)),
                    1000 // Minimum scale
                  );
                  const barWidth = maxNetWorth > 0 ? (Math.abs(yearData.netWorth) / maxNetWorth) * 100 : 0;
                  const isPositive = yearData.netWorth >= 0;

                  return (
                    <div key={yearData.year}>
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-sm w-24">{yearData.year}/{Number(yearData.year) + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="h-10 bg-gray-100 rounded-lg overflow-hidden relative">
                            <div
                              className={`absolute top-0 left-0 h-full transition-all duration-300 flex items-center px-3 ${
                                isPositive
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                  : 'bg-gradient-to-r from-red-500 to-red-600'
                              }`}
                              style={{ width: `${Math.max(barWidth, 5)}%` }}
                            >
                              {barWidth > 20 && (
                                <span className="text-xs text-white font-semibold">
                                  {formatLKR(yearData.netWorth)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                            <span>Assets: {formatLKR(yearData.assets)}</span>
                            <span>Liabilities: {formatLKR(yearData.liabilities)}</span>
                          </div>
                        </div>
                        <div className="text-right w-32">
                          <span
                            className={`font-bold text-sm ${
                              isPositive ? 'text-blue-600' : 'text-red-600'
                            }`}
                          >
                            {formatLKR(yearData.netWorth)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground border-t pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded"></div>
                  <span>Positive Net Worth</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-r from-red-500 to-red-600 rounded"></div>
                  <span>Negative Net Worth</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assets Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Assets</h2>
            <Button onClick={() => setViewMode('add-asset')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Asset
            </Button>
          </div>

          {allAssets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No assets recorded. Click "Add Asset" to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(assetsByCategory).map(([category, assets]) => (
                <div key={category} className="space-y-3">
                  {/* Category Header */}
                  <div className="flex items-center gap-3 pb-2 border-b-2 border-blue-200">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {getAssetIcon(category)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900">
                        {getFullCategoryLabel(category)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Cage {category} • {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-sm font-semibold text-green-700">
                        Total: {formatLKR(assets.filter(a => !a.closed && !a.disposed).reduce((sum, a) => sum + getAssetDisplayValue(a), 0))}
                      </p>
                    </div>
                  </div>

                  {/* Assets in this category */}
                  <div className="space-y-3 pl-4">
                    {assets.map((asset) => (
                <Card key={asset.id} className={(asset.closed || asset.disposed) ? 'opacity-60 bg-gray-50' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          {getAssetIcon(asset.cageCategory)}
                        </div>
                        <div>
                          <p className="font-semibold">
                            {asset.meta.description}
                            {asset.closed && (
                              <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-normal">
                                CLOSED
                              </span>
                            )}
                            {asset.disposed && (
                              <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-normal">
                                SOLD
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getCategoryLabel(asset.cageCategory)} (Cage {asset.cageCategory})
                            {asset.ownershipShares && asset.ownershipShares.length > 0 ? (
                              <span> • Joint Ownership</span>
                            ) : (
                              <span> • {getEntityName(asset.ownerId)}</span>
                            )}
                          </p>
                          {asset.ownershipShares && asset.ownershipShares.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {asset.ownershipShares.map((share) => {
                                const entity = entities.find((e) => e.id === share.entityId);
                                return `${entity?.name}: ${share.percentage.toFixed(1)}%`;
                              }).join(' • ')}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Acquired: {new Date(asset.meta.dateAcquired).toLocaleDateString()}
                            {asset.closed && (
                              <span className="text-orange-600 ml-2">
                                • Closed: {new Date(asset.closed.date).toLocaleDateString()}
                              </span>
                            )}
                            {asset.disposed && (
                              <span className="text-red-600 ml-2">
                                • Sold: {new Date(asset.disposed.date).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                          {asset.cageCategory === 'Biii' && asset.stockBalances && asset.stockBalances.length > 0 && (
                            <p className="text-xs text-emerald-600 mt-1 font-medium">
                              {asset.stockBalances.length} balance record{asset.stockBalances.length > 1 ? 's' : ''}
                              <> •{' '}
                                Total dividends: {formatLKR(asset.stockBalances.reduce((sum, b) => sum + b.dividends, 0))}
                              </>
                            </p>
                          )}
                          {(asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') && asset.balances && asset.balances.length > 0 && (
                            <p className="text-xs text-purple-600 mt-1 font-medium">
                              {asset.balances.length} balance record{asset.balances.length > 1 ? 's' : ''}
                              {asset.cageCategory === 'Bii' && (
                                <> •{' '}
                                  Total interest: {
                                    asset.meta.currency && asset.meta.currency !== 'LKR'
                                      ? `${asset.balances.reduce((sum, b) => sum + b.interestEarned, 0).toFixed(2)} ${asset.meta.currency}`
                                      : formatLKR(asset.balances.reduce((sum, b) => sum + b.interestEarned, 0))
                                  }
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {asset.cageCategory === 'A' ? (() => {
                            const hasExpenses = asset.propertyExpenses && asset.propertyExpenses.length > 0;
                            
                            if (hasExpenses) {
                              const sortedExpenses = [...asset.propertyExpenses!].sort((a, b) => b.taxYear.localeCompare(a.taxYear));
                              const latestExpense = sortedExpenses[0];
                              const hasLatestValuation = latestExpense.marketValue && latestExpense.marketValue > 0;
                              
                              return (
                                <>
                                  <p className="text-sm text-muted-foreground">
                                    Latest Market Value {hasLatestValuation && `(${latestExpense.taxYear}/${parseInt(latestExpense.taxYear) + 1})`}
                                  </p>
                                  <p className="font-bold text-lg text-green-600">
                                    {formatLKR(hasLatestValuation ? latestExpense.marketValue! : asset.financials.marketValue)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Initial Cost: {formatLKR(asset.financials.cost)}
                                  </p>
                                  <p className="text-xs text-orange-600 font-medium mt-1">
                                    Total Expenses: {formatLKR(asset.propertyExpenses!.reduce((sum, e) => sum + e.amount, 0))}
                                  </p>
                                </>
                              );
                            } else {
                              // No expense records - show as Latest Market Value from edit page
                              return (
                                <>
                                  <p className="text-sm text-muted-foreground">Latest Market Value</p>
                                  <p className="font-bold text-lg text-green-600">
                                    {formatLKR(asset.financials.marketValue)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Initial Cost: {formatLKR(asset.financials.cost)}
                                  </p>
                                </>
                              );
                            }
                          })() : asset.cageCategory === 'Biii' ? (() => {
                            const hasBalances = asset.stockBalances && asset.stockBalances.length > 0;
                            
                            if (hasBalances) {
                              const sortedBalances = [...asset.stockBalances!].sort((a, b) => b.taxYear.localeCompare(a.taxYear));
                              const latestBalance = sortedBalances[0];
                              const totalPurchases = asset.stockBalances!.reduce((sum, b) => sum + b.purchases, 0);
                              const totalDividends = asset.stockBalances!.reduce((sum, b) => sum + b.dividends, 0);
                              const netInvestment = asset.financials.cost + totalPurchases;
                              const unrealizedGain = latestBalance.portfolioValue - netInvestment;
                              
                              return (
                                <>
                                  <p className="text-sm text-muted-foreground">
                                    Portfolio Value ({latestBalance.taxYear}/{Number(latestBalance.taxYear) + 1})
                                  </p>
                                  <p className="font-bold text-lg text-emerald-600">
                                    {formatLKR(latestBalance.portfolioValue)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Initial Investment: {formatLKR(asset.financials.cost)}
                                  </p>
                                  <div className="flex gap-3 mt-1">
                                    <p className={`text-xs font-medium ${unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      Gain: {formatLKR(unrealizedGain)}
                                    </p>
                                    <p className="text-xs text-purple-600 font-medium">
                                      Dividends: {formatLKR(totalDividends)}
                                    </p>
                                  </div>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <p className="text-sm text-muted-foreground">Initial Investment</p>
                                  <p className="font-bold text-lg text-emerald-600">
                                    {formatLKR(asset.financials.cost)}
                                  </p>
                                  <p className="text-xs text-orange-600 mt-1">
                                    📊 Add balance records to track portfolio
                                  </p>
                                </>
                              );
                            }
                          })() : (
                            <>
                              <p className="text-sm text-muted-foreground">
                                {asset.cageCategory === 'Bvi' ? 'Calculated Market Value' : 'Market Value'}
                              </p>
                              <p className="font-bold text-lg text-green-600">
                                {formatLKR(getAssetDisplayValue(asset))}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {asset.cageCategory === 'Bvi' ? 'Original Cost' : 'Cost'}: {
                                  asset.cageCategory === 'Bii' && asset.meta.currency && asset.meta.currency !== 'LKR'
                                    ? `${asset.financials.cost.toFixed(2)} ${asset.meta.currency}`
                                    : formatLKR(asset.financials.cost)
                                }
                              </p>
                              {asset.cageCategory === 'Bvi' && asset.meta.itemType && (
                                <p className="text-xs text-amber-600 font-medium">
                                  {asset.meta.itemType} • Auto-valued
                                </p>
                              )}
                              {asset.cageCategory === 'Bii' && asset.meta.currency && asset.meta.currency !== 'LKR' && (
                                <p className="text-xs text-blue-600 font-medium">
                                  💱 {asset.meta.currency} • Auto-converted to LKR
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {asset.cageCategory === 'Biii' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleManageStockBalances(asset)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                              title="Manage stock portfolio, holdings, and cash transfers"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </Button>
                          )}
                          {(asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleManageBalances(asset)}
                              className="bg-purple-600 hover:bg-purple-700"
                              title={
                                asset.closed 
                                  ? 'View balance history (read-only)'
                                  : asset.cageCategory === 'Bii' ? 'Manage yearly balances and interest' :
                                    asset.cageCategory === 'Biv' ? 'Manage yearly cash balances' :
                                    'Manage yearly loan balances'
                              }
                            >
                              <TrendingUp className="w-4 h-4" />
                            </Button>
                          )}
                          {asset.cageCategory === 'A' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setExpenseAsset(asset);
                                setViewMode('manage-property-expenses');
                              }}
                              className="bg-green-600 hover:bg-green-700"
                              title="Manage yearly property expenses (repairs, construction)"
                            >
                              <Building2 className="w-4 h-4" />
                            </Button>
                          )}
                          {(asset.cageCategory === 'A' || asset.cageCategory === 'Bi') && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setValuationAsset(asset);
                                setViewMode('manage-valuations');
                              }}
                              className="bg-purple-600 hover:bg-purple-700"
                              title="Manage yearly valuations (IRD Cage compliance)"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAsset(asset)}
                            title={asset.closed ? 'Edit or reopen account' : asset.disposed ? 'Edit or mark as unsold' : 'Edit asset'}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liabilities Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Liabilities</h2>
            <Button onClick={() => setViewMode('add-liability')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Liability
            </Button>
          </div>

          {liabilities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No liabilities recorded. Click "Add Liability" if you have any loans.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {liabilities.map((liability) => {
                const repaymentProgress = liability.originalAmount > 0
                  ? ((liability.originalAmount - liability.currentBalance) / liability.originalAmount * 100).toFixed(1)
                  : 0;

                return (
                  <Card key={liability.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-orange-50 rounded-lg">
                            <CreditCard className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold">{liability.lenderName}</p>
                            <p className="text-sm text-muted-foreground">
                              {liability.ownershipShares && liability.ownershipShares.length > 0 ? (
                                <span>Joint Liability</span>
                              ) : (
                                <span>{getEntityName(liability.ownerId)}</span>
                              )}
                              {' • '}{liability.purpose || 'General loan'}
                            </p>
                            {liability.ownershipShares && liability.ownershipShares.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {liability.ownershipShares.map((share) => {
                                  const entity = entities.find((e) => e.id === share.entityId);
                                  return `${entity?.name}: ${share.percentage.toFixed(1)}%`;
                                }).join(' • ')}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Acquired: {new Date(liability.dateAcquired).toLocaleDateString()}
                            </p>
                            <div className="mt-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Repayment:</span>
                                <div className="w-32 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-green-600 h-1.5 rounded-full"
                                    style={{ width: `${repaymentProgress}%` }}
                                  />
                                </div>
                                <span className="font-semibold">{repaymentProgress}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Current Balance</p>
                            <p className="font-bold text-lg text-red-600">
                              {formatLKR(liability.currentBalance)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Original: {formatLKR(liability.originalAmount)}
                            </p>
                            {liability.payments && liability.payments.length > 0 && (
                              <p className="text-xs text-green-600 mt-1">
                                {liability.payments.length} payment{liability.payments.length > 1 ? 's' : ''} recorded
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleRecordPayment(liability)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditLiability(liability)}
                              title="Edit liability"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
