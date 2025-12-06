/**
 * Income Management Page
 * Lists and manages all income entries across schedules
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Briefcase, Building2, TrendingUp, ArrowLeft, ChevronDown, Calculator, FileText, CheckCircle2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStore } from '@/stores/useStore';
import { EmploymentIncomeForm } from '@/components/EmploymentIncomeForm';
import { BusinessIncomeForm } from '@/components/BusinessIncomeForm';
import { IncomeSchedulePDFImportWizard } from '@/components/IncomeSchedulePDFImportWizard';
import { formatLKR, calculateTotalIncome, calculateDerivedInvestmentIncome, computeTax, getTaxConfig } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart } from '@/lib/taxYear';
import type { Income, EmploymentIncome, BusinessIncome, InvestmentIncome } from '@/types';

export function IncomePage() {
  const navigate = useNavigate();
  const incomes = useStore((state) => state.incomes);
  const assets = useStore((state) => state.assets);
  const certificates = useStore((state) => state.certificates);
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const setCurrentTaxYear = useStore((state) => state.setCurrentTaxYear);
  const removeIncome = useStore((state) => state.removeIncome);
  const updateEntity = useStore((state) => state.updateEntity);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [showForm, setShowForm] = useState<'1' | '2' | '3' | null>(null);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [showTaxCalculator, setShowTaxCalculator] = useState(false);
  const [showTaxBreakdownDialog, setShowTaxBreakdownDialog] = useState(false);
  const [showPdfImportWizard, setShowPdfImportWizard] = useState(false);
  const [manualTaxPayable, setManualTaxPayable] = useState<number>(0);
  const [manualTotalTax, setManualTotalTax] = useState<number>(0);
  const [selectedEntityForTax, setSelectedEntityForTax] = useState<string | null>(null);

  const currentYearIncomes = incomes.filter((i) => i.taxYear === currentTaxYear);
  const startYear = entities.length > 0 ? (entities[0]?.taxYear || '2024') : '2024';
  const availableTaxYears = getTaxYearsFromStart(startYear);

  // Calculate investment income from assets
  const derivedInvestmentIncome = calculateDerivedInvestmentIncome(assets, currentTaxYear);

  // Calculate total income summary for the selected entity (or all)
  const filteredIncomes = currentYearIncomes.filter(i => !selectedEntityForTax || i.ownerId === selectedEntityForTax);
  const filteredAssets = assets.filter(a => !selectedEntityForTax || a.ownerId === selectedEntityForTax);
  const incomeSummary = calculateTotalIncome(filteredIncomes, filteredAssets, currentTaxYear, certificates);
  
  // Calculate estimated tax
  const taxComputation = computeTax(filteredIncomes, filteredAssets, currentTaxYear, 0, certificates);

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

  // Load manual tax payable when entity or tax year changes
  useEffect(() => {
    if (selectedEntityForTax) {
      const entity = entities.find(e => e.id === selectedEntityForTax);
      if (entity) {
        setManualTaxPayable(entity.taxPayable?.[currentTaxYear] || 0);
        setManualTotalTax(entity.totalTaxOnIncome?.[currentTaxYear] || 0);
      } else {
        setManualTaxPayable(0);
        setManualTotalTax(0);
      }
    } else {
      // Sum of all entities' values for this year
      const totalPayable = entities.reduce((sum, e) => {
        return sum + (e.taxPayable?.[currentTaxYear] || 0);
      }, 0);
      const totalTax = entities.reduce((sum, e) => {
        return sum + (e.totalTaxOnIncome?.[currentTaxYear] || 0);
      }, 0);
      setManualTaxPayable(totalPayable);
      setManualTotalTax(totalTax);
    }
  }, [selectedEntityForTax, currentTaxYear, entities]);

  const handleManualTaxChange = async (amount: number) => {
    setManualTaxPayable(amount);
    
    if (selectedEntityForTax) {
      const entity = entities.find(e => e.id === selectedEntityForTax);
      if (entity) {
        const updatedPayable = {
          ...(entity.taxPayable || {}),
          [currentTaxYear]: amount
        };
        updateEntity(entity.id, { taxPayable: updatedPayable });
        await saveToStorage();
      }
    }
  };

  const handleTotalTaxChange = async (amount: number) => {
    setManualTotalTax(amount);
    
    if (selectedEntityForTax) {
      const entity = entities.find(e => e.id === selectedEntityForTax);
      if (entity) {
        const updatedTotalTax = {
          ...(entity.totalTaxOnIncome || {}),
          [currentTaxYear]: amount
        };
        updateEntity(entity.id, { totalTaxOnIncome: updatedTotalTax });
        await saveToStorage();
      }
    }
  };

  const handleUseCalculatedTax = async () => {
    setShowTaxBreakdownDialog(true);
  };

  const handleUpdateFromCalculator = async () => {
    const calculatedTax = taxComputation?.taxOnIncome || 0;
    await handleTotalTaxChange(calculatedTax);
    setShowTaxBreakdownDialog(false);
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
          <Button onClick={() => setShowPdfImportWizard(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import from PDF (T10)
          </Button>
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

        {/* Tax Summary & Payment Section */}
        <Card className="mb-8 border-amber-200 shadow-md">
          <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-4">
            <CardTitle className="text-xl text-amber-900">Tax Summary & Report</CardTitle>
            <CardDescription>Official tax computation for {formatTaxYear(currentTaxYear)}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {/* Total Assessable Income */}
              <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Total assessable income (Rs.)</span>
                <span className="text-lg font-bold text-slate-900">
                  {(taxComputation?.assessableIncome || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Personal Relief */}
              <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Personal relief (Rs.)</span>
                <span className="text-lg font-bold text-slate-900">
                  {(taxComputation?.reliefs?.personalRelief || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Taxable Income */}
              <div className="flex justify-between items-center py-3 px-4 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-semibold text-blue-900">Taxable income (Rs.)</span>
                <span className="text-lg font-bold text-blue-700">
                  {(taxComputation?.taxableIncome || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Total Tax Payable - Manual Entry with Calculator Option */}
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-700">Total tax payable (Rs.)</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUseCalculatedTax}
                    disabled={!selectedEntityForTax}
                    className="text-xs"
                  >
                    Use Calculator
                  </Button>
                </div>
                <input
                  type="number"
                  value={manualTotalTax || ''}
                  onChange={(e) => handleTotalTaxChange(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder={selectedEntityForTax ? "Enter or use calculator" : "Select entity"}
                  disabled={!selectedEntityForTax}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-muted-foreground">
                    {!selectedEntityForTax 
                      ? "Select entity to edit" 
                      : `Calculator estimate: ${(taxComputation?.taxOnIncome || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>

              {/* Tax Credits */}
              <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Less: Tax credits (Rs.)</span>
                <span className="text-lg font-bold text-orange-600">
                  {((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0)).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Balance Tax Payable - Calculated from Manual Total Tax - Tax Credits */}
              <div className="flex justify-between items-center py-3 px-4 bg-amber-50 rounded-lg border border-amber-300">
                <span className="font-semibold text-amber-900">Balance tax payable (Rs.)</span>
                <span className="text-xl font-bold text-amber-700">
                  {Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="border-t-2 border-dashed border-slate-300 my-4"></div>

              {/* Manual Entry Section */}
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tax Already Paid (Manual Entry)
                </label>
                <input
                  type="number"
                  value={manualTaxPayable || ''}
                  onChange={(e) => handleManualTaxChange(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder={selectedEntityForTax ? "Enter amount already paid" : "Select an entity to edit"}
                  disabled={!selectedEntityForTax}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {!selectedEntityForTax 
                    ? "Select a specific tax profile above to enter payment information." 
                    : "Enter the tax amount you have already paid for this year."}
                </p>
              </div>

              {/* Final Balance */}
              <div className={`flex justify-between items-center py-4 px-4 rounded-lg border-2 ${
                Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable > 0 
                  ? 'bg-red-50 border-red-300' 
                  : Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable < 0
                  ? 'bg-green-50 border-green-300'
                  : 'bg-slate-50 border-slate-300'
              }`}>
                <span className={`font-bold text-lg ${
                  Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable > 0 
                    ? 'text-red-900' 
                    : Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable < 0
                    ? 'text-green-900'
                    : 'text-slate-900'
                }`}>
                  {Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable < 0 
                    ? 'Refund claimed (Rs.)' 
                    : 'Still to pay (Rs.)'}
                </span>
                <span className={`text-2xl font-bold ${
                  Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable > 0 
                    ? 'text-red-600' 
                    : Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable < 0
                    ? 'text-green-600'
                    : 'text-slate-600'
                }`}>
                  {Math.abs(Math.max(0, (manualTotalTax || 0) - ((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0))) - manualTaxPayable).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Breakdown Calculator Dialog */}
        <Dialog open={showTaxBreakdownDialog} onOpenChange={setShowTaxBreakdownDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tax Calculation Breakdown - {formatTaxYear(currentTaxYear)}</DialogTitle>
              <DialogDescription>
                Detailed progressive tax calculation based on IRD rates
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Income Summary */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3">Income Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Assessable Income:</span>
                    <span className="font-bold">{(taxComputation?.assessableIncome || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Personal Relief:</span>
                    <span className="font-bold text-orange-600">- {(taxComputation?.reliefs?.personalRelief || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-300">
                    <span className="font-semibold">Taxable Income:</span>
                    <span className="font-bold text-blue-700">{(taxComputation?.taxableIncome || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Progressive Tax Breakdown */}
              {(() => {
                const config = getTaxConfig(currentTaxYear);
                const taxableIncome = taxComputation?.taxableIncome || 0;
                const breakdown: { slab: string; income: number; rate: number; tax: number }[] = [];
                let previousLimit = 0;
                let remainingIncome = taxableIncome;

                config.brackets.forEach((bracket, index) => {
                  if (remainingIncome <= 0) return;
                  
                  const slabIncome = Math.min(
                    remainingIncome,
                    bracket.limit - previousLimit
                  );
                  
                  const slabTax = slabIncome * bracket.rate;
                  
                  if (slabIncome > 0) {
                    const slabLabel = index === 0 
                      ? `First Rs. ${bracket.limit.toLocaleString('en-LK')}` 
                      : bracket.limit === Infinity
                      ? `Balance over Rs. ${previousLimit.toLocaleString('en-LK')}`
                      : `Next Rs. ${(bracket.limit - previousLimit).toLocaleString('en-LK')}`;
                    
                    breakdown.push({
                      slab: slabLabel,
                      income: slabIncome,
                      rate: bracket.rate,
                      tax: slabTax
                    });
                  }
                  
                  remainingIncome -= slabIncome;
                  previousLimit = bracket.limit;
                });

                return (
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h3 className="font-semibold text-amber-900 mb-3">Progressive Tax Calculation</h3>
                    <div className="space-y-3">
                      {breakdown.map((item, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-amber-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">{item.slab}</span>
                            <span className="text-sm font-bold text-amber-700">{(item.rate * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Taxable: Rs. {item.income.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="font-semibold">Tax: Rs. {item.tax.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex justify-between pt-3 border-t-2 border-amber-300">
                        <span className="font-bold text-amber-900">Total Tax on Income:</span>
                        <span className="text-xl font-bold text-amber-700">
                          Rs. {(taxComputation?.taxOnIncome || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tax Credits */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-900 mb-3">Tax Credits</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>APIT (Advance Personal Income Tax):</span>
                    <span className="font-bold">{((taxComputation?.taxCredits?.apit || 0)).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>WHT (Withholding Tax):</span>
                    <span className="font-bold">{((taxComputation?.taxCredits?.wht || 0)).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-green-300">
                    <span className="font-semibold">Total Credits:</span>
                    <span className="font-bold text-green-700">{((taxComputation?.taxCredits?.apit || 0) + (taxComputation?.taxCredits?.wht || 0)).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Final Result */}
              <div className="bg-slate-100 p-4 rounded-lg border-2 border-slate-300">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-900">Balance Tax Payable:</span>
                  <span className="text-2xl font-bold text-slate-700">
                    Rs. {(taxComputation?.taxPayable || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTaxBreakdownDialog(false)}>
                Close
              </Button>
              <Button onClick={handleUpdateFromCalculator} disabled={!selectedEntityForTax}>
                Update Total Tax Payable
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tax Calculator Section (Support Tool) */}
        <Card className="mb-8 bg-slate-50 border-slate-200">
          <CardHeader className="cursor-pointer" onClick={() => setShowTaxCalculator(!showTaxCalculator)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-600">
                <Calculator className="w-5 h-5" />
                Income Breakdown & Calculator
              </CardTitle>
              <ChevronDown className={`w-5 h-5 transition-transform ${showTaxCalculator ? 'rotate-180' : ''}`} />
            </div>
            <CardDescription>View detailed breakdown of income sources</CardDescription>
          </CardHeader>
          {showTaxCalculator && (
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Employment Income */}
                <div className="p-4 bg-white rounded-lg border border-blue-200">
                  <p className="text-sm text-muted-foreground mb-1">Employment Income (Schedule 1)</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatLKR(incomeSummary.employmentIncome)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    APIT: {formatLKR(incomeSummary.totalAPIT)}
                  </p>
                </div>

                {/* Business Income */}
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="text-sm text-muted-foreground mb-1">Business Income (Schedule 2)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatLKR(incomeSummary.businessIncome)}
                  </p>
                </div>

                {/* Investment Income */}
                <div className="p-4 bg-white rounded-lg border border-purple-200">
                  <p className="text-sm text-muted-foreground mb-1">Investment Income (Schedule 3)</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatLKR(incomeSummary.investmentIncome)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    From Assets • {derivedInvestmentIncome.filter((i) => !selectedEntityForTax || i.ownerId === selectedEntityForTax).length} source(s)
                  </p>
                </div>
              </div>
              
              {/* Tax Credits Breakdown */}
              {(() => {
                const yearCertificates = certificates.filter(cert => 
                  cert.taxYear === currentTaxYear && 
                  (!selectedEntityForTax || cert.ownerId === selectedEntityForTax)
                );
                
                const apitFromCerts = yearCertificates
                  .filter(c => c.type === 'employment')
                  .reduce((sum, c) => sum + c.details.taxDeducted, 0);
                
                const whtByType = {
                  interest: yearCertificates.filter(c => c.type === 'interest').reduce((sum, c) => sum + c.details.taxDeducted, 0),
                  dividend: yearCertificates.filter(c => c.type === 'dividend').reduce((sum, c) => sum + c.details.taxDeducted, 0),
                  rent: yearCertificates.filter(c => c.type === 'rent').reduce((sum, c) => sum + c.details.taxDeducted, 0),
                  other: yearCertificates.filter(c => c.type === 'other').reduce((sum, c) => sum + c.details.taxDeducted, 0),
                };
                
                const totalWHT = Object.values(whtByType).reduce((sum, val) => sum + val, 0);
                const totalTaxCredits = incomeSummary.totalAPIT + apitFromCerts + totalWHT;
                
                if (totalTaxCredits > 0) {
                  return (
                    <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <h4 className="text-sm font-semibold text-amber-900 mb-3">Tax Credits Available (Cage 903 & 908)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* APIT Section */}
                        <div className="bg-white p-3 rounded border border-amber-100">
                          <p className="text-xs text-muted-foreground mb-1">APIT (Cage 903)</p>
                          <p className="text-lg font-bold text-amber-700">{formatLKR(incomeSummary.totalAPIT + apitFromCerts)}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            {incomeSummary.totalAPIT > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>From Employment Income:</span>
                                <span className="font-medium">{formatLKR(incomeSummary.totalAPIT)}</span>
                              </div>
                            )}
                            {apitFromCerts > 0 && (
                              <div className="flex justify-between text-amber-600">
                                <span>From Certificates ({yearCertificates.filter(c => c.type === 'employment').length}):</span>
                                <span className="font-medium">{formatLKR(apitFromCerts)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* WHT Section */}
                        <div className="bg-white p-3 rounded border border-amber-100">
                          <p className="text-xs text-muted-foreground mb-1">WHT (Cage 908)</p>
                          <p className="text-lg font-bold text-amber-700">{formatLKR(totalWHT)}</p>
                          <div className="mt-2 space-y-1 text-xs">
                            {whtByType.interest > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Interest ({yearCertificates.filter(c => c.type === 'interest').length}):</span>
                                <span className="font-medium">{formatLKR(whtByType.interest)}</span>
                              </div>
                            )}
                            {whtByType.dividend > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Dividend ({yearCertificates.filter(c => c.type === 'dividend').length}):</span>
                                <span className="font-medium">{formatLKR(whtByType.dividend)}</span>
                              </div>
                            )}
                            {whtByType.rent > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Rent ({yearCertificates.filter(c => c.type === 'rent').length}):</span>
                                <span className="font-medium">{formatLKR(whtByType.rent)}</span>
                              </div>
                            )}
                            {whtByType.other > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Other ({yearCertificates.filter(c => c.type === 'other').length}):</span>
                                <span className="font-medium">{formatLKR(whtByType.other)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-amber-200 text-center">
                        <span className="text-sm font-semibold text-amber-900">Total Tax Credits: {formatLKR(totalTaxCredits)}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                 Total Income: {formatLKR(incomeSummary.totalIncome)}
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
                  <div>
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
                    {(() => {
                      const linkedCerts = certificates.filter(cert => cert.relatedIncomeId === income.id && cert.taxYear === currentTaxYear);
                      if (linkedCerts.length > 0) {
                        return (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-slate-500" />
                              <span className="text-xs font-medium text-slate-600">Linked Certificates ({linkedCerts.length})</span>
                            </div>
                            <div className="space-y-1.5">
                              {linkedCerts.map(cert => (
                                <div key={cert.id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {cert.verified && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                                    <span className="text-xs font-medium text-slate-700">{cert.certificateNo}</span>
                                    <span className="text-xs text-slate-500">•</span>
                                    <span className="text-xs text-slate-600">{cert.details.payerName}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-600">Gross: {formatLKR(cert.details.grossAmount)}</span>
                                    <span className="text-red-600 font-medium">Tax: {formatLKR(cert.details.taxDeducted)}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => navigate(`/certificates/edit/${cert.id}`)}
                                    >
                                      View
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Income Schedule PDF Import Wizard */}
      <IncomeSchedulePDFImportWizard
        open={showPdfImportWizard}
        onClose={() => setShowPdfImportWizard(false)}
      />
    </div>
  );
}
