/**
 * Liability Form Component (FR-06)
 * Handles liability/loan creation and editing
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import type { Liability } from '@/types';
import { formatLKR } from '@/lib/taxEngine';

interface LiabilityFormProps {
  liability?: Liability;
  onSave?: () => void;
  onCancel?: () => void;
}

export function LiabilityForm({ liability, onSave, onCancel }: LiabilityFormProps) {
  const entities = useStore((state) => state.entities);
  const addLiability = useStore((state) => state.addLiability);
  const updateLiability = useStore((state) => state.updateLiability);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: liability?.ownerId || entities[0]?.id || '',
    lenderName: liability?.lenderName || '',
    originalAmount: liability?.originalAmount || 0,
    currentBalance: liability?.currentBalance || 0,
    dateAcquired: liability?.dateAcquired || new Date().toISOString().split('T')[0],
    interestRate: liability?.interestRate || 0,
    securityGiven: liability?.securityGiven || '',
    purpose: liability?.purpose || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Number(formData.currentBalance) > Number(formData.originalAmount)) {
      if (!confirm('Current balance is higher than original amount. This may indicate interest accumulation. Continue?')) {
        return;
      }
    }

    const liabilityData: Liability = {
      id: liability?.id || crypto.randomUUID(),
      ownerId: formData.ownerId,
      lenderName: formData.lenderName,
      originalAmount: Number(formData.originalAmount),
      currentBalance: Number(formData.currentBalance),
      dateAcquired: formData.dateAcquired,
      interestRate: Number(formData.interestRate) || undefined,
      securityGiven: formData.securityGiven || undefined,
      purpose: formData.purpose || undefined,
    };

    if (liability) {
      updateLiability(liability.id, liabilityData);
    } else {
      addLiability(liabilityData);
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

  const principalPaid = Number(formData.originalAmount) - Number(formData.currentBalance);
  const repaymentProgress = formData.originalAmount > 0 
    ? ((principalPaid / Number(formData.originalAmount)) * 100).toFixed(1)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{liability ? 'Edit' : 'Add'} Liability</CardTitle>
        <CardDescription>
          Statement of Assets and Liabilities - Loans and Debts (Cage 781)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ownerId">Borrower *</Label>
            <select
              id="ownerId"
              value={formData.ownerId}
              onChange={handleChange('ownerId')}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select borrower</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.tin})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lenderName">Lender Name *</Label>
            <Input
              id="lenderName"
              value={formData.lenderName}
              onChange={handleChange('lenderName')}
              required
              placeholder="Bank, financial institution, or individual"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateAcquired">Loan Date *</Label>
            <Input
              id="dateAcquired"
              type="date"
              value={formData.dateAcquired}
              onChange={handleChange('dateAcquired')}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="originalAmount">Original Loan Amount *</Label>
              <Input
                id="originalAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.originalAmount}
                onChange={handleChange('originalAmount')}
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Initial amount borrowed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentBalance">Current Balance *</Label>
              <Input
                id="currentBalance"
                type="number"
                min="0"
                step="0.01"
                value={formData.currentBalance}
                onChange={handleChange('currentBalance')}
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Outstanding balance as of today
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (% per annum)</Label>
              <Input
                id="interestRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.interestRate}
                onChange={handleChange('interestRate')}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Input
                id="purpose"
                value={formData.purpose}
                onChange={handleChange('purpose')}
                placeholder="e.g., Vehicle purchase, Home loan"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="securityGiven">Security Given</Label>
            <textarea
              id="securityGiven"
              value={formData.securityGiven}
              onChange={handleChange('securityGiven')}
              placeholder="Describe any collateral or security provided for this loan"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              e.g., Property mortgage, vehicle as collateral, personal guarantee
            </p>
          </div>

          {/* Summary */}
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-2">
            <h4 className="font-semibold text-sm">Loan Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Original Amount:</p>
                <p className="font-bold">{formatLKR(Number(formData.originalAmount))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Current Balance:</p>
                <p className="font-bold text-red-600">{formatLKR(Number(formData.currentBalance))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Principal Paid:</p>
                <p className="font-bold text-green-600">{formatLKR(principalPaid)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Repayment Progress:</p>
                <p className="font-bold">{repaymentProgress}%</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${repaymentProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Principal payments reduce your loan balance and are tracked in the capital computation.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {liability ? 'Update' : 'Add'} Liability
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
