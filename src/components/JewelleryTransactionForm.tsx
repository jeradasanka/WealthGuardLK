/**
 * Jewellery Transaction Form Component
 * Manages yearly purchases and sales of jewellery items
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type { Asset, JewelleryTransaction } from '@/types';
import { formatLKR } from '@/lib/taxEngine';
import { useStore } from '@/stores/useStore';
import { getCurrentTaxYear, getTaxYearForDate, formatTaxYear } from '@/lib/taxYear';

interface JewelleryTransactionFormProps {
  asset: Asset;
  onClose: () => void;
}

export function JewelleryTransactionForm({ asset, onClose }: JewelleryTransactionFormProps) {
  const updateAsset = useStore((state) => state.updateAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const entities = useStore((state) => state.entities);

  const [transactions, setTransactions] = useState<JewelleryTransaction[]>(
    asset.jewelleryTransactions || []
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: 'purchase' as 'purchase' | 'sale',
    taxYear: new Date().getFullYear().toString(),
    description: '',
    itemType: '',
    weight: 0,
    purity: '',
    amount: 0,
    notes: '',
  });

  // Get available tax years from acquisition date to current year
  const getAvailableTaxYears = () => {
    const acquisitionYear = parseInt(getTaxYearForDate(asset.meta.dateAcquired));
    const currentYear = parseInt(getCurrentTaxYear());
    const years: string[] = [];
    
    for (let year = currentYear; year >= acquisitionYear; year--) {
      years.push(year.toString());
    }
    
    return years;
  };

  const taxYears = getAvailableTaxYears();

  const handleAddTransaction = () => {
    const transaction: JewelleryTransaction = {
      id: crypto.randomUUID(),
      date: '', // Not needed when using tax year selection
      ...newTransaction,
    };

    const updatedTransactions = [...transactions, transaction].sort(
      (a, b) => b.taxYear.localeCompare(a.taxYear)
    );
    setTransactions(updatedTransactions);
    setShowAddForm(false);
    setNewTransaction({
      type: 'purchase',
      taxYear: new Date().getFullYear().toString(),
      description: '',
      itemType: '',
      weight: 0,
      purity: '',
      amount: 0,
      notes: '',
    });
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      setTransactions(transactions.filter((t) => t.id !== id));
    }
  };

  const handleSave = () => {
    updateAsset(asset.id, {
      ...asset,
      jewelleryTransactions: transactions,
    });
    saveToStorage();
    onClose();
  };

  const getEntityName = (ownerId: string) => {
    return entities.find((e) => e.id === ownerId)?.name || 'Unknown';
  };

  const ownerName = asset.ownerId
    ? getEntityName(asset.ownerId)
    : asset.ownershipShares
      ? 'Joint Ownership'
      : 'Unknown';

  const totalPurchases = transactions
    .filter((t) => t.type === 'purchase')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalSales = transactions
    .filter((t) => t.type === 'sale')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Jewellery Transactions</CardTitle>
        <CardDescription>
          {asset.meta.description} • {ownerName}
          <br />
          Track yearly purchases and sales of jewellery items
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <p className="text-sm text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-bold">{transactions.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Purchases</p>
            <p className="text-2xl font-bold text-red-600">{formatLKR(totalPurchases)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold text-green-600">{formatLKR(totalSales)}</p>
          </div>
        </div>

        {/* Add Transaction Button */}
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        )}

        {/* Add Transaction Form */}
        {showAddForm && (
          <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
            <h3 className="font-semibold">New Transaction</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Transaction Type *</Label>
                <select
                  id="type"
                  value={newTransaction.type}
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, type: e.target.value as 'purchase' | 'sale' })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="purchase">Purchase</option>
                  <option value="sale">Sale</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxYear">Tax Year *</Label>
                <select
                  id="taxYear"
                  value={newTransaction.taxYear}
                  onChange={(e) => setNewTransaction({ ...newTransaction, taxYear: e.target.value })}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {taxYears.map((year) => (
                    <option key={year} value={year}>
                      {formatTaxYear(year)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                placeholder="e.g., Gold necklace, Silver bracelet"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemType">Item Type</Label>
                <Input
                  id="itemType"
                  value={newTransaction.itemType}
                  onChange={(e) => setNewTransaction({ ...newTransaction, itemType: e.target.value })}
                  placeholder="e.g., Gold, Silver"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  value={newTransaction.weight}
                  onChange={(e) => setNewTransaction({ ...newTransaction, weight: Number(e.target.value) })}
                  placeholder="e.g., 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purity">Purity/Grade</Label>
                <Input
                  id="purity"
                  value={newTransaction.purity}
                  onChange={(e) => setNewTransaction({ ...newTransaction, purity: e.target.value })}
                  placeholder="e.g., 22K, 999"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{newTransaction.type === 'purchase' ? 'Purchase Amount' : 'Sale Amount'} *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={newTransaction.notes}
                onChange={(e) => setNewTransaction({ ...newTransaction, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddTransaction}
                disabled={!newTransaction.description || !newTransaction.amount}
              >
                Add Transaction
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Transactions List */}
        {transactions.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Transaction History</h3>
            <div className="border rounded-lg divide-y">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            transaction.type === 'purchase'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {transaction.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Tax Year {formatTaxYear(transaction.taxYear)}
                        </span>
                      </div>
                      <p className="font-semibold mt-1">{transaction.description}</p>
                      {(transaction.itemType || transaction.weight || transaction.purity) && (
                        <p className="text-sm text-muted-foreground">
                          {[
                            transaction.itemType,
                            transaction.weight ? `${transaction.weight}g` : null,
                            transaction.purity,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      )}
                      <p className="text-lg font-bold mt-1">{formatLKR(transaction.amount)}</p>
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground mt-1">Note: {transaction.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTransaction(transaction.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
