/**
 * Assets and Liabilities Management Page
 * Manages wealth tracking (FR-05, FR-06)
 */

import { useState } from 'react';
import { Plus, Trash2, Edit, Home, Car, Wallet as WalletIcon, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { AssetForm } from '@/components/AssetForm';
import { LiabilityForm } from '@/components/LiabilityForm';
import { SourceOfFundsWizard } from '@/components/SourceOfFundsWizard';
import { formatLKR } from '@/lib/taxEngine';
import type { Asset, Liability, FundingSource } from '@/types';

type ViewMode = 'list' | 'add-asset' | 'edit-asset' | 'add-liability' | 'edit-liability' | 'source-of-funds';

export function AssetsPage() {
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const entities = useStore((state) => state.entities);
  const removeAsset = useStore((state) => state.removeAsset);
  const removeLiability = useStore((state) => state.removeLiability);
  const disposeAsset = useStore((state) => state.disposeAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [pendingAsset, setPendingAsset] = useState<Asset | null>(null);

  const activeAssets = assets.filter((a) => !a.disposed);
  const totalAssetValue = activeAssets.reduce((sum, a) => sum + a.financials.marketValue, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const netWorth = totalAssetValue - totalLiabilities;

  const getEntityName = (ownerId: string) => {
    return entities.find((e) => e.id === ownerId)?.name || 'Unknown';
  };

  const getAssetIcon = (category: string) => {
    switch (category) {
      case '701':
        return <Home className="w-5 h-5 text-blue-600" />;
      case '711':
        return <Car className="w-5 h-5 text-green-600" />;
      case '721':
        return <WalletIcon className="w-5 h-5 text-purple-600" />;
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case '701':
        return 'Property';
      case '711':
        return 'Vehicle';
      case '721':
        return 'Financial';
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
    if (salePrice && !isNaN(Number(salePrice))) {
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

  const handleFormClose = () => {
    setViewMode('list');
    setEditingAsset(null);
    setEditingLiability(null);
    setPendingAsset(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
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
                            {getCategoryLabel(asset.cageCategory)} (Cage {asset.cageCategory}) • {getEntityName(asset.ownerId)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Acquired: {new Date(asset.meta.dateAcquired).toLocaleDateString()}
                          </p>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAsset(asset)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisposeAsset(asset.id)}
                          >
                            Sell
                          </Button>
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
                              {getEntityName(liability.ownerId)} • {liability.purpose || 'General loan'}
                            </p>
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
                          </div>
                          <div className="flex flex-col gap-2">
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
