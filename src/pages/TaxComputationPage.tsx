/**
 * Tax Computation Page (FR-09, FR-10)
 * Displays Schedule 8 tax computation with progressive rates and reliefs
 */

import { ArrowLeft, Calculator, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { computeTax, getTaxBreakdown } from '@/lib/taxEngine';
import { DangerMeter } from '@/components/DangerMeter';
import { formatTaxYear } from '@/lib/taxYear';
import { EmploymentIncome, BusinessIncome, InvestmentIncome } from '@/types';

export function TaxComputationPage() {
  const navigate = useNavigate();
  const { incomes, assets, currentTaxYear, certificates } = useStore();

  const taxComputation = computeTax(incomes, assets, currentTaxYear, 0, certificates);
  const taxBreakdown = getTaxBreakdown(taxComputation.taxableIncome, currentTaxYear);
  const totalReliefs = taxComputation.reliefs.personalRelief + taxComputation.reliefs.solarRelief;
  const totalTaxCredits = taxComputation.taxCredits.apit + taxComputation.taxCredits.wht;

  // Group incomes by schedule and calculate totals
  const employmentIncomes = incomes.filter((i) => i.schedule === '1');
  const businessIncomes = incomes.filter((i) => i.schedule === '2');
  const investmentIncomes = incomes.filter((i) => i.schedule === '3');

  const employmentTotal = employmentIncomes.reduce((sum, i) => {
    const emp = i as EmploymentIncome;
    return sum + (emp.details.grossRemuneration || 0) + (emp.details.nonCashBenefits || 0);
  }, 0);
  const businessTotal = businessIncomes.reduce((sum, i) => {
    const bus = i as BusinessIncome;
    return sum + (bus.details.netProfit || 0);
  }, 0);
  const investmentTotal = investmentIncomes.reduce((sum, i) => {
    const inv = i as InvestmentIncome;
    return sum + (inv.details.grossAmount || 0);
  }, 0);

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
            <CardDescription>Tax Year: {formatTaxYear(currentTaxYear)}</CardDescription>
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
                  <span className="font-mono">Rs. {taxComputation.reliefs.personalRelief.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                {taxComputation.reliefs.solarRelief > 0 && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-700">Solar Relief</span>
                    <span className="font-mono">
                      Rs. {taxComputation.reliefs.solarRelief.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-t font-semibold">
                  <span>Total Reliefs</span>
                  <span className="font-mono">Rs. {totalReliefs.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
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
                {taxBreakdown.map((bracket, index) => (
                  <div key={index} className="flex justify-between py-2">
                    <span className="text-gray-600">{bracket.range} @ {bracket.rate}</span>
                    <span className="font-mono text-sm">
                      Rs. {bracket.tax.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between py-3 border-t-2 border-gray-300 font-semibold text-lg">
                  <span>Tax on Taxable Income</span>
                  <span className="font-mono">Rs. {taxComputation.taxOnIncome.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Part E: Tax Credits */}
            <div>
              <h3 className="font-semibold text-lg mb-3 border-b pb-2">Part E: Tax Credits</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">APIT Deducted (Cage 903)</span>
                  <span className="font-mono">Rs. {taxComputation.taxCredits.apit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">WHT Deducted (Cage 908)</span>
                  <span className="font-mono">Rs. {taxComputation.taxCredits.wht.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-3 border-t font-semibold">
                  <span>Total Tax Credits</span>
                  <span className="font-mono">Rs. {totalTaxCredits.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Part F: Final Tax Payable */}
            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Final Tax Payable/Refundable</p>
                  <p className="font-semibold text-2xl">
                    {taxComputation.taxPayable >= 0 ? 'Tax Payable' : 'Tax Refund'}
                  </p>
                </div>
                <span className={`font-mono text-3xl font-bold ${
                  taxComputation.taxPayable >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  Rs. {Math.abs(taxComputation.taxPayable).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
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
