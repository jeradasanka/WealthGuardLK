/**
 * Income Management Page
 * Lists and manages all income entries across schedules
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Briefcase, Building2, TrendingUp, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { EmploymentIncomeForm } from '@/components/EmploymentIncomeForm';
import { BusinessIncomeForm } from '@/components/BusinessIncomeForm';
import { InvestmentIncomeForm } from '@/components/InvestmentIncomeForm';
import { formatLKR } from '@/lib/taxEngine';
import type { Income, EmploymentIncome, BusinessIncome, InvestmentIncome } from '@/types';

export function IncomePage() {
  const navigate = useNavigate();
  const incomes = useStore((state) => state.incomes);
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const removeIncome = useStore((state) => state.removeIncome);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [showForm, setShowForm] = useState<'1' | '2' | '3' | null>(null);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  const currentYearIncomes = incomes.filter((i) => i.taxYear === currentTaxYear);

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
              Tax Year {currentTaxYear} • {currentYearIncomes.length} income source(s)
            </p>
          </div>
        </div>

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

        {/* Income List */}
        {currentYearIncomes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No income entries for {currentTaxYear}. Click one of the cards above to add income.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {currentYearIncomes.map((income) => (
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
