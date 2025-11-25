/**
 * Property Expense Form Component
 * Manages yearly expenses for immovable properties (repairs, construction, etc.)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type { Asset, PropertyExpense } from '@/types';
import { formatLKR } from '@/lib/taxEngine';
import { useStore } from '@/stores/useStore';
import { getCurrentTaxYear, getTaxYearForDate, formatTaxYear } from '@/lib/taxYear';

interface PropertyExpenseFormProps {
  asset: Asset;
  onClose: () => void;
}

export function PropertyExpenseForm({ asset, onClose }: PropertyExpenseFormProps) {
  const updateAsset = useStore((state) => state.updateAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const entities = useStore((state) => state.entities);

  const [expenses, setExpenses] = useState<PropertyExpense[]>(
    asset.propertyExpenses || []
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    taxYear: new Date().getFullYear().toString(),
    description: '',
    expenseType: 'repair' as 'repair' | 'construction' | 'renovation' | 'maintenance' | 'other',
    amount: 0,
    marketValue: 0,
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

  const handleAddExpense = () => {
    const expense: PropertyExpense = {
      id: crypto.randomUUID(),
      date: '', // Not needed when using tax year selection
      ...newExpense,
    };

    const updatedExpenses = [...expenses, expense].sort(
      (a, b) => b.taxYear.localeCompare(a.taxYear)
    );
    setExpenses(updatedExpenses);
    setShowAddForm(false);
    setNewExpense({
      taxYear: new Date().getFullYear().toString(),
      description: '',
      expenseType: 'repair',
      amount: 0,
      marketValue: 0,
      notes: '',
    });
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      setExpenses(expenses.filter((e) => e.id !== id));
    }
  };

  const handleSave = () => {
    updateAsset(asset.id, {
      ...asset,
      propertyExpenses: expenses,
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

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const expensesByType = expenses.reduce((acc, expense) => {
    acc[expense.expenseType] = (acc[expense.expenseType] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const initialCost = asset.financials.cost;
  const currentTotalValue = initialCost + totalExpenses;
  
  // Get the latest market value from the most recent year's expense record
  const latestMarketValue = expenses.length > 0 
    ? expenses.sort((a, b) => b.taxYear.localeCompare(a.taxYear))[0].marketValue || 0
    : 0;

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Property Expenses</CardTitle>
        <CardDescription>
          {asset.meta.description} • {ownerName}
          <br />
          Track yearly expenses for repairs, construction, and maintenance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <p className="text-sm text-muted-foreground">Initial Cost</p>
            <p className="text-xl font-semibold">{formatLKR(initialCost)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-semibold text-orange-600">+ {formatLKR(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-xl font-semibold text-green-600">{formatLKR(currentTotalValue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Latest Market Value</p>
            <p className="text-2xl font-bold text-blue-600">{formatLKR(latestMarketValue)}</p>
          </div>
        </div>

        {/* Expense Breakdown by Type */}
        {Object.keys(expensesByType).length > 0 && (
          <div className="p-4 bg-slate-50 rounded-lg border">
            <p className="text-sm font-semibold mb-2">Breakdown by Type</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(expensesByType).map(([type, amount]) => (
                <div key={type}>
                  <span className="text-muted-foreground capitalize">{type}: </span>
                  <span className="font-semibold">{formatLKR(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Expense Button */}
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        )}

        {/* Add Expense Form */}
        {showAddForm && (
          <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
            <h3 className="font-semibold">New Expense</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expenseType">Expense Type *</Label>
                <select
                  id="expenseType"
                  value={newExpense.expenseType}
                  onChange={(e) =>
                    setNewExpense({
                      ...newExpense,
                      expenseType: e.target.value as PropertyExpense['expenseType'],
                    })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="repair">Repair</option>
                  <option value="construction">Construction</option>
                  <option value="renovation">Renovation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxYear">Tax Year *</Label>
                <select
                  id="taxYear"
                  value={newExpense.taxYear}
                  onChange={(e) => setNewExpense({ ...newExpense, taxYear: e.target.value })}
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
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="e.g., Roof repair, Bathroom renovation"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketValue">Market Value (Valuation for this year)</Label>
              <Input
                id="marketValue"
                type="number"
                min="0"
                step="0.01"
                value={newExpense.marketValue}
                onChange={(e) => setNewExpense({ ...newExpense, marketValue: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={newExpense.notes}
                onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddExpense}
                disabled={!newExpense.description || !newExpense.amount}
              >
                Add Expense
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Expenses List */}
        {expenses.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Expense History</h3>
            <div className="border rounded-lg divide-y">
              {expenses.map((expense) => (
                <div key={expense.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full font-semibold bg-blue-100 text-blue-700 capitalize">
                          {expense.expenseType}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Tax Year {formatTaxYear(expense.taxYear)}
                        </span>
                      </div>
                      <p className="font-semibold mt-1">{expense.description}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-lg font-bold text-orange-600">Expense: {formatLKR(expense.amount)}</p>
                        {expense.marketValue && expense.marketValue > 0 && (
                          <p className="text-lg font-bold text-blue-600">Market Value: {formatLKR(expense.marketValue)}</p>
                        )}
                      </div>
                      {expense.notes && (
                        <p className="text-sm text-muted-foreground mt-1">Note: {expense.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteExpense(expense.id)}
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
