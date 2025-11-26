/**
 * Income Management Page
 * Lists and manages all income entries across schedules
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Briefcase, Building2, TrendingUp, ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { EmploymentIncomeForm } from '@/components/EmploymentIncomeForm';
import { BusinessIncomeForm } from '@/components/BusinessIncomeForm';
import { formatLKR, calculateTotalIncome } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart } from '@/lib/taxYear';
import type { Income, EmploymentIncome, BusinessIncome, InvestmentIncome } from '@/types';

export function IncomePage() {
  const navigate = useNavigate();
  const incomes = useStore((state) => state.incomes);
  const assets = useStore((state) => state.assets);
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const setCurrentTaxYear = useStore((state) => state.setCurrentTaxYear);
  const removeIncome = useStore((state) => state.removeIncome);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [showForm, setShowForm] = useState<'1' | '2' | '3' | null>(null);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [showTaxCalculator, setShowTaxCalculator] = useState(false);
  const [manualTaxDeducted, setManualTaxDeducted] = useState<number>(0);
  const [selectedEntityForTax, setSelectedEntityForTax] = useState<string | null>(null);

  const currentYearIncomes = incomes.filter((i) => i.taxYear === currentTaxYear);
  const startYear = entities.length > 0 ? (entities[0]?.taxYear || '2024') : '2024';
  const availableTaxYears = getTaxYearsFromStart(startYear);

  // Calculate investment income from assets
  const derivedInvestmentIncome = (() => {
    const income: { type: 'interest' | 'dividend' | 'rent'; amount: number; source: string; wht: number; ownerId: string }[] = [];
    
    assets
      .filter((asset) => {
        // Filter assets for current tax year
        const acquiredDate = new Date(asset.meta.dateAcquired);
        const taxYearStart = new Date(`${parseInt(currentTaxYear)}-04-01`);
        const taxYearEnd = new Date(`${parseInt(currentTaxYear) + 1}-03-31`);
        
        if (acquiredDate > taxYearEnd) return false;
        if (asset.disposed && asset.disposed.date) {
          const disposedDate = new Date(asset.disposed.date);
          if (disposedDate < taxYearStart) return false;
        }
        if (asset.closed && asset.closed.date) {
          const closedDate = new Date(asset.closed.date);
          if (closedDate < taxYearStart) return false;
        }
        return true;
      })
      .forEach((asset) => {
        // Extract interest from bank accounts, cash, and loans given
        if ((asset.cageCategory === 'Bii' || asset.cageCategory === 'Biv' || asset.cageCategory === 'Bv') && asset.balances) {
          const yearBalance = asset.balances.find((b) => b.taxYear === currentTaxYear);
          if (yearBalance && yearBalance.interestEarned > 0) {
            income.push({
              type: 'interest',
              amount: yearBalance.interestEarned,
              source: asset.meta.accountType ? `${asset.meta.bankName || 'Account'} - ${asset.meta.accountType}` : asset.meta.bankName || 'Interest Income',
              wht: 0, // WHT for interest is typically 0 for most deposits
              ownerId: asset.ownerId,
            });
          }
        }
        
        // Extract dividends from shares
        if (asset.cageCategory === 'Biii' && asset.balances) {
          const yearBalance = asset.balances.find((b) => b.taxYear === currentTaxYear);
          if (yearBalance && yearBalance.interestEarned > 0) {
            income.push({
              type: 'dividend',
              amount: yearBalance.interestEarned,
              source: asset.meta.companyName || 'Dividend Income',
              wht: 0,
              ownerId: asset.ownerId,
            });
          }
        }
      });
    
    return income;
  })();

  const getEntityName = (ownerId: string) => {
    return entities.find((e) => e.id === ownerId)?.name || 'Unknown';
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this income entry?')) {
      removeIncome(id);
      await saveToStorage();
    }
  };

  const handleEdit = (income: Income) => {
    // Prevent editing Schedule 3 (Investment Income)
    if (income.schedule === '3') {
      alert('Investment income is managed through the Assets & Liabilities page. Please go to Assets page to modify interest, dividend, and rental income.');
      return;
    }
    setEditingIncome(income);
    setShowForm(income.schedule);
  };

  const handleFormClose = () => {
    setShowForm(null);
    setEditingIncome(null);
  };

  const getIncomeAmount = (income: Income): number => {
    if (income.schedule === '1') {
      const emp = income as EmploymentIncome;
      return emp.details.grossRemuneration + emp.details.nonCashBenefits;
    } else if (income.schedule === '2') {
      const bus = income as BusinessIncome;
      return bus.details.netProfit;
    } else if (income.schedule === '3') {
      const inv = income as InvestmentIncome;
      return inv.details.grossAmount;
    }
    return 0;
  };

  const getIncomeIcon = (schedule: string) => {
    switch (schedule) {
      case '1':
        return <Briefcase className="w-5 h-5" />;
      case '2':
        return <Building2 className="w-5 h-5" />;
      case '3':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getIncomeTypeLabel = (income: Income): string => {
    if (income.schedule === '1') return 'Employment';
    if (income.schedule === '2') return 'Business';
    if (income.schedule === '3') {
      const inv = income as InvestmentIncome;
      return `Investment (${inv.type})`;
    }
    return 'Unknown';
  };

  if (showForm) {
    if (showForm === '3') {
      // Redirect back for Schedule 3
      setShowForm(null);
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <p className="text-lg font-semibold">Investment Income Management</p>
                <p className="text-muted-foreground">
                  Investment income (interest, dividends, and rental income) is automatically calculated from your assets and liabilities records.
                </p>
                <p className="text-sm text-muted-foreground">
                  To record or modify investment income sources, please go to the Assets & Liabilities page where you can:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 max-w-md mx-auto">
                  <li>• Add interest earned on bank accounts and loans given</li>
                  <li>• Record dividend income from shares</li>
                  <li>• Record rental income from immovable properties</li>
                </ul>
                <Button variant="outline" onClick={() => navigate('/')}>
                  ← Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-3xl mx-auto">
          <Button variant="outline" onClick={handleFormClose} className="mb-4">
            ← Back to Income List
          </Button>
          {showForm === '1' && (
            <EmploymentIncomeForm
              income={editingIncome as EmploymentIncome}
              onSave={handleFormClose}
              onCancel={handleFormClose}
            />
          )}
          {showForm === '2' && (
            <BusinessIncomeForm
              income={editingIncome as BusinessIncome}
              onSave={handleFormClose}
              onCancel={handleFormClose}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Income Management</h1>
            <p className="text-muted-foreground">
              {currentYearIncomes.length} income source(s)
            </p>
          </div>
        </div>

        {/* Tax Year and Profile Selection */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Tax Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Tax Year</label>
                <select
                  value={currentTaxYear}
                  onChange={(e) => setCurrentTaxYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableTaxYears.map((year) => (
                    <option key={year} value={year}>
                      {formatTaxYear(year)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tax Profile (Individual/Company)</label>
                <select
                  value={selectedEntityForTax || ''}
                  onChange={(e) => setSelectedEntityForTax(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Entities</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Income Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-blue-200"
            onClick={() => setShowForm('1')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                Schedule 1
              </CardTitle>
              <CardDescription>Employment Income</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Employment Income
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-green-200"
            onClick={() => setShowForm('2')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600" />
                Schedule 2
              </CardTitle>
              <CardDescription>Business Income</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Business Income
              </Button>
            </CardContent>
          </Card>

          <Card
            className="border-2 border-purple-200 bg-purple-50 opacity-75"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Schedule 3
              </CardTitle>
              <CardDescription>Investment Income</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Investment income is automatically derived from your assets.
                </p>
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate('/assets')}
                >
                  Manage in Assets
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tax Calculator Section */}
        <Card className="mb-8 bg-amber-50 border-amber-200">
          <CardHeader className="cursor-pointer" onClick={() => setShowTaxCalculator(!showTaxCalculator)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tax Calculator
              </CardTitle>
              <ChevronDown className={`w-5 h-5 transition-transform ${showTaxCalculator ? 'rotate-180' : ''}`} />
            </div>
            <CardDescription>View total income and calculate tax deductions</CardDescription>
          </CardHeader>
          {showTaxCalculator && (
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Employment Income */}
                <div className="p-4 bg-white rounded-lg border border-blue-200">
                  <p className="text-sm text-muted-foreground mb-1">Employment Income (Schedule 1)</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatLKR(currentYearIncomes
                      .filter((i) => i.schedule === '1' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                      .reduce((sum, i) => sum + (((i as EmploymentIncome).details.grossRemuneration + (i as EmploymentIncome).details.nonCashBenefits) || 0), 0)
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    APIT: {formatLKR(currentYearIncomes
                      .filter((i) => i.schedule === '1' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                      .reduce((sum, i) => sum + ((i as EmploymentIncome).details.apitDeducted || 0), 0)
                    )}
                  </p>
                </div>

                {/* Business Income */}
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-sm text-muted-foreground mb-1">Business Income (Schedule 2)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatLKR(currentYearIncomes
                      .filter((i) => i.schedule === '2' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                      .reduce((sum, i) => sum + ((i as BusinessIncome).details.netProfit || 0), 0)
                    )}
                  </p>
                </div>

                {/* Investment Income */}
                <div className="p-4 bg-white rounded-lg border border-purple-200">
                  <p className="text-sm text-muted-foreground mb-1">Investment Income (Schedule 3)</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatLKR(
                      derivedInvestmentIncome
                        .filter((i) => !selectedEntityForTax || i.ownerId === selectedEntityForTax)
                        .reduce((sum, i) => sum + i.amount, 0)
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    From Assets • {derivedInvestmentIncome.filter((i) => !selectedEntityForTax || i.ownerId === selectedEntityForTax).length} source(s)
                  </p>
                </div>
              </div>

              {/* Total Income and Tax Calculation */}
              <div className="p-4 bg-white rounded-lg border-2 border-amber-300 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Total Income Calculation</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Employment Income (APIT)</span>
                      <span className="font-semibold">
                        {formatLKR(currentYearIncomes
                          .filter((i) => i.schedule === '1' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                          .reduce((sum, i) => sum + (((i as EmploymentIncome).details.grossRemuneration + (i as EmploymentIncome).details.nonCashBenefits) || 0), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Business Income</span>
                      <span className="font-semibold">
                        {formatLKR(currentYearIncomes
                          .filter((i) => i.schedule === '2' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                          .reduce((sum, i) => sum + ((i as BusinessIncome).details.netProfit || 0), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Investment Income (from Assets)</span>
                      <span className="font-semibold">
                        {formatLKR(
                          derivedInvestmentIncome
                            .filter((i) => !selectedEntityForTax || i.ownerId === selectedEntityForTax)
                            .reduce((sum, i) => sum + i.amount, 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <p className="font-bold">Total Assessable Income</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {formatLKR(
                        currentYearIncomes
                          .filter((i) => i.schedule !== '3' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                          .reduce((sum, i) => sum + getIncomeAmount(i), 0) +
                        derivedInvestmentIncome
                          .filter((i) => !selectedEntityForTax || i.ownerId === selectedEntityForTax)
                          .reduce((sum, i) => sum + i.amount, 0)
                      )}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <p className="text-sm font-semibold">Tax Deduction (Manual Entry)</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={manualTaxDeducted}
                      onChange={(e) => setManualTaxDeducted(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="Enter tax already deducted"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Entered</p>
                      <p className="font-bold text-lg text-amber-700">{formatLKR(manualTaxDeducted)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Note: This is the actual tax already deducted (APIT + WHT). Update this field with the total tax you've already paid.
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Income List */}
        {/* Derived Investment Income Section */}
        {derivedInvestmentIncome.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold">Investment Income (Derived from Assets)</h2>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Auto-calculated</span>
            </div>
            <div className="space-y-3">
              {derivedInvestmentIncome
                .filter((income) => !selectedEntityForTax || income.ownerId === selectedEntityForTax)
                .map((income, idx) => (
                <Card key={`derived-${idx}`} className="border-l-4 border-l-purple-500 opacity-75 bg-purple-50">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold">
                            {income.type === 'interest' && 'Interest Income'}
                            {income.type === 'dividend' && 'Dividend Income'}
                            {income.type === 'rent' && 'Rental Income'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getEntityName(income.ownerId)} • {income.source}
                          </p>
                          <p className="text-xs text-purple-600 mt-1">
                            Derived from Assets & Liabilities page
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-bold text-lg text-purple-600">
                          {formatLKR(income.amount)}
                        </p>
                        {income.wht > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            WHT: {formatLKR(income.wht)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Manual Income List */}
        {currentYearIncomes.filter((i) => i.schedule !== '3').length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No manual income entries for {formatTaxYear(currentTaxYear)}. Click one of the cards above to add employment or business income.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-4">Manual Income Entries</h2>
            <div className="space-y-4">
              {currentYearIncomes
                .filter((i) => i.schedule !== '3' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                .map((income) => (
              <Card key={income.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        {getIncomeIcon(income.schedule)}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {getIncomeTypeLabel(income)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getEntityName(income.ownerId)}
                          {income.schedule === '1' && ` • ${(income as EmploymentIncome).details.employerName}`}
                          {income.schedule === '2' && ` • ${(income as BusinessIncome).details.businessName}`}
                          {income.schedule === '3' && ` • ${(income as InvestmentIncome).details.source}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-bold text-lg text-green-600">
                          {formatLKR(getIncomeAmount(income))}
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          {income.schedule === '1' && `Tax: ${formatLKR((income as EmploymentIncome).details.apitDeducted)}`}
                          {income.schedule === '3' && `WHT: ${formatLKR((income as InvestmentIncome).details.whtDeducted)}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(income)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(income.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
