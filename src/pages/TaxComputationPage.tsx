/**
 * Tax Computation Page (FR-09, FR-10)
 * Displays Schedule 8 tax computation with progressive rates and reliefs
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Calculator, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { computeTax, getTaxBreakdown, calculateDerivedInvestmentIncome } from '@/lib/taxEngine';
import { DangerMeter } from '@/components/DangerMeter';
import { IrdBookmarkletCard } from '@/components/IrdBookmarkletCard';
import { buildFullIrdPayloadFromStore } from '@/utils/bookmarkletGenerator';
import { formatTaxYear } from '@/lib/taxYear';
import { EmploymentIncome, BusinessIncome, InvestmentIncome, OtherIncome } from '@/types';

export function TaxComputationPage() {
  const navigate = useNavigate();
  const { entities, incomes, assets, liabilities, currentTaxYear, certificates } = useStore();
  const [selectedEntityId, setSelectedEntityId] = useState<string>(() => entities[0]?.id || 'all');

  const activeEntityId =
    selectedEntityId !== 'all' && entities.some((e) => e.id === selectedEntityId)
      ? selectedEntityId
      : entities.length === 1
        ? entities[0].id
        : selectedEntityId;

  const filteredIncomes = useMemo(
    () =>
      incomes.filter(
        (i) =>
          (!i.taxYear || i.taxYear === currentTaxYear) &&
          (activeEntityId === 'all' || i.ownerId === activeEntityId)
      ),
    [incomes, currentTaxYear, activeEntityId]
  );

  const filteredAssets = useMemo(
    () =>
      assets.filter((a) => {
        if (activeEntityId === 'all') return true;
        if (a.ownerId === activeEntityId) return true;
        return a.ownershipShares?.some((s) => s.entityId === activeEntityId) ?? false;
      }),
    [assets, activeEntityId]
  );

  const filteredLiabilities = useMemo(
    () =>
      liabilities.filter((l) => {
        if (activeEntityId === 'all') return true;
        if (l.ownerId === activeEntityId) return true;
        return l.ownershipShares?.some((s) => s.entityId === activeEntityId) ?? false;
      }),
    [liabilities, activeEntityId]
  );

  const filteredCertificates = useMemo(
    () =>
      certificates.filter(
        (c) =>
          (!c.taxYear || c.taxYear === currentTaxYear) &&
          (activeEntityId === 'all' || c.ownerId === activeEntityId)
      ),
    [certificates, currentTaxYear, activeEntityId]
  );

  const taxComputation = computeTax(
    filteredIncomes,
    filteredAssets,
    currentTaxYear,
    0,
    filteredCertificates
  );
  const taxBreakdown = getTaxBreakdown(taxComputation.taxableIncome, currentTaxYear);
  const totalReliefs = taxComputation.reliefs.personalRelief + taxComputation.reliefs.solarRelief;
  const totalTaxCredits = taxComputation.taxCredits.apit + taxComputation.taxCredits.wht;

  // Group filtered incomes by schedule and calculate totals
  const employmentIncomes = filteredIncomes.filter((i) => i.schedule === '1');
  const businessIncomes = filteredIncomes.filter((i) => i.schedule === '2');
  const investmentIncomes = filteredIncomes.filter((i) => i.schedule === '3');
  const otherIncomes = filteredIncomes.filter((i) => i.schedule === '4');

  // Get derived income from assets (bank interest and stock dividends)
  const derivedIncomes = calculateDerivedInvestmentIncome(filteredAssets, currentTaxYear);
  const derivedInterest = derivedIncomes.filter(d => d.type === 'interest').reduce((sum, d) => sum + d.amount, 0);
  const derivedDividends = derivedIncomes.filter(d => d.type === 'dividend').reduce((sum, d) => sum + d.amount, 0);
  const derivedTotal = derivedInterest + derivedDividends;

  const employmentTotal = employmentIncomes.reduce((sum, i) => {
    const emp = i as EmploymentIncome;
    const gross = (emp.details.grossRemuneration || 0) + (emp.details.nonCashBenefits || 0);
    return sum + Math.max(0, gross - (emp.details.exemptIncome || 0));
  }, 0);
  const businessTotal = businessIncomes.reduce((sum, i) => {
    const bus = i as BusinessIncome;
    return sum + (bus.details.netProfit || 0);
  }, 0);
  const investmentTotal = investmentIncomes.reduce((sum, i) => {
    const inv = i as InvestmentIncome;
    return sum + (inv.details.grossAmount || 0);
  }, 0);
  const otherTotal = otherIncomes.reduce((sum, i) => {
    const other = i as OtherIncome;
    return sum + Math.max(0, (other.details.grossAmount || 0) - (other.details.exemptAmount || 0));
  }, 0);

  const irdPayload = useMemo(
    () =>
      buildFullIrdPayloadFromStore({
        incomes: filteredIncomes,
        assets: filteredAssets,
        liabilities: filteredLiabilities,
        certificates: filteredCertificates,
        currentTaxYear,
        computation: taxComputation,
        derivedInterest,
        derivedDividends,
      }),
    [
      filteredIncomes,
      filteredAssets,
      filteredLiabilities,
      filteredCertificates,
      currentTaxYear,
      taxComputation,
      derivedInterest,
      derivedDividends,
    ]
  );

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
              <p className="text-gray-600">Schedule 8 - Income Tax Calculation ({formatTaxYear(currentTaxYear)})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {entities.length > 0 && (
              <select
                aria-label="Select Taxpayer"
                value={activeEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              >
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} ({entity.tin || 'No TIN'})
                  </option>
                ))}
                {entities.length > 1 && <option value="all">All Family Members Combined</option>}
              </select>
            )}
            <Calculator className="h-8 w-8 text-blue-600" />
          </div>
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
                  <span className="text-gray-700">Schedule 3: Investment Income (Manual)</span>
                  <span className="font-mono">Rs. {investmentTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                </div>
                {derivedTotal > 0 && (
                  <>
                    <div className="pl-4 space-y-1 bg-blue-50 py-2 rounded">
                      <p className="text-xs text-blue-700 font-semibold mb-1">+ Derived from Assets:</p>
                      {derivedInterest > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-600">Bank Interest (from balances)</span>
                          <span className="font-mono text-blue-900">Rs. {derivedInterest.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {derivedDividends > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-600">Stock Dividends (from holdings)</span>
                          <span className="font-mono text-blue-900">Rs. {derivedDividends.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-gray-700">Schedule 4: Other Income</span>
                  <span className="font-mono">Rs. {otherTotal.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
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

        {/* IRD RAMIS Auto-Fill Bookmarklet */}
        <IrdBookmarkletCard
          taxData={irdPayload}
          taxYearLabel={formatTaxYear(currentTaxYear)}
        />
      </div>
    </div>
  );
}
