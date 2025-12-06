/**
 * Other Income Form Component (Schedule 4 - FR-02)
 * Handles miscellaneous income types with exempt income tracking
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import type { OtherIncome } from '@/types';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear } from '@/lib/taxYear';

interface OtherIncomeFormProps {
  income?: OtherIncome;
  onSave?: () => void;
  onCancel?: () => void;
}

export function OtherIncomeForm({ income, onSave, onCancel }: OtherIncomeFormProps) {
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const addIncome = useStore((state) => state.addIncome);
  const updateIncome = useStore((state) => state.updateIncome);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: income?.ownerId || entities[0]?.id || '',
    type: income?.type || 'other' as const,
    source: income?.details.source || '',
    grossAmount: income?.details.grossAmount || 0,
    exemptAmount: income?.details.exemptAmount || 0,
    whtDeducted: income?.details.whtDeducted || 0,
    description: income?.details.description || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const incomeData: OtherIncome = {
      id: income?.id || crypto.randomUUID(),
      ownerId: formData.ownerId,
      schedule: '4',
      taxYear: income?.taxYear || currentTaxYear,
      type: formData.type,
      details: {
        source: formData.source,
        grossAmount: Number(formData.grossAmount),
        exemptAmount: Number(formData.exemptAmount),
        whtDeducted: Number(formData.whtDeducted),
        description: formData.description,
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const taxableAmount = Number(formData.grossAmount) - Number(formData.exemptAmount);
  const netAmount = taxableAmount - Number(formData.whtDeducted);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule 4 - Other Income</CardTitle>
        <CardDescription>
          Income from royalties, prizes, pensions, and other miscellaneous sources (Cage 401-499) • Tax Year: {formatTaxYear(currentTaxYear)}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Income Type *</Label>
              <select
                id="type"
                value={formData.type}
                onChange={handleChange('type')}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="royalty">Royalty</option>
                <option value="annuity">Annuity</option>
                <option value="prize">Prize/Award</option>
                <option value="lottery">Lottery Winnings</option>
                <option value="pension">Pension</option>
                <option value="gratuity">Gratuity</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Type of other income received
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source *</Label>
              <Input
                id="source"
                value={formData.source}
                onChange={handleChange('source')}
                required
                placeholder="e.g., Company name, organization"
              />
              <p className="text-xs text-muted-foreground">
                Payer or source of income
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grossAmount">
                Gross Amount (Cage 401) *
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
                Total income before exemptions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exemptAmount">
                Exempt Amount (Cage 402)
              </Label>
              <Input
                id="exemptAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.exemptAmount}
                onChange={handleChange('exemptAmount')}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Exempt portion (e.g., pension, gratuity exemptions)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whtDeducted">
              WHT Deducted (Cage 908)
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
              Withholding tax deducted at source (if applicable)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={handleChange('description')}
              rows={3}
              placeholder="Additional details about the income"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Summary Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Gross Amount:</span>
                  <span className="font-medium">{formatLKR(formData.grossAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Less: Exempt Amount:</span>
                  <span>({formatLKR(formData.exemptAmount)})</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Taxable Amount:</span>
                  <span className="font-medium">{formatLKR(taxableAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Less: WHT Deducted:</span>
                  <span>({formatLKR(formData.whtDeducted)})</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Net Income:</span>
                  <span>{formatLKR(netAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit">
              {income ? 'Update' : 'Save'} Other Income
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
