import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/stores/useStore';
import { formatLKR } from '@/lib/taxEngine';
import { getTaxYearsFromStart, formatTaxYear } from '@/lib/taxYear';
import { FinancialBalancePDFImportWizard } from '@/components/FinancialBalancePDFImportWizard';
import type { Asset, FinancialAssetBalance } from '@/types';

interface Props {
  asset: Asset;
  onClose: () => void;
}

export function FinancialAssetBalanceForm({ asset, onClose }: Props) {
  const updateAsset = useStore((state) => state.updateAsset);
  const entities = useStore((state) => state.entities);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [currentAsset, setCurrentAsset] = useState<Asset>(asset);
  const [selectedYear, setSelectedYear] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [interestEarned, setInterestEarned] = useState('');
  const [showImportWizard, setShowImportWizard] = useState(false);

  const taxYears = getTaxYearsFromStart(entities[0]?.taxYear || '2022');

  useEffect(() => {
    setCurrentAsset(asset);
  }, [asset]);

  // Get opening balance for a tax year
  const getOpeningBalance = (taxYear: string): number => {
    const sortedBalances = [...(currentAsset.balances || [])].sort(
      (a, b) => a.taxYear.localeCompare(b.taxYear)
    );
    
    const currentYearIndex = sortedBalances.findIndex((b) => b.taxYear === taxYear);
    
    if (currentYearIndex === -1) {
      // No balance for this year yet, check for previous year
      const previousYears = sortedBalances.filter((b) => b.taxYear < taxYear);
      if (previousYears.length > 0) {
        return previousYears[previousYears.length - 1].closingBalance;
      }
      // No previous year, use the initial market value (acquisition value)
      return currentAsset.financials.marketValue;
    }
    
    return currentYearIndex === 0
      ? currentAsset.financials.marketValue
      : sortedBalances[currentYearIndex - 1].closingBalance;
  };

  const handleAddBalance = async () => {
    if (!selectedYear || !closingBalance) {
      alert('Please select a tax year and enter closing balance');
      return;
    }

    // Check if balance already exists for this year
    const existingBalance = currentAsset.balances?.find(
      (b) => b.taxYear === selectedYear
    );

    if (existingBalance) {
      alert('Balance already recorded for this tax year. Please delete it first to re-record.');
      return;
    }

    const newBalance: FinancialAssetBalance = {
      id: crypto.randomUUID(),
      taxYear: selectedYear,
      closingBalance: parseFloat(closingBalance),
      interestEarned: (asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') ? (parseFloat(interestEarned) || 0) : 0,
    };

    const updatedAsset: Asset = {
      ...currentAsset,
      balances: [...(currentAsset.balances || []), newBalance].sort(
        (a, b) => a.taxYear.localeCompare(b.taxYear)
      ),
    };

    // Update market value to latest closing balance
    const latestBalance = [...updatedAsset.balances!].sort(
      (a, b) => b.taxYear.localeCompare(a.taxYear)
    )[0];
    updatedAsset.financials.marketValue = latestBalance.closingBalance;

    updateAsset(updatedAsset.id, updatedAsset);
    setCurrentAsset(updatedAsset);
    await saveToStorage();

    // Reset form
    setSelectedYear('');
    setClosingBalance('');
    setInterestEarned('');
  };

  const handleDeleteBalance = async (balanceId: string) => {
    if (!confirm('Are you sure you want to delete this balance record?')) {
      return;
    }

    const updatedAsset: Asset = {
      ...currentAsset,
      balances: currentAsset.balances?.filter((b) => b.id !== balanceId) || [],
    };

    updateAsset(updatedAsset.id, updatedAsset);
    setCurrentAsset(updatedAsset);
    await saveToStorage();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b sticky top-0 bg-white z-10">
          <CardTitle className="text-2xl">
            {asset.cageCategory === 'Bii' ? 'Financial Asset Balances' :
             asset.cageCategory === 'Biv' ? 'Cash Balance History' :
             asset.cageCategory === 'Bv' ? 'Loan Balance History' :
             'Asset Balances'} - {asset.meta.description}
            {asset.closed && (
              <span className="ml-2 text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-normal">
                CLOSED - READ ONLY
              </span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Add Balance Form */}
          {!asset.closed && (
            <div className="bg-blue-50 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Record Balance for Tax Year
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImportWizard(true)}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import from PDF
                </Button>
              </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tax Year *</Label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Tax Year</option>
                  {taxYears.map((year) => (
                    <option key={year} value={year}>
                      {formatTaxYear(year)}
                    </option>
                  ))}
                </select>
                {selectedYear && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Opening Balance: {formatLKR(getOpeningBalance(selectedYear))}
                  </p>
                )}
              </div>

              <div>
                <Label>
                  {asset.cageCategory === 'Bii' ? 'Closing Balance (as of March 31)' :
                   asset.cageCategory === 'Biv' ? 'Cash Amount (as of March 31)' :
                   asset.cageCategory === 'Bv' ? 'Outstanding Loan Amount (as of March 31)' :
                   'Closing Balance (as of March 31)'} *
                </Label>
                <Input
                  type="number"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {(asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') && (
                <div className="col-span-2">
                  <Label>Interest Earned</Label>
                  <Input
                    type="number"
                    value={interestEarned}
                    onChange={(e) => setInterestEarned(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {asset.cageCategory === 'Bii' && 'Total interest income earned during the tax year'}
                    {asset.cageCategory === 'Biv' && 'Total interest or income earned on cash holdings during the tax year'}
                    {asset.cageCategory === 'Bv' && 'Total interest earned on loans given during the tax year'}
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleAddBalance} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Balance Record
            </Button>
          </div>
          )}

          {/* Closed Account Notice */}
          {asset.closed && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800">
                <strong>Account Closed:</strong> This account was closed on {new Date(asset.closed.date).toLocaleDateString()}. 
                Balance records are read-only. To add new records, reopen the account from the edit page.
              </p>
            </div>
          )}

          {/* Balance History */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Balance History</h3>
            {!currentAsset.balances || currentAsset.balances.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No balance records yet. Add your first record above.
              </p>
            ) : (
              <div className="space-y-3">
                {currentAsset.balances
                  .slice()
                  .reverse()
                  .map((balance) => {
                    const openingBal = getOpeningBalance(balance.taxYear);
                    return (
                      <Card key={balance.id} className="bg-gray-50">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className={`flex-1 grid gap-4 ${(asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') ? 'grid-cols-4' : 'grid-cols-3'}`}>
                              <div>
                                <p className="text-sm font-semibold text-blue-600">
                                  {formatTaxYear(balance.taxYear)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Tax Year
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-semibold">
                                  {formatLKR(openingBal)}
                                </p>
                                <p className="text-xs text-muted-foreground">Opening</p>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-green-600">
                                  {formatLKR(balance.closingBalance)}
                                </p>
                                <p className="text-xs text-muted-foreground">Closing</p>
                              </div>
                              {(asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') && (
                                <div>
                                  <p className="text-sm font-semibold text-purple-600">
                                    {formatLKR(balance.interestEarned)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {asset.cageCategory === 'Bii' && 'Interest'}
                                    {asset.cageCategory === 'Biv' && 'Interest'}
                                    {asset.cageCategory === 'Bv' && 'Interest Income'}
                                  </p>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBalance(balance.id)}
                              disabled={asset.closed}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title={asset.closed ? 'Cannot delete - account is closed' : 'Delete this record'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Summary */}
          {currentAsset.balances && currentAsset.balances.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {(asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') && (
                  <div>
                    <span className="text-muted-foreground">Total Interest Earned:</span>
                    <p className="font-bold text-lg text-green-600">
                      {formatLKR(
                        currentAsset.balances.reduce(
                          (sum, b) => sum + b.interestEarned,
                          0
                        )
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">
                    {asset.cageCategory === 'Bii' ? 'Latest Balance:' :
                     asset.cageCategory === 'Biv' ? 'Latest Cash Amount:' :
                     asset.cageCategory === 'Bv' ? 'Latest Loan Amount:' :
                     'Latest Balance:'}
                  </span>
                  <p className="font-bold text-lg text-blue-600">
                    {formatLKR(
                      currentAsset.balances[currentAsset.balances.length - 1]
                        .closingBalance
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Import Wizard */}
      <FinancialBalancePDFImportWizard
        open={showImportWizard}
        onClose={() => {
          setShowImportWizard(false);
          // Refresh the asset data after import
          const updatedAsset = useStore.getState().assets.find(a => a.id === asset.id);
          if (updatedAsset) {
            setCurrentAsset(updatedAsset);
          }
        }}
        preSelectedAssetId={asset.id}
      />
    </div>
  );
}
