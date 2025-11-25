/**
 * Assets and Liabilities Management Page
 * Manages wealth tracking (FR-05, FR-06)
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Home, Car, Wallet as WalletIcon, CreditCard, ArrowLeft, DollarSign, TrendingUp, FileText, Sparkles, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { AssetForm } from '@/components/AssetForm';
import { LiabilityForm } from '@/components/LiabilityForm';
import { LiabilityPaymentForm } from '@/components/LiabilityPaymentForm';
import { FinancialAssetBalanceForm } from '@/components/FinancialAssetBalanceForm';
import { SourceOfFundsWizard } from '@/components/SourceOfFundsWizard';
import { formatLKR } from '@/lib/taxEngine';
import { getTaxYearsFromStart } from '@/lib/taxYear';
import type { Asset, Liability, FundingSource } from '@/types';

type ViewMode = 'list' | 'add-asset' | 'edit-asset' | 'add-liability' | 'edit-liability' | 'source-of-funds' | 'record-payment' | 'manage-balances';

export function AssetsPage() {
  const navigate = useNavigate();
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const entities = useStore((state) => state.entities);
  const removeAsset = useStore((state) => state.removeAsset);
  const removeLiability = useStore((state) => state.removeLiability);
  const updateLiability = useStore((state) => state.updateLiability);
  const disposeAsset = useStore((state) => state.disposeAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [paymentLiability, setPaymentLiability] = useState<Liability | null>(null);
  const [balanceAsset, setBalanceAsset] = useState<Asset | null>(null);
  const [pendingAsset, setPendingAsset] = useState<Asset | null>(null);

  const activeAssets = assets.filter((a) => !a.disposed && !a.closed);
  const totalAssetValue = activeAssets.reduce((sum, a) => sum + a.financials.marketValue, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const netWorth = totalAssetValue - totalLiabilities;

  // Calculate net worth for each tax year
  const netWorthByYear = useMemo(() => {
    const taxYears = getTaxYearsFromStart(entities[0]?.taxYear || '2022');
    
    return taxYears.map((year) => {
      const yearEndDate = `${year}-03-31`;
      
      // Calculate assets value at year end
      const assetsAtYearEnd = assets
        .filter((a) => {
          const acquired = a.meta.dateAcquired <= yearEndDate;
          const notDisposed = !a.disposed || (a.disposed && a.disposed.date > yearEndDate);
          const notClosed = !a.closed || (a.closed && a.closed.date > yearEndDate);
          return acquired && notDisposed && notClosed;
        })
        .reduce((sum, a) => {
          // For financial assets, use balance from records if available
          if (a.cageCategory === 'Bii' && a.balances && a.balances.length > 0) {
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
        return <Sparkles className="w-5 h-5 text-amber-600" />;
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

  const handleDeleteAsset = async (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      removeAsset(id);
      await saveToStorage();
    }
  };

  const handleDisposeAsset = async (id: string) => {
    const salePrice = prompt('Enter sale price:');
    if (salePrice && !Number.isNaN(Number(salePrice))) {
      disposeAsset(id, new Date().toISOString().split('T')[0], Number(salePrice));
      await saveToStorage();
    }
  };

  const handleDeleteLiability = async (id: string) => {
    if (confirm('Are you sure you want to delete this liability?')) {
      removeLiability(id);
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
    setPendingAsset(null);
  };

  const handleManageBalances = (asset: Asset) => {
    setBalanceAsset(asset);
    setViewMode('manage-balances');
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Assets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatLKR(totalAssetValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{activeAssets.length} items</p>
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
              <p className="text-xs text-muted-foreground mt-1">Assets - Liabilities</p>
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

          {activeAssets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No assets recorded. Click "Add Asset" to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeAssets.map((asset) => (
                <Card key={asset.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          {getAssetIcon(asset.cageCategory)}
                        </div>
                        <div>
                          <p className="font-semibold">{asset.meta.description}</p>
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
                          </p>
                          {asset.cageCategory === 'Bii' && asset.balances && asset.balances.length > 0 && (
                            <p className="text-xs text-purple-600 mt-1 font-medium">
                              {asset.balances.length} balance record{asset.balances.length > 1 ? 's' : ''} •{' '}
                              Total interest: {formatLKR(
                                asset.balances.reduce((sum, b) => sum + b.interestEarned, 0)
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Market Value</p>
                          <p className="font-bold text-lg text-green-600">
                            {formatLKR(asset.financials.marketValue)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cost: {formatLKR(asset.financials.cost)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {asset.cageCategory === 'Bii' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleManageBalances(asset)}
                              className="bg-purple-600 hover:bg-purple-700"
                              title="Manage yearly balances and interest"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAsset(asset)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {asset.cageCategory !== 'Bii' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisposeAsset(asset.id)}
                            >
                              Sell
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAsset(asset.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteLiability(liability.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
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
