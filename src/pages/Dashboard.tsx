/**
 * Dashboard Page
 * Main application interface
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, FileText, Building2, Wallet, TrendingUp, Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DangerMeter } from '@/components/DangerMeter';
import { useStore } from '@/stores/useStore';
import { hasSavedData } from '@/utils/storage';
import { formatLKR } from '@/lib/taxEngine';

export function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  
  const entities = useStore((state) => state.entities);
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const incomes = useStore((state) => state.incomes);
  const currentTaxYear = useStore((state) => state.currentTaxYear);

  useEffect(() => {
    const checkSetup = async () => {
      const hasData = await hasSavedData();
      if (!hasData && entities.length === 0) {
        setNeedsSetup(true);
        navigate('/setup');
      }
      setIsLoading(false);
    };
    checkSetup();
  }, [entities.length, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (needsSetup) {
    return null;
  }

  const totalAssetValue = assets
    .filter((a) => !a.disposed)
    .reduce((sum, a) => sum + a.financials.marketValue, 0);

  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);

  const currentYearIncome = incomes
    .filter((i) => i.taxYear === currentTaxYear)
    .reduce((sum, income) => {
      if (income.schedule === '1') {
        return sum + income.details.grossRemuneration;
      } else if (income.schedule === '2') {
        return sum + income.details.netProfit;
      } else if (income.schedule === '3') {
        return sum + income.details.grossAmount;
      }
      return sum;
    }, 0);

  const netWorth = totalAssetValue - totalLiabilities;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">WealthGuard LK</h1>
                <p className="text-sm text-slate-600">Tax Year {currentTaxYear}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Assets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatLKR(totalAssetValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{assets.length} items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Liabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatLKR(totalLiabilities)}</p>
              <p className="text-xs text-muted-foreground mt-1">{liabilities.length} loans</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Net Worth</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{formatLKR(netWorth)}</p>
              <p className="text-xs text-muted-foreground mt-1">Assets - Liabilities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Income ({currentTaxYear})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{formatLKR(currentYearIncome)}</p>
              <p className="text-xs text-muted-foreground mt-1">{incomes.filter(i => i.taxYear === currentTaxYear).length} sources</p>
            </CardContent>
          </Card>
        </div>

        {/* Danger Meter */}
        <div className="mb-8">
          <DangerMeter />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/income')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Income Schedules
              </CardTitle>
              <CardDescription>Manage employment, business, and investment income</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Schedules</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/assets')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Assets & Liabilities
              </CardTitle>
              <CardDescription>Track property, vehicles, loans, and debts</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Manage Assets & Liabilities</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/tax-computation')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tax Computation
              </CardTitle>
              <CardDescription>View tax calculation and reliefs</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Calculate Tax</Button>
            </CardContent>
          </Card>
        </div>

        {/* Family Members / Individual Taxpayer Cards */}
        {entities.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Family Members</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                Manage Family
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {entities.map((entity, index) => {
                // Calculate stats for this specific entity
                const entityIncomes = incomes.filter((i) => i.ownerId === entity.id);
                const entityAssets = assets.filter((a) => a.ownerId === entity.id && !a.disposed);
                const entityLiabilities = liabilities.filter((l) => l.ownerId === entity.id);
                
                const entityTotalIncome = entityIncomes.reduce((sum, i) => sum + i.details.grossAmount, 0);
                const entityTotalAssets = entityAssets.reduce((sum, a) => sum + a.financials.marketValue, 0);
                const entityTotalLiabilities = entityLiabilities.reduce((sum, l) => sum + l.currentBalance, 0);
                const entityNetWorth = entityTotalAssets - entityTotalLiabilities;
                
                return (
                  <Card key={entity.id} className="border-2">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {index === 0 ? '👤' : '👥'} {entity.name}
                          </CardTitle>
                          <CardDescription>
                            TIN: {entity.tin || 'Not Set'} • {entity.type || 'Individual'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Total Income</p>
                          <p className="text-xl font-bold text-green-600">
                            {formatLKR(entityTotalIncome)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Net Worth</p>
                          <p className="text-xl font-bold text-blue-600">
                            {formatLKR(entityNetWorth)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Assets</p>
                          <p className="text-lg font-semibold">
                            {formatLKR(entityTotalAssets)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Liabilities</p>
                          <p className="text-lg font-semibold text-red-600">
                            {formatLKR(entityTotalLiabilities)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Income Entries: {entityIncomes.length}</span>
                          <span>Assets: {entityAssets.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
