/**
 * Danger Meter Component (FR-10)
 * Visual audit risk indicator
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/stores/useStore';
import { calculateAuditRisk, formatLKR } from '@/lib/taxEngine';
import { AITaxAgentChatbot } from './AITaxAgentChatbot';

interface DangerMeterProps {
  readonly estimatedLivingExpenses?: number;
}

export function DangerMeter({ estimatedLivingExpenses = 0 }: DangerMeterProps) {
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const incomes = useStore((state) => state.incomes);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const [showChatbot, setShowChatbot] = useState(false);

  const auditRisk = useMemo(
    () =>
      calculateAuditRisk(
        assets,
        liabilities,
        incomes,
        currentTaxYear,
        estimatedLivingExpenses
      ),
    [assets, liabilities, incomes, currentTaxYear, estimatedLivingExpenses]
  );

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

  return (
    <>
      <Card className={`border-2 ${getRiskColor()}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              {getRiskIcon()}
              <CardTitle>Audit Risk Meter</CardTitle>
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
      <CardContent className="space-y-4">
        {/* Two Column Layout: Outflows vs Inflows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* OUTFLOWS */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-red-700 border-b pb-2">
              Outflows (Expenses)
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Asset Growth</p>
                <p className="font-semibold">{formatLKR(auditRisk.assetGrowth)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Property Expenses</p>
                <p className="font-semibold">{formatLKR(auditRisk.propertyExpenses)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Living Expenses</p>
                <p className="font-semibold">{formatLKR(auditRisk.estimatedLivingExpenses)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Loan Payments</p>
                <p className="font-semibold">{formatLKR(auditRisk.loanPayments)}</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t font-bold">
                <p className="text-sm">Total Outflows</p>
                <p className="text-red-600">
                  {formatLKR(
                    auditRisk.assetGrowth +
                    auditRisk.propertyExpenses +
                    auditRisk.estimatedLivingExpenses +
                    auditRisk.loanPayments
                  )}
                </p>
              </div>
            </div>
          </div>

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
              <div className="flex justify-between items-center text-orange-600">
                <p className="text-sm">Less: Tax Deducted</p>
                <p className="font-semibold">- {formatLKR(auditRisk.taxDeducted)}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">New Loans</p>
                <p className="font-semibold">{formatLKR(auditRisk.newLoans)}</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t font-bold">
                <p className="text-sm">Total Inflows</p>
                <p className="text-green-600">
                  {formatLKR(
                    auditRisk.totalIncome -
                    auditRisk.taxDeducted +
                    auditRisk.newLoans
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
          <p className={`text-2xl font-bold ${auditRisk.riskScore > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatLKR(Math.abs(auditRisk.riskScore))}
            {auditRisk.riskScore > 0 ? ' Unexplained' : ' Surplus'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Formula: Total Outflows - Total Inflows (after tax)
          </p>
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
