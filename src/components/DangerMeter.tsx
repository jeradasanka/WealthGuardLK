/**
 * Danger Meter Component (FR-10)
 * Visual audit risk indicator with pie chart breakdowns
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/stores/useStore';
import { calculateAuditRisk, formatLKR } from '@/lib/taxEngine';
import { formatTaxYear } from '@/lib/taxYear';
import { AITaxAgentChatbot } from './AITaxAgentChatbot';

interface DangerMeterProps {
  selectedEntityId?: string | 'family';
}

export function DangerMeter({ selectedEntityId = 'family' }: DangerMeterProps) {
  const allAssets = useStore((state) => state.assets);
  const allLiabilities = useStore((state) => state.liabilities);
  const allIncomes = useStore((state) => state.incomes);
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const [showChatbot, setShowChatbot] = useState(false);

  // Get selected entity details
  const selectedEntity = useMemo(() => {
    if (selectedEntityId === 'family') {
      return null;
    }
    return entities.find((e) => e.id === selectedEntityId);
  }, [entities, selectedEntityId]);

  // Filter data based on selected entity (matching Dashboard logic)
  const assets = useMemo(() => {
    if (selectedEntityId === 'family') {
      return allAssets;
    }
    return allAssets.filter((a) => 
      a.ownerId === selectedEntityId || 
      (a.ownershipShares && a.ownershipShares.some((s) => s.entityId === selectedEntityId))
    );
  }, [allAssets, selectedEntityId]);

  const liabilities = useMemo(() => {
    if (selectedEntityId === 'family') {
      return allLiabilities;
    }
    return allLiabilities.filter((l) => {
      // Include liabilities owned directly by this entity
      if (l.ownerId === selectedEntityId) return true;
      // Include liabilities with joint ownership where this entity has a share
      if (l.ownershipShares && l.ownershipShares.some((s) => s.entityId === selectedEntityId)) return true;
      return false;
    });
  }, [allLiabilities, selectedEntityId]);

  const incomes = useMemo(() => {
    if (selectedEntityId === 'family') {
      return allIncomes.filter((i) => i.taxYear === currentTaxYear);
    }
    return allIncomes.filter((i) => i.ownerId === selectedEntityId && i.taxYear === currentTaxYear);
  }, [allIncomes, selectedEntityId, currentTaxYear]);

  const auditRisk = useMemo(
    () =>
      calculateAuditRisk(
        assets,
        liabilities,
        incomes,
        currentTaxYear
      ),
    [assets, liabilities, incomes, currentTaxYear]
  );

  // Calculate total inflows and outflows (excluding living expenses from outflows)
  const totalInflows = auditRisk.totalIncome + auditRisk.newLoans + auditRisk.assetSales;
  const totalOutflowsExcludingLiving = auditRisk.assetGrowth + auditRisk.outflowBreakdown.balanceIncreases + auditRisk.propertyExpenses + auditRisk.loanPayments + auditRisk.taxDeducted;
  
  // Prepare pie chart data with breakdown including living expenses
  const pieChartData = [
    // Inflows breakdown
    { name: 'Employment Income', value: auditRisk.employmentIncome, category: 'inflow', fill: '#10b981' },
    { name: 'Business Income', value: auditRisk.businessIncome, category: 'inflow', fill: '#059669' },
    { name: 'Investment Income', value: auditRisk.investmentIncome, category: 'inflow', fill: '#34d399' },
    { name: 'New Loans', value: auditRisk.newLoans, category: 'inflow', fill: '#6ee7b7' },
    { name: 'Asset Sales', value: auditRisk.assetSales, category: 'inflow', fill: '#a7f3d0' },
    { name: 'Savings Withdrawals', value: auditRisk.inflowBreakdown.balanceDecreases, category: 'inflow', fill: '#bbf7d0' },
    // Outflows breakdown (including living expenses and tax)
    { name: 'Tax Deducted', value: auditRisk.taxDeducted, category: 'outflow', fill: '#f97316' },
    { name: 'Asset Purchases', value: auditRisk.assetGrowth, category: 'outflow', fill: '#ef4444' },
    { name: 'Savings Deposits', value: auditRisk.outflowBreakdown.balanceIncreases, category: 'outflow', fill: '#8b5cf6' },
    { name: 'Property Expenses', value: auditRisk.propertyExpenses, category: 'outflow', fill: '#dc2626' },
    { name: 'Loan Principal', value: auditRisk.outflowBreakdown.loanPrincipal, category: 'outflow', fill: '#f87171' },
    { name: 'Loan Interest', value: auditRisk.outflowBreakdown.loanInterest, category: 'outflow', fill: '#fca5a5' },
    { name: 'Living Expenses', value: auditRisk.derivedLivingExpenses, category: 'outflow', fill: '#fbbf24' },
  ].filter(item => item.value > 0);

  const getRiskColor = () => {
    switch (auditRisk.riskLevel) {
      case 'safe':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'danger':
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getRiskIcon = () => {
    switch (auditRisk.riskLevel) {
      case 'safe':
        return <CheckCircle className="w-8 h-8" />;
      case 'warning':
        return <AlertCircle className="w-8 h-8" />;
      case 'danger':
        return <AlertTriangle className="w-8 h-8" />;
    }
  };

  const getRiskMessage = () => {
    switch (auditRisk.riskLevel) {
      case 'safe':
        return 'Your financial records are balanced. Low audit risk.';
      case 'warning':
        return 'Minor discrepancies detected. Review your source of funds.';
      case 'danger':
        return 'Significant unexplained wealth detected. High audit risk!';
    }
  };

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-gray-600">{formatLKR(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card className={`border-2 ${getRiskColor()}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              {getRiskIcon()}
              <div>
                <CardTitle>Audit Risk Meter</CardTitle>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {selectedEntityId === 'family' ? (
                      <><span className="font-semibold">👨‍👩‍👧‍👦 Combined Family</span> ({entities.length} member{entities.length > 1 ? 's' : ''})</>
                    ) : (
                      <><span className="font-semibold">{selectedEntity?.name || 'Unknown'}</span> {selectedEntity?.tin ? `(TIN: ${selectedEntity.tin})` : ''}</>
                    )}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="font-semibold">Tax Year: {formatTaxYear(currentTaxYear)}</span>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => setShowChatbot(true)}
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
              size="default"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Ask AI Tax Agent</span>
              <span className="sm:hidden">AI Agent</span>
            </Button>
          </div>
          <CardDescription>{getRiskMessage()}</CardDescription>
        </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Layout: Pie Chart on Left, Breakdown Tables on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Single Pie Chart (Inflow vs Outflow) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-center text-sm uppercase tracking-wide">
              Inflow vs Outflow Breakdown
            </h3>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={450}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="45%"
                    labelLine={true}
                    label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                      // Add type guards for optional parameters
                      if (!percent || percent < 0.02) return null; // Hide labels for slices less than 2%
                      if (typeof midAngle !== 'number' || typeof outerRadius !== 'number') return null;
                      if (!cx || !cy) return null;
                      
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 30;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="#374151" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          fontSize="12"
                          fontWeight="500"
                        >
                          {`${name} ${(percent * 100).toFixed(1)}%`}
                        </text>
                      );
                    }}
                    outerRadius={110}
                    innerRadius={0}
                    dataKey="value"
                    startAngle={90}
                    endAngle={450}
                    paddingAngle={1}
                  >
                    {pieChartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[450px] flex items-center justify-center text-gray-400">
                No data for this period
              </div>
            )}
            
            {/* Legend for categories */}
            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="font-medium">Inflows</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="font-medium">Outflows</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                <span className="font-medium">Living Expenses</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Breakdown Tables */}
          <div className="space-y-4">
            {/* INFLOWS */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-green-700 border-b pb-2">
                Inflows (Sources)
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Employment Income</p>
                  <p className="font-semibold">{formatLKR(auditRisk.employmentIncome)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Business Income</p>
                  <p className="font-semibold">{formatLKR(auditRisk.businessIncome)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Investment Income</p>
                  <p className="font-semibold">{formatLKR(auditRisk.investmentIncome)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">New Loans</p>
                  <p className="font-semibold">{formatLKR(auditRisk.newLoans)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Asset Sales</p>
                  <p className="font-semibold">{formatLKR(auditRisk.assetSales)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Savings Withdrawals</p>
                  <p className="font-semibold">{formatLKR(auditRisk.inflowBreakdown.balanceDecreases)}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t font-bold">
                  <p className="text-sm">Total Inflows</p>
                  <p className="text-green-600">{formatLKR(totalInflows)}</p>
                </div>
              </div>
            </div>

            {/* OUTFLOWS */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-red-700 border-b pb-2">
                Outflows (Expenses)
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Tax Deducted (APIT/WHT)</p>
                  <p className="font-semibold">{formatLKR(auditRisk.taxDeducted)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Asset Purchases</p>
                  <p className="font-semibold">{formatLKR(auditRisk.assetGrowth)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Savings Deposits</p>
                  <p className="font-semibold">{formatLKR(auditRisk.outflowBreakdown.balanceIncreases)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Property Expenses</p>
                  <p className="font-semibold">{formatLKR(auditRisk.propertyExpenses)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Loan Principal</p>
                  <p className="font-semibold">{formatLKR(auditRisk.outflowBreakdown.loanPrincipal)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Loan Interest</p>
                  <p className="font-semibold">{formatLKR(auditRisk.outflowBreakdown.loanInterest)}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t font-bold">
                  <p className="text-sm">Total Outflows</p>
                  <p className="text-red-600">{formatLKR(totalOutflowsExcludingLiving)}</p>
                </div>
              </div>
            </div>

            {/* Balance Calculation */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Total Inflows:</span>
                  <span className="font-semibold text-green-700">{formatLKR(totalInflows)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Total Outflows:</span>
                  <span className="font-semibold text-red-700">- {formatLKR(totalOutflowsExcludingLiving)}</span>
                </div>
                <div className="border-t-2 border-blue-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-900">Living Expenses (Balance):</span>
                    <span className="font-bold text-lg text-blue-900">{formatLKR(auditRisk.derivedLivingExpenses)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t bg-gray-50 p-4 rounded-lg">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground mb-2">Audit Risk Score</p>
            {auditRisk.riskScore !== 0 && (
              <>
                <p className={`text-3xl font-bold ${auditRisk.riskScore > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatLKR(Math.abs(auditRisk.riskScore))}
                  {auditRisk.riskScore > 0 ? ' Unexplained' : ' Surplus'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Living Expenses = Inflows - Outflows (excl. living) | Risk = Total Outflows - Total Inflows
                </p>
              </>
            )}
            {auditRisk.riskScore === 0 && (
              <>
                <p className="text-2xl font-bold text-gray-600">Balanced</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Total inflows match total outflows (including living expenses)
                </p>
              </>
            )}
          </div>
        </div>

        {/* AI Tax Agent CTA */}
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Need Tax Planning Advice?</h4>
              <p className="text-sm text-gray-600 mb-3">
                Get personalized recommendations from our AI Tax Agent. Analyze your situation, discover optimization opportunities, and ensure compliance.
              </p>
              <Button 
                onClick={() => setShowChatbot(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Start AI Tax Consultation
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <AITaxAgentChatbot 
      open={showChatbot}
      onClose={() => setShowChatbot(false)}
      defaultTaxYear={currentTaxYear}
    />
    </>
  );
}
