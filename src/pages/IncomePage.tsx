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
import { InvestmentIncomeForm } from '@/components/InvestmentIncomeForm';
import { formatLKR, calculateTotalIncome } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart } from '@/lib/taxYear';
import type { Income, EmploymentIncome, BusinessIncome, InvestmentIncome } from '@/types';

export function IncomePage() {
  const navigate = useNavigate();
  const incomes = useStore((state) => state.incomes);
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
  const availableTaxYears = getTaxYearsFromStart();

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this income entry?')) {
      removeIncome(id);
      await saveToStorage();
    }
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setShowForm(income.schedule);
  };

  const handleFormClose = () => {
    setShowForm(null);
    setEditingIncome(null);
  };

  const getEntityName = (ownerId: string) => {
    return entities.find((e) => e.id === ownerId)?.name || 'Unknown';
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
          {showForm === '3' && (
            <InvestmentIncomeForm
              income={editingIncome as InvestmentIncome}
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
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-purple-200"
            onClick={() => setShowForm('3')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Schedule 3
              </CardTitle>
              <CardDescription>Investment Income</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Investment Income
              </Button>
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
                    {formatLKR(currentYearIncomes
                      .filter((i) => i.schedule === '3' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                      .reduce((sum, i) => sum + ((i as InvestmentIncome).details.grossAmount || 0), 0)
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    WHT: {formatLKR(currentYearIncomes
                      .filter((i) => i.schedule === '3' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                      .reduce((sum, i) => sum + ((i as InvestmentIncome).details.whtDeducted || 0), 0)
                    )}
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
                      <span>Investment Income (WHT)</span>
                      <span className="font-semibold">
                        {formatLKR(currentYearIncomes
                          .filter((i) => i.schedule === '3' && (!selectedEntityForTax || i.ownerId === selectedEntityForTax))
                          .reduce((sum, i) => sum + ((i as InvestmentIncome).details.grossAmount || 0), 0)
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
                          .filter((i) => !selectedEntityForTax || i.ownerId === selectedEntityForTax)
                          .reduce((sum, i) => sum + getIncomeAmount(i), 0)
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
        {currentYearIncomes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No income entries for {formatTaxYear(currentTaxYear)}. Click one of the cards above to add income.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {currentYearIncomes
              .filter((i) => !selectedEntityForTax || i.ownerId === selectedEntityForTax)
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
        )}
      </div>
    </div>
  );
}
