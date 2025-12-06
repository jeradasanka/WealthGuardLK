/**
 * Stock Account Balance Form Component
 * Manages yearly stock portfolio balances including purchases, dividends, and market value
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { getTaxYearsFromStart } from '@/lib/taxYear';
import { formatLKR } from '@/lib/taxEngine';
import type { Asset, StockBalance } from '@/types';

interface StockAccountBalanceFormProps {
  asset: Asset;
  onClose: () => void;
}

export function StockAccountBalanceForm({ asset, onClose }: StockAccountBalanceFormProps) {
  const updateAsset = useStore((state) => state.updateAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    taxYear: string;
    portfolioValue: number;
    purchases: number;
    dividends: number;
    sales: number;
    capitalGain: number;
    notes: string;
  }>({
    taxYear: currentTaxYear,
    portfolioValue: 0,
    purchases: 0,
    dividends: 0,
    sales: 0,
    capitalGain: 0,
    notes: '',
  });

  const taxYears = getTaxYearsFromStart(entities[0]?.taxYear || '2022');
  const stockBalances = asset.stockBalances || [];

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddBalance = () => {
    setFormData({
      taxYear: currentTaxYear,
      portfolioValue: 0,
      purchases: 0,
      dividends: 0,
      sales: 0,
      capitalGain: 0,
      notes: '',
    });
    setEditingId(null);
    setShowAddForm(true);
  };

  const handleEditBalance = (balance: StockBalance) => {
    setFormData({
      taxYear: balance.taxYear,
      portfolioValue: balance.portfolioValue,
      purchases: balance.purchases,
      dividends: balance.dividends,
      sales: balance.sales || 0,
      capitalGain: balance.capitalGain || 0,
      notes: balance.notes || '',
    });
    setEditingId(balance.id);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newBalance: StockBalance = {
      id: editingId || crypto.randomUUID(),
      taxYear: formData.taxYear,
      portfolioValue: formData.portfolioValue,
      purchases: formData.purchases,
      dividends: formData.dividends,
      sales: formData.sales > 0 ? formData.sales : undefined,
      capitalGain: formData.capitalGain !== 0 ? formData.capitalGain : undefined,
      notes: formData.notes || undefined,
    };

    let updatedBalances: StockBalance[];
    if (editingId) {
      updatedBalances = (asset.stockBalances || []).map((b) =>
        b.id === editingId ? newBalance : b
      );
    } else {
      updatedBalances = [...(asset.stockBalances || []), newBalance];
    }

    // Sort by tax year descending
    updatedBalances.sort((a, b) => b.taxYear.localeCompare(a.taxYear));

    updateAsset(asset.id, { stockBalances: updatedBalances });
    await saveToStorage();

    setShowAddForm(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this stock balance record?')) {
      const updatedBalances = (asset.stockBalances || []).filter((b) => b.id !== id);
      updateAsset(asset.id, { stockBalances: updatedBalances });
      await saveToStorage();
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
  };

  // Calculate totals
  const totalPurchases = stockBalances.reduce((sum, b) => sum + b.purchases, 0);
  const totalDividends = stockBalances.reduce((sum, b) => sum + b.dividends, 0);
  const totalSales = stockBalances.reduce((sum, b) => sum + (b.sales || 0), 0);
  const totalCapitalGain = stockBalances.reduce((sum, b) => sum + (b.capitalGain || 0), 0);
  const latestValue = stockBalances.length > 0 
    ? [...stockBalances].sort((a, b) => b.taxYear.localeCompare(a.taxYear))[0].portfolioValue 
    : asset.financials.cost;

  // Calculate net investment (initial + purchases - sales)
  const netInvestment = asset.financials.cost + totalPurchases - totalSales;
  const unrealizedGain = latestValue - netInvestment;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        <Button variant="outline" onClick={onClose} className="mb-4">
          ← Back to Assets
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              Stock Portfolio Balance Management
            </CardTitle>
            <CardDescription>
              {asset.meta.description}
              {asset.meta.cdsAccountNo && ` • CDS: ${asset.meta.cdsAccountNo}`}
              {asset.meta.brokerName && ` • Broker: ${asset.meta.brokerName}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-1">Initial Investment</p>
                <p className="text-lg font-bold text-blue-900">{formatLKR(asset.financials.cost)}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs text-emerald-600 font-medium mb-1">Latest Portfolio Value</p>
                <p className="text-lg font-bold text-emerald-900">{formatLKR(latestValue)}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs text-purple-600 font-medium mb-1">Total Dividends</p>
                <p className="text-lg font-bold text-purple-900">{formatLKR(totalDividends)}</p>
              </div>
              <div className={`p-4 rounded-lg border ${unrealizedGain >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-xs font-medium mb-1 ${unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Unrealized Gain/Loss
                </p>
                <p className={`text-lg font-bold ${unrealizedGain >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {formatLKR(unrealizedGain)}
                </p>
              </div>
            </div>

            {/* Investment Summary */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
              <h4 className="font-semibold text-sm mb-3">Investment Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Purchases</p>
                  <p className="font-bold text-orange-600">{formatLKR(totalPurchases)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Sales</p>
                  <p className="font-bold text-blue-600">{formatLKR(totalSales)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Realized Gains</p>
                  <p className={`font-bold ${totalCapitalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatLKR(totalCapitalGain)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Investment</p>
                  <p className="font-bold">{formatLKR(netInvestment)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Return</p>
                  <p className={`font-bold ${(unrealizedGain + totalDividends + totalCapitalGain) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatLKR(unrealizedGain + totalDividends + totalCapitalGain)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Return %</p>
                  <p className={`font-bold ${(unrealizedGain + totalDividends + totalCapitalGain) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netInvestment > 0 ? ((unrealizedGain + totalDividends + totalCapitalGain) / netInvestment * 100).toFixed(2) : '0.00'}%
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Yearly Balance Records</h3>
              <Button onClick={handleAddBalance} disabled={showAddForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Balance Record
              </Button>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <Card className="mb-6 border-2 border-emerald-200">
                <CardHeader className="bg-emerald-50">
                  <CardTitle className="text-lg">
                    {editingId ? 'Edit' : 'Add'} Stock Balance Record
                  </CardTitle>
                  <CardDescription>
                    Record portfolio value, purchases, dividends, and sales for a tax year
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="taxYear">Tax Year *</Label>
                      <select
                        id="taxYear"
                        value={formData.taxYear}
                        onChange={(e) => setFormData({ ...formData, taxYear: e.target.value })}
                        required
                        className="w-full rounded-md border px-3 py-2"
                      >
                        {taxYears.map((year) => (
                          <option key={year} value={year}>
                            {year}/{Number(year) + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="portfolioValue">
                          Portfolio Value (as of March 31) *
                        </Label>
                        <Input
                          id="portfolioValue"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.portfolioValue}
                          onChange={handleChange('portfolioValue')}
                          required
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Total market value of all stocks on year-end
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="purchases">
                          Purchases During Year *
                        </Label>
                        <Input
                          id="purchases"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.purchases}
                          onChange={handleChange('purchases')}
                          required
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Total amount invested in stocks (outflow)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dividends">
                          Dividend Income *
                        </Label>
                        <Input
                          id="dividends"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.dividends}
                          onChange={handleChange('dividends')}
                          required
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Total dividends received during the year (inflow)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sales">
                          Sales Proceeds
                        </Label>
                        <Input
                          id="sales"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.sales}
                          onChange={handleChange('sales')}
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Proceeds from stock sales (if any)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="capitalGain">
                        Realized Capital Gain/Loss
                      </Label>
                      <Input
                        id="capitalGain"
                        type="number"
                        step="0.01"
                        value={formData.capitalGain}
                        onChange={handleChange('capitalGain')}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Profit or loss from stock sales (use negative for loss)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <textarea
                        id="notes"
                        value={formData.notes}
                        onChange={handleChange('notes')}
                        className="w-full rounded-md border px-3 py-2 min-h-[80px]"
                        placeholder="Additional notes about this period..."
                      />
                    </div>

                    {/* Summary */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-sm mb-2">Period Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-red-600" />
                            Outflows:
                          </p>
                          <p className="font-bold text-red-600">{formatLKR(formData.purchases)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-green-600" />
                            Inflows:
                          </p>
                          <p className="font-bold text-green-600">
                            {formatLKR(formData.dividends + formData.sales)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Net Cash Flow:</p>
                          <p className={`font-bold ${(formData.dividends + formData.sales - formData.purchases) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatLKR(formData.dividends + formData.sales - formData.purchases)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">
                        {editingId ? 'Update' : 'Add'} Balance Record
                      </Button>
                      <Button type="button" variant="outline" onClick={handleCancel}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Balance Records List */}
            {stockBalances.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-gray-50">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No balance records yet. Click "Add Balance Record" to start tracking.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...stockBalances]
                  .sort((a, b) => b.taxYear.localeCompare(a.taxYear))
                  .map((balance) => {
                    const netCashFlow = balance.dividends + (balance.sales || 0) - balance.purchases;
                    return (
                      <Card key={balance.id} className="border-l-4 border-l-emerald-500">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h4 className="font-bold text-lg">
                                  {balance.taxYear}/{Number(balance.taxYear) + 1}
                                </h4>
                                <span className="text-sm bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-medium">
                                  Value: {formatLKR(balance.portfolioValue)}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                                <div>
                                  <p className="text-xs text-muted-foreground">Purchases</p>
                                  <p className="font-bold text-orange-600">{formatLKR(balance.purchases)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Dividends</p>
                                  <p className="font-bold text-purple-600">{formatLKR(balance.dividends)}</p>
                                </div>
                                {balance.sales && balance.sales > 0 && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Sales</p>
                                    <p className="font-bold text-blue-600">{formatLKR(balance.sales)}</p>
                                  </div>
                                )}
                                {balance.capitalGain !== undefined && balance.capitalGain !== 0 && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Realized Gain</p>
                                    <p className={`font-bold ${balance.capitalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatLKR(balance.capitalGain)}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-sm">
                                <DollarSign className="w-4 h-4" />
                                <span className="text-muted-foreground">Net Cash Flow:</span>
                                <span className={`font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatLKR(netCashFlow)}
                                  {netCashFlow >= 0 ? ' (Inflow)' : ' (Outflow)'}
                                </span>
                              </div>

                              {balance.notes && (
                                <p className="text-sm text-muted-foreground mt-2 italic">
                                  {balance.notes}
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditBalance(balance)}
                                disabled={showAddForm}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(balance.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
