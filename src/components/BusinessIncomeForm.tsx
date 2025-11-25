/**
 * Business Income Form Component (Schedule 2 - FR-03)
 * Handles business income with net profit calculation
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import type { BusinessIncome } from '@/types';
import { formatLKR } from '@/lib/taxEngine';

interface BusinessIncomeFormProps {
  income?: BusinessIncome;
  onSave?: () => void;
  onCancel?: () => void;
}

export function BusinessIncomeForm({ income, onSave, onCancel }: BusinessIncomeFormProps) {
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const addIncome = useStore((state) => state.addIncome);
  const updateIncome = useStore((state) => state.updateIncome);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: income?.ownerId || entities[0]?.id || '',
    businessName: income?.details.businessName || '',
    grossRevenue: income?.details.grossRevenue || 0,
    directExpenses: income?.details.directExpenses || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const netProfit = Number(formData.grossRevenue) - Number(formData.directExpenses);

    if (netProfit < 0) {
      if (!confirm('Your business shows a loss. Continue anyway?')) {
        return;
      }
    }

    const incomeData: BusinessIncome = {
      id: income?.id || crypto.randomUUID(),
      ownerId: formData.ownerId,
      schedule: '2',
      taxYear: income?.taxYear || currentTaxYear,
      details: {
        businessName: formData.businessName,
        grossRevenue: Number(formData.grossRevenue),
        directExpenses: Number(formData.directExpenses),
        netProfit: netProfit,
      },
    };

    if (income) {
      updateIncome(income.id, incomeData);
    } else {
      addIncome(incomeData);
    }

    try {
      await saveToStorage();
      onSave?.();
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    }
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const netProfit = Number(formData.grossRevenue) - Number(formData.directExpenses);
  const profitMargin = formData.grossRevenue > 0 
    ? (netProfit / Number(formData.grossRevenue) * 100).toFixed(1)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule 2 - Business Income</CardTitle>
        <CardDescription>
          Income from business or profession - Gains and Profits (Cage 201-299)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ownerId">Taxpayer *</Label>
            <select
              id="ownerId"
              value={formData.ownerId}
              onChange={handleChange('ownerId')}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select taxpayer</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.tin})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={handleChange('businessName')}
              required
              placeholder="Business or profession name"
            />
            <p className="text-xs text-muted-foreground">
              Name under which business operates
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grossRevenue">
              Gross Revenue/Turnover (Cage 201) *
            </Label>
            <Input
              id="grossRevenue"
              type="number"
              min="0"
              step="0.01"
              value={formData.grossRevenue}
              onChange={handleChange('grossRevenue')}
              required
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Total income from business before expenses
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="directExpenses">
              Direct Expenses (Cage 202) *
            </Label>
            <Input
              id="directExpenses"
              type="number"
              min="0"
              step="0.01"
              value={formData.directExpenses}
              onChange={handleChange('directExpenses')}
              required
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Cost of goods sold, operating expenses, depreciation
            </p>
          </div>

          {/* Summary */}
          <div className={`p-4 rounded-lg border space-y-2 ${
            netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <h4 className="font-semibold text-sm">Business Performance</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Gross Revenue:</p>
                <p className="font-bold">{formatLKR(Number(formData.grossRevenue))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Expenses:</p>
                <p className="font-bold text-red-600">{formatLKR(Number(formData.directExpenses))}</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <p className="text-muted-foreground">Net Profit (Cage 203):</p>
                <p className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatLKR(netProfit)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Profit Margin:</p>
                <p className="font-semibold">{profitMargin}%</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {netProfit >= 0 
                ? 'Only the Net Profit (Gains and Profits) is added to your taxable income.'
                : 'Business losses can be carried forward to offset future profits.'}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {income ? 'Update' : 'Add'} Business Income
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
