/**
 * Tax Computation Page (FR-09, FR-10)
 * Displays Schedule 8 tax computation with progressive rates and reliefs
 */

import { ArrowLeft, Calculator, FileText, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { computeTax } from '@/lib/taxEngine';
import { DangerMeter } from '@/components/DangerMeter';

export function TaxComputationPage() {
  const navigate = useNavigate();
  const { entities, incomes, assets, liabilities } = useStore();

  const entity = entities[0];
  const totalAssets = assets.reduce((sum, a) => sum + a.marketValue, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const personalRelief = 1200000; // Rs. 1.2M standard relief

  const taxComputation = computeTax(incomes, totalAssets, totalLiabilities, assets, liabilities, personalRelief);

  // Group incomes by schedule
  const employmentIncomes = incomes.filter((i) => i.type === 'employment');
  const businessIncomes = incomes.filter((i) => i.type === 'business');
  const investmentIncomes = incomes.filter((i) => i.type === 'investment');

  const employmentTotal = employmentIncomes.reduce((sum, i) => sum + i.details.grossAmount, 0);
  const businessTotal = businessIncomes.reduce((sum, i) => sum + i.details.grossAmount, 0);
  const investmentTotal = investmentIncomes.reduce((sum, i) => sum + i.details.grossAmount, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Tax Computation</h1>
              <p className="text-gray-600">Schedule 8 - Income Tax Calculation</p>
            </div>
          </div>
          <Calculator className="h-8 w-8 text-blue-600" />
        </div>

        {/* Danger Meter */}
        <DangerMeter />

        {/* Schedule 8: Income Tax Computation */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule 8 - Income Tax Computation</CardTitle>
            <CardDescription>Tax Year: {entity.taxYear}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Part A: Income from All Sources */}
            <div>
              <h3 className="font-semibold text-lg mb-3 border-b pb-2">Part A: Income from All Sources</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">Schedule 1: Employment Income</span>
                  <span className="font-mono">Rs. {employmentTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">Schedule 2: Business Income</span>
                  <span className="font-mono">Rs. {businessTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">Schedule 3: Investment Income</span>
                  <span className="font-mono">Rs. {investmentTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-300 font-semibold text-lg">
                  <span>Total Gross Income</span>
                  <span className="font-mono">Rs. {taxComputation.totalIncome.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Part B: Reliefs */}
            <div>
              <h3 className="font-semibold text-lg mb-3 border-b pb-2">Part B: Tax Reliefs</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">Personal Relief (Cage 401)</span>
                  <span className="font-mono">Rs. {personalRelief.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                {taxComputation.totalReliefs > personalRelief && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">Other Reliefs (Cage 316 Rent, etc.)</span>
                    <span className="font-mono">
                      Rs. {(taxComputation.totalReliefs - personalRelief).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-t font-semibold">
                  <span>Total Reliefs</span>
                  <span className="font-mono">Rs. {taxComputation.totalReliefs.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Part C: Taxable Income */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">Taxable Income (A - B)</span>
                <span className="font-mono text-xl font-bold text-blue-600">
                  Rs. {taxComputation.taxableIncome.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Part D: Progressive Tax Calculation */}
            <div>
              <h3 className="font-semibold text-lg mb-3 border-b pb-2">Part D: Progressive Tax Calculation</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">First Rs. 500,000 @ 6%</span>
                  <span className="font-mono text-sm">
                    {taxComputation.taxableIncome > 0 
                      ? `Rs. ${Math.min(taxComputation.taxableIncome, 500000) * 0.06}`.toLocaleString('en-LK', { minimumFractionDigits: 2 })
                      : 'Rs. 0.00'}
                  </span>
                </div>
                {taxComputation.taxableIncome > 500000 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Next Rs. 500,000 @ 12%</span>
                    <span className="font-mono text-sm">
                      Rs. {(Math.min(taxComputation.taxableIncome - 500000, 500000) * 0.12).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {taxComputation.taxableIncome > 1000000 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Next Rs. 500,000 @ 18%</span>
                    <span className="font-mono text-sm">
                      Rs. {(Math.min(taxComputation.taxableIncome - 1000000, 500000) * 0.18).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {taxComputation.taxableIncome > 1500000 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Next Rs. 500,000 @ 24%</span>
                    <span className="font-mono text-sm">
                      Rs. {(Math.min(taxComputation.taxableIncome - 1500000, 500000) * 0.24).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {taxComputation.taxableIncome > 2000000 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Next Rs. 500,000 @ 30%</span>
                    <span className="font-mono text-sm">
                      Rs. {(Math.min(taxComputation.taxableIncome - 2000000, 500000) * 0.30).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {taxComputation.taxableIncome > 2500000 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Balance @ 36%</span>
                    <span className="font-mono text-sm">
                      Rs. {((taxComputation.taxableIncome - 2500000) * 0.36).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-t-2 border-gray-300 font-semibold text-lg">
                  <span>Tax on Taxable Income</span>
                  <span className="font-mono">Rs. {taxComputation.taxBeforeCredits.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Part E: Tax Credits */}
            <div>
              <h3 className="font-semibold text-lg mb-3 border-b pb-2">Part E: Tax Credits</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">APIT Deducted (Cage 903)</span>
                  <span className="font-mono">Rs. {taxComputation.totalTaxCredits.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">WHT Deducted (Cage 908)</span>
                  <span className="font-mono">Rs. 0.00</span>
                </div>
                <div className="flex justify-between py-3 border-t font-semibold">
                  <span>Total Tax Credits</span>
                  <span className="font-mono">Rs. {taxComputation.totalTaxCredits.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Part F: Final Tax Payable */}
            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Final Tax Payable/Refundable</p>
                  <p className="font-semibold text-2xl">
                    {taxComputation.finalTaxPayable >= 0 ? 'Tax Payable' : 'Tax Refund'}
                  </p>
                </div>
                <span className={`font-mono text-3xl font-bold ${
                  taxComputation.finalTaxPayable >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  Rs. {Math.abs(taxComputation.finalTaxPayable).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Summary Note */}
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
              <p className="font-medium mb-2">Important Notes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>This computation is for reference only and does not constitute official tax advice.</li>
                <li>Always consult with a qualified tax professional before filing your return.</li>
                <li>Ensure all income sources and deductions are accurately declared.</li>
                <li>Keep supporting documents (WHT certificates, receipts) for at least 6 years.</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button className="flex-1" onClick={() => window.print()}>
                <FileText className="mr-2 h-4 w-4" />
                Print Computation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
