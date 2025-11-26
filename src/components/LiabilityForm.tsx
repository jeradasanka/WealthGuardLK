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
import { Trash2 } from 'lucide-react';

interface LiabilityFormProps {
  liability?: Liability;
  onSave?: () => void;
  onCancel?: () => void;
}

export function LiabilityForm({ liability, onSave, onCancel }: LiabilityFormProps) {
  const entities = useStore((state) => state.entities);
  const addLiability = useStore((state) => state.addLiability);
  const updateLiability = useStore((state) => state.updateLiability);
  const removeLiability = useStore((state) => state.removeLiability);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: liability?.ownerId || entities[0]?.id || '',
    ownershipShares: liability?.ownershipShares || [],
    multipleOwners: (liability?.ownershipShares && liability.ownershipShares.length > 0) || false,
    lenderName: liability?.lenderName || '',
    originalAmount: liability?.originalAmount || 0,
    dateAcquired: liability?.dateAcquired || new Date().toISOString().split('T')[0],
    interestRate: liability?.interestRate || 0,
    securityGiven: liability?.securityGiven || '',
    purpose: liability?.purpose || '',
    paymentFrequency: liability?.paymentFrequency || 'annually',
    maturityDate: liability?.maturityDate || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate ownership percentages if multiple owners
    if (formData.multipleOwners && formData.ownershipShares.length > 0) {
      const totalPercentage = formData.ownershipShares.reduce((sum, share) => sum + share.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        alert('Total ownership percentage must equal 100%');
        return;
      }
    }

    // Calculate currentBalance from payment history or use originalAmount
    const payments = liability?.payments || [];
    const totalPrincipalPaid = payments.reduce((sum, p) => sum + p.principalPaid, 0);
    const calculatedBalance = Number(formData.originalAmount) - totalPrincipalPaid;

    const liabilityData: Liability = {
      id: liability?.id || crypto.randomUUID(),
      ownerId: formData.multipleOwners ? '' : formData.ownerId,
      ownershipShares: formData.multipleOwners ? formData.ownershipShares : undefined,
      lenderName: formData.lenderName,
      description: `${formData.lenderName} - ${formData.purpose || 'Loan'}`,
      originalAmount: Number(formData.originalAmount),
      currentBalance: calculatedBalance,
      date: formData.dateAcquired,
      dateAcquired: formData.dateAcquired,
      interestRate: Number(formData.interestRate) || undefined,
      securityGiven: formData.securityGiven || undefined,
      purpose: formData.purpose || undefined,
      paymentFrequency: formData.paymentFrequency as 'monthly' | 'quarterly' | 'annually' | 'other',
      maturityDate: formData.maturityDate || undefined,
      payments: liability?.payments || [],
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

  const handleDelete = () => {
    if (!liability?.id) return;
    
    const verification = window.prompt(
      `⚠️ WARNING: You are about to permanently delete this liability.\n\n` +
      `Lender: ${formData.lenderName || 'Untitled'}\n` +
      `Purpose: ${formData.purpose || 'Not specified'}\n` +
      `Acquired: ${formData.dateAcquired}\n` +
      `Original Amount: ${formatLKR(formData.originalAmount)}\n` +
      `Current Balance: ${formatLKR(liability.currentBalance)}\n\n` +
      `This action CANNOT be undone. All data including payment history will be permanently lost.\n\n` +
      `To confirm deletion, type DELETE in capital letters:`
    );
    
    if (verification === 'DELETE') {
      removeLiability(liability.id);
      saveToStorage();
      onCancel?.(); // Close form and return to list
    } else if (verification !== null) {
      alert('Deletion cancelled. The verification text did not match.');
    }
  };

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
            <Label htmlFor="multipleOwners">Borrower Type</Label>
            <select
              id="multipleOwners"
              value={formData.multipleOwners ? 'multiple' : 'single'}
              onChange={(e) => {
                const isMultiple = e.target.value === 'multiple';
                setFormData((prev) => ({
                  ...prev,
                  multipleOwners: isMultiple,
                  ownershipShares: isMultiple
                    ? entities.map((entity) => ({ entityId: entity.id, percentage: 100 / entities.length }))
                    : [],
                }));
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="single">Single Borrower</option>
              <option value="multiple">Multiple Borrowers (Joint Liability)</option>
            </select>
          </div>

          {!formData.multipleOwners && (
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
          )}

          {formData.multipleOwners && (
            <div className="space-y-2 border rounded-lg p-4 bg-slate-50">
              <Label>Liability Distribution *</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Specify liability percentage for each borrower (total must equal 100%)
              </p>
              {formData.ownershipShares.map((share, index) => {
                const entity = entities.find((e) => e.id === share.entityId);
                return (
                  <div key={share.entityId} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-sm">{entity?.name}</Label>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={share.percentage}
                        onChange={(e) => {
                          const newShares = [...formData.ownershipShares];
                          newShares[index].percentage = Number(e.target.value);
                          setFormData((prev) => ({ ...prev, ownershipShares: newShares }));
                        }}
                        required
                        className="text-right"
                      />
                    </div>
                    <span className="text-sm font-medium">%</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total:</span>
                  <span className={`text-sm font-bold ${
                    Math.abs(formData.ownershipShares.reduce((sum, s) => sum + s.percentage, 0) - 100) < 0.01
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {formData.ownershipShares.reduce((sum, s) => sum + s.percentage, 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )}

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
              Initial amount borrowed (current balance will be calculated from payment records)
            </p>
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

            <div className="space-y-2">
              <Label htmlFor="paymentFrequency">Payment Frequency</Label>
              <select
                id="paymentFrequency"
                value={formData.paymentFrequency}
                onChange={handleChange('paymentFrequency')}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maturityDate">Maturity Date (Optional)</Label>
              <Input
                id="maturityDate"
                type="date"
                value={formData.maturityDate}
                onChange={handleChange('maturityDate')}
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
          {liability && liability.payments && liability.payments.length > 0 && (
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-2">
              <h4 className="font-semibold text-sm">Loan Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Original Amount:</p>
                  <p className="font-bold">{formatLKR(Number(formData.originalAmount))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Records:</p>
                  <p className="font-bold text-blue-600">{liability.payments.length}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Note: Current balance is automatically calculated from payment records. Use "Record Payment" to update.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {liability ? 'Update' : 'Add'} Liability
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {liability && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
