/**
 * Liability Payment Form Component
 * Allows recording annual/periodic payments on liabilities
 */

import { useState } from 'react';
import { Liability, LiabilityPayment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLKR } from '@/lib/taxEngine';
import { X, Plus, Trash2 } from 'lucide-react';

interface LiabilityPaymentFormProps {
  liability: Liability;
  onSave: (updatedLiability: Liability) => void;
  onClose: () => void;
}

export function LiabilityPaymentForm({ liability, onSave, onClose }: LiabilityPaymentFormProps) {
  const currentYear = new Date().getFullYear();
  const [currentLiability, setCurrentLiability] = useState(liability);
  const [taxYear, setTaxYear] = useState(currentYear);
  const [principalPaid, setPrincipalPaid] = useState('0');
  const [interestPaid, setInterestPaid] = useState('0');
  const [notes, setNotes] = useState('');

  const totalPaid = Number(principalPaid) + Number(interestPaid);
  const balanceAfterPayment = currentLiability.currentBalance - Number(principalPaid);

  // Check if payment already exists for this year
  const existingPayment = currentLiability.payments?.find((p: LiabilityPayment) => p.taxYear === taxYear);

  const handleAddPayment = () => {
    if (!taxYear || Number(principalPaid) < 0 || Number(interestPaid) < 0) {
      alert('Please provide valid payment details');
      return;
    }

    if (Number(principalPaid) > currentLiability.currentBalance) {
      alert('Principal payment cannot exceed current balance');
      return;
    }

    if (existingPayment) {
      alert(`A payment already exists for tax year ${taxYear}. Please delete it first or choose a different year.`);
      return;
    }

    const date = `${taxYear}-12-31`; // Use end of year as default date

    const newPayment: LiabilityPayment = {
      id: `payment-${Date.now()}`,
      date,
      principalPaid: Number(principalPaid),
      interestPaid: Number(interestPaid),
      totalPaid,
      balanceAfterPayment,
      taxYear,
      notes: notes || undefined,
    };

    const updatedLiability: Liability = {
      ...currentLiability,
      currentBalance: balanceAfterPayment,
      payments: [...(currentLiability.payments || []), newPayment],
    };

    setCurrentLiability(updatedLiability);
    onSave(updatedLiability);
    
    // Reset form
    setPrincipalPaid('0');
    setInterestPaid('0');
    setNotes('');
    setTaxYear(currentYear);
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) {
      return;
    }

    const payments = currentLiability.payments || [];
    const paymentIndex = payments.findIndex((p: LiabilityPayment) => p.id === paymentId);
    
    if (paymentIndex === -1) return;

    // Recalculate balance by removing this and subsequent payments
    const updatedPayments = payments.filter((p: LiabilityPayment) => p.id !== paymentId);
    
    // Recalculate current balance
    let recalculatedBalance = currentLiability.originalAmount;
    for (const payment of updatedPayments) {
      recalculatedBalance -= payment.principalPaid;
      payment.balanceAfterPayment = recalculatedBalance;
    }

    const updatedLiability: Liability = {
      ...currentLiability,
      currentBalance: recalculatedBalance,
      payments: updatedPayments,
    };

    setCurrentLiability(updatedLiability);
    onSave(updatedLiability);
  };

  const calculateInterestSuggestion = () => {
    if (!currentLiability.interestRate || !taxYear) return 0;
    
    // Simply calculate annual interest on current balance
    const interest = currentLiability.currentBalance * (currentLiability.interestRate / 100);
    return Math.round(interest);
  };

  const suggestedInterest = calculateInterestSuggestion();

  // Generate year options (from liability acquired year to current year + 1)
  const startYear = new Date(currentLiability.dateAcquired).getFullYear();
  const yearOptions = [];
  for (let year = startYear; year <= currentYear + 1; year++) {
    yearOptions.push(year);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Record Payment - {currentLiability.description}</CardTitle>
              <CardDescription>
                Lender: {currentLiability.lenderName} | Current Balance: {formatLKR(currentLiability.currentBalance)}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Payment Section */}
          <div className="bg-slate-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-lg">Add New Payment</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taxYear">Tax Year</Label>
                <select
                  id="taxYear"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={taxYear}
                  onChange={(e) => setTaxYear(Number(e.target.value))}
                >
                  <option value="">Select Year</option>
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label htmlFor="principalPaid">Principal Paid (Rs.)</Label>
                <Input
                  id="principalPaid"
                  type="number"
                  step="0.01"
                  min="0"
                  max={liability.currentBalance}
                  value={principalPaid}
                  onChange={(e) => setPrincipalPaid(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="interestPaid">Interest Paid (Rs.)</Label>
                <div className="flex gap-2">
                  <Input
                    id="interestPaid"
                    type="number"
                    step="0.01"
                    min="0"
                    value={interestPaid}
                    onChange={(e) => setInterestPaid(e.target.value)}
                  />
                  {currentLiability.interestRate && suggestedInterest > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInterestPaid(suggestedInterest.toString())}
                      title={`Suggested based on ${currentLiability.interestRate}% interest rate`}
                    >
                      Use {formatLKR(suggestedInterest)}
                    </Button>
                  )}
                </div>
                {currentLiability.interestRate && (
                  <p className="text-xs text-slate-500 mt-1">
                    Interest Rate: {currentLiability.interestRate}% per annum
                  </p>
                )}
              </div>
              
              <div>
                <Label>Total Payment</Label>
                <div className="mt-2 text-lg font-semibold text-blue-600">
                  {formatLKR(totalPaid)}
                </div>
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="e.g., Annual payment for tax year 2024"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white rounded border">
              <div>
                <p className="text-sm text-slate-600">Balance After Payment:</p>
                <p className="text-xl font-bold text-green-600">{formatLKR(balanceAfterPayment)}</p>
              </div>
              <Button onClick={handleAddPayment} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Payment
              </Button>
            </div>
          </div>

          {/* Payment History */}
          {currentLiability.payments && currentLiability.payments.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3">Payment History</h3>
              <div className="space-y-2">
                {[...currentLiability.payments].reverse().map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{new Date(payment.date).toLocaleDateString('en-LK')}</p>
                          <p className="text-xs text-slate-500">Tax Year {payment.taxYear}</p>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-600">Principal:</span>{' '}
                          <span className="font-medium">{formatLKR(payment.principalPaid)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-600">Interest:</span>{' '}
                          <span className="font-medium">{formatLKR(payment.interestPaid)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-600">Total:</span>{' '}
                          <span className="font-semibold text-blue-600">{formatLKR(payment.totalPaid)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-600">Balance After:</span>{' '}
                          <span className="font-medium">{formatLKR(payment.balanceAfterPayment)}</span>
                        </div>
                      </div>
                      {payment.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic">{payment.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePayment(payment.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2">Liability Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-600">Original Amount:</p>
                <p className="font-semibold">{formatLKR(currentLiability.originalAmount)}</p>
              </div>
              <div>
                <p className="text-slate-600">Total Paid (Principal):</p>
                <p className="font-semibold text-green-600">
                  {formatLKR(currentLiability.originalAmount - currentLiability.currentBalance)}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Current Balance:</p>
                <p className="font-semibold text-orange-600">{formatLKR(currentLiability.currentBalance)}</p>
              </div>
            </div>
            {currentLiability.payments && currentLiability.payments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-slate-600 text-sm">Total Interest Paid:</p>
                <p className="font-semibold text-red-600">
                  {formatLKR(currentLiability.payments.reduce((sum: number, p: LiabilityPayment) => sum + p.interestPaid, 0))}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
