/**
 * Stock Account Balance Form Component
 * Manages yearly stock portfolio balances including detailed holdings, cash transfers, and dividends
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, TrendingUp, DollarSign, Edit2, X } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { getTaxYearsFromStart } from '@/lib/taxYear';
import { formatLKR } from '@/lib/taxEngine';
import type { Asset, StockBalance, StockHolding } from '@/types';

interface StockAccountBalanceFormProps {
  asset: Asset;
  onClose: () => void;
}

export function StockAccountBalanceForm({ asset, onClose }: StockAccountBalanceFormProps) {
  const updateAsset = useStore((state) => state.updateAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  
  // Get fresh asset data from store to reflect updates instantly
  const assets = useStore((state) => state.assets);
  const currentAsset = assets.find(a => a.id === asset.id) || asset;

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    taxYear: string;
    brokerCashBalance: number;
    cashTransfers: number;
    holdings: StockHolding[];
    dividends: number;
    sales: number;
    capitalGain: number;
    notes: string;
  }>({
    taxYear: currentTaxYear,
    brokerCashBalance: 0,
    cashTransfers: 0,
    holdings: [],
    dividends: 0,
    sales: 0,
    capitalGain: 0,
    notes: '',
  });

  const [holdingData, setHoldingData] = useState<{
    symbol: string;
    companyName: string;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    dividendIncome: number;
  }>({
    symbol: '',
    companyName: '',
    quantity: 0,
    averageCost: 0,
    currentPrice: 0,
    dividendIncome: 0,
  });

  const taxYears = getTaxYearsFromStart(entities[0]?.taxYear || '2022');
  const stockBalances = currentAsset.stockBalances || [];

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleHoldingChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setHoldingData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddBalance = () => {
    setFormData({
      taxYear: currentTaxYear,
      brokerCashBalance: 0,
      cashTransfers: 0,
      holdings: [],
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
      brokerCashBalance: balance.brokerCashBalance,
      cashTransfers: balance.cashTransfers,
      holdings: balance.holdings || [],
      dividends: balance.dividends,
      sales: balance.sales || 0,
      capitalGain: balance.capitalGain || 0,
      notes: balance.notes || '',
    });
    setEditingId(balance.id);
    setShowAddForm(true);
  };

  const handleAddHolding = () => {
    setHoldingData({
      symbol: '',
      companyName: '',
      quantity: 0,
      averageCost: 0,
      currentPrice: 0,
      dividendIncome: 0,
    });
    setEditingHoldingId(null);
    setShowHoldingForm(true);
  };

  const handleEditHolding = (holding: StockHolding) => {
    setHoldingData({
      symbol: holding.symbol,
      companyName: holding.companyName,
      quantity: holding.quantity,
      averageCost: holding.averageCost,
      currentPrice: holding.currentPrice,
      dividendIncome: holding.dividendIncome || 0,
    });
    setEditingHoldingId(holding.id);
    setShowHoldingForm(true);
  };

  const handleSaveHolding = () => {
    const totalCost = holdingData.quantity * holdingData.averageCost;
    const marketValue = holdingData.quantity * holdingData.currentPrice;
    const unrealizedGain = marketValue - totalCost;

    const newHolding: StockHolding = {
      id: editingHoldingId || crypto.randomUUID(),
      symbol: holdingData.symbol,
      companyName: holdingData.companyName,
      quantity: holdingData.quantity,
      averageCost: holdingData.averageCost,
      currentPrice: holdingData.currentPrice,
      totalCost,
      marketValue,
      unrealizedGain,
      dividendIncome: holdingData.dividendIncome,
    };

    let updatedHoldings: StockHolding[];
    if (editingHoldingId) {
      updatedHoldings = formData.holdings.map((h) =>
        h.id === editingHoldingId ? newHolding : h
      );
    } else {
      updatedHoldings = [...formData.holdings, newHolding];
    }

    setFormData((prev) => ({ ...prev, holdings: updatedHoldings }));
    setShowHoldingForm(false);
    setEditingHoldingId(null);
  };

  const handleDeleteHolding = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      holdings: prev.holdings.filter((h) => h.id !== id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate totals from holdings
    const portfolioValue = formData.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const purchases = formData.holdings.reduce((sum, h) => sum + h.totalCost, 0);
    const dividends = formData.holdings.reduce((sum, h) => sum + (h.dividendIncome || 0), 0);

    const newBalance: StockBalance = {
      id: editingId || crypto.randomUUID(),
      taxYear: formData.taxYear,
      brokerCashBalance: formData.brokerCashBalance,
      cashTransfers: formData.cashTransfers,
      portfolioValue,
      holdings: formData.holdings,
      purchases,
      dividends,
      sales: formData.sales > 0 ? formData.sales : undefined,
      capitalGain: formData.capitalGain !== 0 ? formData.capitalGain : undefined,
      notes: formData.notes || undefined,
    };

    let updatedBalances: StockBalance[];
    if (editingId) {
      updatedBalances = (currentAsset.stockBalances || []).map((b) =>
        b.id === editingId ? newBalance : b
      );
    } else {
      updatedBalances = [...(currentAsset.stockBalances || []), newBalance];
    }

    // Sort by tax year descending
    updatedBalances.sort((a, b) => b.taxYear.localeCompare(a.taxYear));

    try {
      updateAsset(currentAsset.id, { stockBalances: updatedBalances });
      await saveToStorage();
      console.log('Stock balance saved successfully:', newBalance);
    } catch (error) {
      console.error('Failed to save stock balance:', error);
      alert('Failed to save. Please try again.');
      return;
    }

    setShowAddForm(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this stock balance record?')) {
      const updatedBalances = (currentAsset.stockBalances || []).filter((b) => b.id !== id);
      try {
        updateAsset(currentAsset.id, { stockBalances: updatedBalances });
        await saveToStorage();
        console.log('Stock balance deleted successfully');
      } catch (error) {
        console.error('Failed to delete stock balance:', error);
        alert('Failed to delete. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
  };

  // Calculate totals
  const totalCashTransfers = stockBalances.reduce((sum, b) => sum + b.cashTransfers, 0);
  const totalDividends = stockBalances.reduce((sum, b) => sum + b.dividends, 0);
  const totalSales = stockBalances.reduce((sum, b) => sum + (b.sales || 0), 0);
  const totalCapitalGain = stockBalances.reduce((sum, b) => sum + (b.capitalGain || 0), 0);
  const latestBalance = stockBalances.length > 0 
    ? [...stockBalances].sort((a, b) => b.taxYear.localeCompare(a.taxYear))[0]
    : null;
  const latestValue = latestBalance?.portfolioValue || currentAsset.financials.cost;
  const latestCash = latestBalance?.brokerCashBalance || 0;

  // Calculate net investment (initial + cash transfers - sales)
  const netInvestment = currentAsset.financials.cost + totalCashTransfers - totalSales;
  const unrealizedGain = latestValue - netInvestment;

  // Calculate holdings from formData
  const holdingsPortfolioValue = formData.holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const holdingsTotalCost = formData.holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const holdingsUnrealizedGain = holdingsPortfolioValue - holdingsTotalCost;
  const holdingsTotalDividends = formData.holdings.reduce((sum, h) => sum + (h.dividendIncome || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
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
              {currentAsset.meta.description}
              {currentAsset.meta.cdsAccountNo && ` • CDS: ${currentAsset.meta.cdsAccountNo}`}
              {currentAsset.meta.brokerName && ` • Broker: ${currentAsset.meta.brokerName}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-1">Initial Investment</p>
                <p className="text-lg font-bold text-blue-900">{formatLKR(currentAsset.financials.cost)}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs text-emerald-600 font-medium mb-1">Portfolio Value</p>
                <p className="text-lg font-bold text-emerald-900">{formatLKR(latestValue)}</p>
              </div>
              <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                <p className="text-xs text-cyan-600 font-medium mb-1">Broker Cash</p>
                <p className="text-lg font-bold text-cyan-900">{formatLKR(latestCash)}</p>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Cash Transfers</p>
                  <p className="font-bold text-orange-600">{formatLKR(totalCashTransfers)}</p>
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
                <div>
                  <p className="text-muted-foreground">Total Assets</p>
                  <p className="font-bold text-emerald-600">{formatLKR(latestValue + latestCash)}</p>
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
                    Record broker cash balance, stock holdings, cash transfers, and dividends for a tax year
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
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

                    {/* Cash and Transfers Section */}
                    <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Broker Cash Account
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cashTransfers">
                            Net Cash Transfers *
                          </Label>
                          <Input
                            id="cashTransfers"
                            type="number"
                            step="0.01"
                            value={formData.cashTransfers}
                            onChange={handleChange('cashTransfers')}
                            required
                            placeholder="0.00"
                          />
                          <p className="text-xs text-muted-foreground">
                            Positive: Cash deposited to broker | Negative: Cash withdrawn from broker
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="brokerCashBalance">
                            Cash Balance (as of March 31) *
                          </Label>
                          <Input
                            id="brokerCashBalance"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.brokerCashBalance}
                            onChange={handleChange('brokerCashBalance')}
                            required
                            placeholder="0.00"
                          />
                          <p className="text-xs text-muted-foreground">
                            Uninvested cash balance in your broker account at year-end
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stock Holdings Section */}
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Stock Holdings (as of March 31)
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddHolding}
                          disabled={showHoldingForm}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Stock
                        </Button>
                      </div>

                      {/* Add/Edit Holding Form */}
                      {showHoldingForm && (
                        <Card className="mb-4 border-2 border-emerald-300">
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor="symbol">Stock Symbol *</Label>
                                  <Input
                                    id="symbol"
                                    value={holdingData.symbol}
                                    onChange={handleHoldingChange('symbol')}
                                    required
                                    placeholder="e.g., CFIN.N0000"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="companyName">Company Name *</Label>
                                  <Input
                                    id="companyName"
                                    value={holdingData.companyName}
                                    onChange={handleHoldingChange('companyName')}
                                    required
                                    placeholder="e.g., Commercial Bank"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor="quantity">Quantity</Label>
                                  <Input
                                    id="quantity"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={holdingData.quantity}
                                    onChange={handleHoldingChange('quantity')}
                                    placeholder="50"
                                  />
                                  <p className="text-xs text-muted-foreground">Can be 0 for dividend-only</p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="averageCost">Avg Cost/Share</Label>
                                  <Input
                                    id="averageCost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={holdingData.averageCost}
                                    onChange={handleHoldingChange('averageCost')}
                                    placeholder="100.00"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="currentPrice">Current Price</Label>
                                  <Input
                                    id="currentPrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={holdingData.currentPrice}
                                    onChange={handleHoldingChange('currentPrice')}
                                    placeholder="120.00"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="dividendIncome">Dividend Income</Label>
                                  <Input
                                    id="dividendIncome"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={holdingData.dividendIncome}
                                    onChange={handleHoldingChange('dividendIncome')}
                                    placeholder="1000.00"
                                  />
                                  <p className="text-xs text-muted-foreground">Total dividends received</p>
                                </div>
                              </div>

                              {/* Calculated values preview */}
                              {holdingData.quantity > 0 && (
                                <div className="p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <p className="text-muted-foreground">Total Cost</p>
                                      <p className="font-bold">{formatLKR(holdingData.quantity * holdingData.averageCost)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Market Value</p>
                                      <p className="font-bold text-emerald-600">{formatLKR(holdingData.quantity * holdingData.currentPrice)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Gain/Loss</p>
                                      <p className={`font-bold ${(holdingData.quantity * holdingData.currentPrice - holdingData.quantity * holdingData.averageCost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatLKR(holdingData.quantity * holdingData.currentPrice - holdingData.quantity * holdingData.averageCost)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleSaveHolding}
                                  className="flex-1"
                                >
                                  {editingHoldingId ? 'Update' : 'Add'} Stock
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShowHoldingForm(false);
                                    setEditingHoldingId(null);
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Holdings Table */}
                      {formData.holdings.length === 0 ? (
                        <div className="text-center py-6 border rounded-lg bg-white">
                          <p className="text-sm text-muted-foreground">
                            No stock holdings added yet. Click "Add Stock" to start.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border rounded-lg overflow-hidden">
                            <thead className="bg-emerald-100">
                              <tr>
                                <th className="text-left p-2 font-semibold">Symbol</th>
                                <th className="text-left p-2 font-semibold">Company</th>
                                <th className="text-right p-2 font-semibold">Qty</th>
                                <th className="text-right p-2 font-semibold">Avg Cost</th>
                                <th className="text-right p-2 font-semibold">Current Price</th>
                                <th className="text-right p-2 font-semibold">Total Cost</th>
                                <th className="text-right p-2 font-semibold">Market Value</th>
                                <th className="text-right p-2 font-semibold">Gain/Loss</th>
                                <th className="text-right p-2 font-semibold">Dividends</th>
                                <th className="text-center p-2 font-semibold">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {formData.holdings.map((holding) => (
                                <tr key={holding.id} className="border-t hover:bg-emerald-50">
                                  <td className="p-2 font-mono font-semibold text-blue-600">{holding.symbol}</td>
                                  <td className="p-2">{holding.companyName}</td>
                                  <td className="p-2 text-right">{holding.quantity.toLocaleString()}</td>
                                  <td className="p-2 text-right">{formatLKR(holding.averageCost)}</td>
                                  <td className="p-2 text-right">{formatLKR(holding.currentPrice)}</td>
                                  <td className="p-2 text-right font-semibold">{formatLKR(holding.totalCost)}</td>
                                  <td className="p-2 text-right font-semibold text-emerald-600">{formatLKR(holding.marketValue)}</td>
                                  <td className={`p-2 text-right font-semibold ${holding.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatLKR(holding.unrealizedGain)}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-blue-600">{formatLKR(holding.dividendIncome || 0)}</td>
                                  <td className="p-2 text-center">
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditHolding(holding)}
                                        disabled={showHoldingForm}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteHolding(holding.id)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-emerald-300 bg-emerald-50 font-bold">
                                <td colSpan={5} className="p-2 text-right">TOTALS:</td>
                                <td className="p-2 text-right">{formatLKR(holdingsTotalCost)}</td>
                                <td className="p-2 text-right text-emerald-600">{formatLKR(holdingsPortfolioValue)}</td>
                                <td className={`p-2 text-right ${holdingsUnrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatLKR(holdingsUnrealizedGain)}
                                </td>
                                <td className="p-2 text-right text-blue-600">{formatLKR(holdingsTotalDividends)}</td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Dividends and Sales Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dividends">
                          Dividend Income (Auto-Calculated)
                        </Label>
                        <Input
                          id="dividends"
                          type="number"
                          value={holdingsTotalDividends}
                          readOnly
                          disabled
                          className="bg-blue-50 font-semibold text-blue-900"
                        />
                        <p className="text-xs text-muted-foreground">
                          Total dividends from holdings table above (inflow)
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
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Net Cash Transfers</p>
                          <p className={`font-bold ${formData.cashTransfers >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {formatLKR(formData.cashTransfers)}
                            {formData.cashTransfers >= 0 ? ' (In)' : ' (Out)'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Broker Cash Balance</p>
                          <p className="font-bold text-cyan-600">{formatLKR(formData.brokerCashBalance)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Portfolio Value</p>
                          <p className="font-bold text-emerald-600">{formatLKR(holdingsPortfolioValue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dividends (Inflow)</p>
                          <p className="font-bold text-green-600">{formatLKR(formData.dividends)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Assets</p>
                          <p className="font-bold text-blue-600">{formatLKR(formData.brokerCashBalance + holdingsPortfolioValue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Unrealized Gain</p>
                          <p className={`font-bold ${holdingsUnrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatLKR(holdingsUnrealizedGain)}
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
              <div className="space-y-4">
                {[...stockBalances]
                  .sort((a, b) => b.taxYear.localeCompare(a.taxYear))
                  .map((balance) => {
                    const netCashFlow = balance.dividends + (balance.sales || 0) - balance.cashTransfers;
                    const totalAssets = balance.portfolioValue + balance.brokerCashBalance;
                    
                    return (
                      <Card key={balance.id} className="border-l-4 border-l-emerald-500">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <h4 className="font-bold text-xl">
                                {balance.taxYear}/{Number(balance.taxYear) + 1}
                              </h4>
                              <span className="text-sm bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-medium">
                                Total Assets: {formatLKR(totalAssets)}
                              </span>
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

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Net Cash Transfers</p>
                              <p className={`font-bold ${balance.cashTransfers >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                {formatLKR(balance.cashTransfers)}
                                {balance.cashTransfers >= 0 ? ' ↓' : ' ↑'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Broker Cash</p>
                              <p className="font-bold text-cyan-600">{formatLKR(balance.brokerCashBalance)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Portfolio Value</p>
                              <p className="font-bold text-emerald-600">{formatLKR(balance.portfolioValue)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Dividends</p>
                              <p className="font-bold text-purple-600">{formatLKR(balance.dividends)}</p>
                            </div>
                          </div>

                          {/* Holdings Table */}
                          {balance.holdings && balance.holdings.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-semibold mb-2">Stock Holdings ({balance.holdings.length})</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs border rounded">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="text-left p-2">Symbol</th>
                                      <th className="text-left p-2">Company</th>
                                      <th className="text-right p-2">Qty</th>
                                      <th className="text-right p-2">Avg Cost</th>
                                      <th className="text-right p-2">Price</th>
                                      <th className="text-right p-2">Value</th>
                                      <th className="text-right p-2">Gain/Loss</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {balance.holdings.map((holding) => (
                                      <tr key={holding.id} className="border-t">
                                        <td className="p-2 font-mono font-semibold text-blue-600">{holding.symbol}</td>
                                        <td className="p-2">{holding.companyName}</td>
                                        <td className="p-2 text-right">{holding.quantity.toLocaleString()}</td>
                                        <td className="p-2 text-right">{formatLKR(holding.averageCost)}</td>
                                        <td className="p-2 text-right">{formatLKR(holding.currentPrice)}</td>
                                        <td className="p-2 text-right font-semibold">{formatLKR(holding.marketValue)}</td>
                                        <td className={`p-2 text-right font-semibold ${holding.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {formatLKR(holding.unrealizedGain)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm pt-3 border-t">
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
