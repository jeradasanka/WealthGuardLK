/**
 * Source of Funds Wizard (FR-07)
 * Multi-step wizard for linking asset acquisitions to funding sources
 */

import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import type { Asset, FundingSource } from '@/types';
import { useStore } from '@/stores/useStore';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface SourceOfFundsWizardProps {
  asset: Asset;
  onComplete: (fundingSources: FundingSource[]) => void;
  onCancel: () => void;
}

export function SourceOfFundsWizard({ asset, onComplete, onCancel }: SourceOfFundsWizardProps) {
  const { entities, incomes, assets, liabilities } = useStore();
  const [step, setStep] = useState(1);
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);
  const [currentSource, setCurrentSource] = useState<Partial<FundingSource>>({ type: 'current-income' });

  const totalFunded = fundingSources.reduce((sum, fs) => sum + fs.amount, 0);
  const remaining = asset.cost - totalFunded;
  const isFullyFunded = remaining <= 0;

  // Available options for funding sources
  const availableIncomes = incomes.filter(
    (income) => new Date(income.period.endDate) >= new Date(asset.purchaseDate)
  );
  const availableAssets = assets.filter(
    (a) => a.id !== asset.id && a.disposed && new Date(a.disposed.date) <= new Date(asset.purchaseDate)
  );
  const availableLoans = liabilities.filter(
    (l) => new Date(l.date) <= new Date(asset.purchaseDate)
  );

  const handleAddSource = () => {
    if (!currentSource.type || !currentSource.amount || currentSource.amount <= 0) {
      alert('Please enter valid funding details');
      return;
    }

    if (currentSource.amount > remaining) {
      alert(`Amount exceeds remaining cost (Rs. ${remaining.toLocaleString('en-LK')})`);
      return;
    }

    const newSource: FundingSource = {
      type: currentSource.type as FundingSource['type'],
      amount: currentSource.amount,
      description: currentSource.description || '',
      relatedId: currentSource.relatedId,
    };

    setFundingSources([...fundingSources, newSource]);
    setCurrentSource({ type: 'current-income' });
  };

  const handleRemoveSource = (index: number) => {
    setFundingSources(fundingSources.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (!isFullyFunded) {
      const proceed = confirm(
        `Warning: Asset cost (Rs. ${asset.cost.toLocaleString('en-LK')}) exceeds declared funding sources (Rs. ${totalFunded.toLocaleString('en-LK')}). This will increase audit risk. Continue?`
      );
      if (!proceed) return;
    }
    onComplete(fundingSources);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Source of Funds</CardTitle>
              <CardDescription>
                Explain how you funded: {asset.description} (Rs. {asset.cost.toLocaleString('en-LK')})
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Funding Progress</span>
              <span className={remaining > 0 ? 'text-red-600' : 'text-green-600'}>
                {isFullyFunded ? 'Fully Funded' : `Rs. ${remaining.toLocaleString('en-LK')} remaining`}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  isFullyFunded ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min((totalFunded / asset.cost) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Rs. {totalFunded.toLocaleString('en-LK')}</span>
              <span>Rs. {asset.cost.toLocaleString('en-LK')}</span>
            </div>
          </div>

          {/* Step 1: Add Funding Sources */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fundingType">Funding Source Type</Label>
                <select
                  id="fundingType"
                  className="w-full px-3 py-2 border rounded-md"
                  value={currentSource.type}
                  onChange={(e) => setCurrentSource({ ...currentSource, type: e.target.value as FundingSource['type'] })}
                >
                  <option value="current-income">Current Year Income</option>
                  <option value="asset-sale">Sale of Another Asset</option>
                  <option value="loan">Loan/Borrowing</option>
                  <option value="gift">Gift/Inheritance</option>
                  <option value="savings">Previous Years' Savings</option>
                </select>
              </div>

              {/* Related Entity Selection */}
              {currentSource.type === 'current-income' && availableIncomes.length > 0 && (
                <div>
                  <Label htmlFor="relatedIncome">Select Income Source (Optional)</Label>
                  <select
                    id="relatedIncome"
                    className="w-full px-3 py-2 border rounded-md"
                    value={currentSource.relatedId || ''}
                    onChange={(e) => setCurrentSource({ ...currentSource, relatedId: e.target.value })}
                  >
                    <option value="">-- Not Specified --</option>
                    {availableIncomes.map((income) => (
                      <option key={income.id} value={income.id}>
                        {income.type === 'employment'
                          ? `Employment: ${income.details.employer}`
                          : income.type === 'business'
                          ? `Business: ${income.details.businessName}`
                          : `Investment: ${income.details.source}`}{' '}
                        - Rs. {income.details.grossAmount.toLocaleString('en-LK')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentSource.type === 'asset-sale' && availableAssets.length > 0 && (
                <div>
                  <Label htmlFor="relatedAsset">Select Asset Sold</Label>
                  <select
                    id="relatedAsset"
                    className="w-full px-3 py-2 border rounded-md"
                    value={currentSource.relatedId || ''}
                    onChange={(e) => setCurrentSource({ ...currentSource, relatedId: e.target.value })}
                  >
                    <option value="">-- Not Specified --</option>
                    {availableAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.description} - Sale Price: Rs. {a.disposed?.salePrice.toLocaleString('en-LK')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentSource.type === 'loan' && availableLoans.length > 0 && (
                <div>
                  <Label htmlFor="relatedLoan">Select Loan</Label>
                  <select
                    id="relatedLoan"
                    className="w-full px-3 py-2 border rounded-md"
                    value={currentSource.relatedId || ''}
                    onChange={(e) => setCurrentSource({ ...currentSource, relatedId: e.target.value })}
                  >
                    <option value="">-- Not Specified --</option>
                    {availableLoans.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.description} - Rs. {l.originalAmount.toLocaleString('en-LK')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="amount">Amount (Rs.)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={currentSource.amount || ''}
                  onChange={(e) => setCurrentSource({ ...currentSource, amount: parseFloat(e.target.value) })}
                />
                {remaining > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    Remaining to allocate: Rs. {remaining.toLocaleString('en-LK')}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description/Notes (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Additional details..."
                  value={currentSource.description || ''}
                  onChange={(e) => setCurrentSource({ ...currentSource, description: e.target.value })}
                />
              </div>

              <Button onClick={handleAddSource} disabled={!currentSource.amount || currentSource.amount <= 0}>
                <ArrowRight className="mr-2 h-4 w-4" />
                Add Funding Source
              </Button>

              {/* Added Sources List */}
              {fundingSources.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Declared Funding Sources</h4>
                  <div className="space-y-2">
                    {fundingSources.map((source, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium capitalize">
                            {source.type.replace('-', ' ')}
                          </p>
                          {source.description && (
                            <p className="text-sm text-gray-600">{source.description}</p>
                          )}
                          <p className="text-sm font-semibold">
                            Rs. {source.amount.toLocaleString('en-LK')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSource(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning for unexplained wealth */}
              {!isFullyFunded && fundingSources.length > 0 && (
                <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Unexplained Wealth Warning</p>
                    <p className="text-sm text-yellow-700">
                      Rs. {remaining.toLocaleString('en-LK')} of this asset's cost is not explained by declared funding sources. 
                      This will increase your audit risk score.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={fundingSources.length === 0}>
              {isFullyFunded ? 'Complete' : 'Save Anyway'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
