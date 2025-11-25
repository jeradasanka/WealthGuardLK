/**
 * Investment Income Form Component (Schedule 3 - FR-04)
 * Handles investment income (interest, dividends, rent) with WHT and rent relief
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import type { InvestmentIncome } from '@/types';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear } from '@/lib/taxYear';

interface InvestmentIncomeFormProps {
  income?: InvestmentIncome;
  onSave?: () => void;
  onCancel?: () => void;
}

export function InvestmentIncomeForm({ income, onSave, onCancel }: InvestmentIncomeFormProps) {
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const addIncome = useStore((state) => state.addIncome);
  const updateIncome = useStore((state) => state.updateIncome);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: income?.ownerId || entities[0]?.id || '',
    type: income?.type || ('interest' as 'interest' | 'dividend' | 'rent'),
    source: income?.details.source || '',
    grossAmount: income?.details.grossAmount || 0,
    whtDeducted: income?.details.whtDeducted || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate rent relief if applicable
    const rentRelief = formData.type === 'rent' 
      ? Number(formData.grossAmount) * 0.25 
      : 0;

    const incomeData: InvestmentIncome = {
      id: income?.id || crypto.randomUUID(),
      ownerId: formData.ownerId,
      schedule: '3',
      taxYear: income?.taxYear || currentTaxYear,
      type: formData.type,
      details: {
        source: formData.source,
        grossAmount: Number(formData.grossAmount),
        whtDeducted: Number(formData.whtDeducted),
        rentRelief: formData.type === 'rent' ? rentRelief : undefined,
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

  const rentRelief = formData.type === 'rent' ? Number(formData.grossAmount) * 0.25 : 0;
  const assessableAmount = formData.type === 'rent' 
    ? Number(formData.grossAmount) - rentRelief 
    : Number(formData.grossAmount);
  const netReceived = Number(formData.grossAmount) - Number(formData.whtDeducted);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule 3 - Investment Income</CardTitle>
        <CardDescription>
          Income from rent, interest, dividends, and other investments (Cage 301-399) • Tax Year: {formatTaxYear(currentTaxYear)}
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
            <Label htmlFor="type">Income Type *</Label>
            <select
              id="type"
              value={formData.type}
              onChange={handleChange('type')}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="interest">Interest Income</option>
              <option value="dividend">Dividend Income</option>
              <option value="rent">Rental Income</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">
              Source *
            </Label>
            <Input
              id="source"
              value={formData.source}
              onChange={handleChange('source')}
              required
              placeholder={
                formData.type === 'interest' ? 'Bank name or institution' :
                formData.type === 'dividend' ? 'Company name' :
                'Property address or tenant name'
              }
            />
            <p className="text-xs text-muted-foreground">
              {formData.type === 'interest' && 'Financial institution paying interest'}
              {formData.type === 'dividend' && 'Company paying dividends'}
              {formData.type === 'rent' && 'Location of rental property or tenant'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grossAmount">
                Gross Amount (Cage 303) *
              </Label>
              <Input
                id="grossAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.grossAmount}
                onChange={handleChange('grossAmount')}
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Total amount before tax deduction
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whtDeducted">
                WHT Deducted (Tax Credit - Cage 908)
              </Label>
              <Input
                id="whtDeducted"
                type="number"
                min="0"
                step="0.01"
                value={formData.whtDeducted}
                onChange={handleChange('whtDeducted')}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Withholding Tax deducted at source
              </p>
            </div>
          </div>

          {/* Rent Relief Notice */}
          {formData.type === 'rent' && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-sm text-green-800">
                Automatic Rent Relief Applied
              </h4>
              <p className="text-xs text-green-700 mt-1">
                As per IRD regulations, 25% relief is automatically applied to rental income (Cage 316).
                This reduces your assessable income.
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
            <h4 className="font-semibold text-sm">Income Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Gross Amount:</p>
                <p className="font-bold">{formatLKR(Number(formData.grossAmount))}</p>
              </div>
              {formData.type === 'rent' && (
                <div>
                  <p className="text-muted-foreground">25% Relief (Cage 316):</p>
                  <p className="font-bold text-green-600">-{formatLKR(rentRelief)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">WHT Deducted:</p>
                <p className="font-bold text-orange-600">{formatLKR(Number(formData.whtDeducted))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net Received:</p>
                <p className="font-bold text-blue-600">{formatLKR(netReceived)}</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <p className="text-muted-foreground">Assessable Income:</p>
                <p className="font-bold text-lg text-purple-600">{formatLKR(assessableAmount)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              WHT is recorded as a tax credit and will reduce your final tax payable.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {income ? 'Update' : 'Add'} Investment Income
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
