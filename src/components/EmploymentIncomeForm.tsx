/**
 * Employment Income Form Component (Schedule 1 - FR-02)
 * Handles employment income with APIT deductions
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import type { EmploymentIncome, TaxEntity } from '@/types';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear } from '@/lib/taxYear';

interface EmploymentIncomeFormProps {
  income?: EmploymentIncome;
  onSave?: () => void;
  onCancel?: () => void;
}

export function EmploymentIncomeForm({ income, onSave, onCancel }: EmploymentIncomeFormProps) {
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const addIncome = useStore((state) => state.addIncome);
  const updateIncome = useStore((state) => state.updateIncome);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: income?.ownerId || entities[0]?.id || '',
    employerName: income?.details.employerName || '',
    employerTIN: income?.details.employerTIN || '',
    grossRemuneration: income?.details.grossRemuneration || 0,
    nonCashBenefits: income?.details.nonCashBenefits || 0,
    apitDeducted: income?.details.apitDeducted || 0,
    exemptIncome: income?.details.exemptIncome || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const incomeData: EmploymentIncome = {
      id: income?.id || crypto.randomUUID(),
      ownerId: formData.ownerId,
      schedule: '1',
      taxYear: income?.taxYear || currentTaxYear,
      details: {
        employerName: formData.employerName,
        employerTIN: formData.employerTIN,
        grossRemuneration: Number(formData.grossRemuneration),
        nonCashBenefits: Number(formData.nonCashBenefits),
        apitDeducted: Number(formData.apitDeducted),
        exemptIncome: Number(formData.exemptIncome),
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

  const totalIncome = Number(formData.grossRemuneration) + Number(formData.nonCashBenefits);
  const netIncome = totalIncome - Number(formData.apitDeducted);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule 1 - Employment Income</CardTitle>
        <CardDescription>
          Income from employment including salary, wages, and benefits (Cage 101-199) • Tax Year: {formatTaxYear(currentTaxYear)}
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
              <Label htmlFor="employerName">Employer Name *</Label>
              <Input
                id="employerName"
                value={formData.employerName}
                onChange={handleChange('employerName')}
                required
                placeholder="Company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employerTIN">Employer TIN *</Label>
              <Input
                id="employerTIN"
                value={formData.employerTIN}
                onChange={handleChange('employerTIN')}
                required
                placeholder="123456789"
                maxLength={12}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grossRemuneration">
                Gross Remuneration (Cage 103) *
              </Label>
              <Input
                id="grossRemuneration"
                type="number"
                min="0"
                step="0.01"
                value={formData.grossRemuneration}
                onChange={handleChange('grossRemuneration')}
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Total salary, wages, bonuses before deductions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nonCashBenefits">
                Non-Cash Benefits (Cage 104)
              </Label>
              <Input
                id="nonCashBenefits"
                type="number"
                min="0"
                step="0.01"
                value={formData.nonCashBenefits}
                onChange={handleChange('nonCashBenefits')}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Vehicle, housing, or other benefits
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apitDeducted">
                APIT Deducted (Tax Credit - Cage 903) *
              </Label>
              <Input
                id="apitDeducted"
                type="number"
                min="0"
                step="0.01"
                value={formData.apitDeducted}
                onChange={handleChange('apitDeducted')}
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Advance Personal Income Tax deducted by employer
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exemptIncome">Exempt Income</Label>
              <Input
                id="exemptIncome"
                type="number"
                min="0"
                step="0.01"
                value={formData.exemptIncome}
                onChange={handleChange('exemptIncome')}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Tax-exempt portion of income
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
            <h4 className="font-semibold text-sm">Income Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Total Gross Income:</p>
                <p className="font-bold">{formatLKR(totalIncome)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">APIT Deducted:</p>
                <p className="font-bold text-orange-600">{formatLKR(Number(formData.apitDeducted))}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Net Income Received:</p>
                <p className="font-bold text-green-600">{formatLKR(netIncome)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: APIT is recorded as a tax credit and will reduce your final tax payable.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {income ? 'Update' : 'Add'} Employment Income
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
