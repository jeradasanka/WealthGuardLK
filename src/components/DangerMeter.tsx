/**
 * Danger Meter Component (FR-10)
 * Visual audit risk indicator
 */

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { calculateAuditRisk, formatLKR } from '@/lib/taxEngine';

interface DangerMeterProps {
  estimatedLivingExpenses?: number;
}

export function DangerMeter({ estimatedLivingExpenses = 0 }: DangerMeterProps) {
  const assets = useStore((state) => state.assets);
  const liabilities = useStore((state) => state.liabilities);
  const incomes = useStore((state) => state.incomes);
  const currentTaxYear = useStore((state) => state.currentTaxYear);

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
    <Card className={`border-2 ${getRiskColor()}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getRiskIcon()}
          <span>Audit Risk Meter</span>
        </CardTitle>
        <CardDescription>{getRiskMessage()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Asset Growth</p>
            <p className="text-lg font-bold">{formatLKR(auditRisk.assetGrowth)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Property Expenses</p>
            <p className="text-lg font-bold">{formatLKR(auditRisk.propertyExpenses)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Living Expenses</p>
            <p className="text-lg font-bold">{formatLKR(auditRisk.estimatedLivingExpenses)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Loan Payments</p>
            <p className="text-lg font-bold">{formatLKR(auditRisk.loanPayments)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Declared Income</p>
            <p className="text-lg font-bold">{formatLKR(auditRisk.declaredIncome)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">New Loans</p>
            <p className="text-lg font-bold">{formatLKR(auditRisk.newLoans)}</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
          <p className={`text-2xl font-bold ${auditRisk.riskScore > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatLKR(Math.abs(auditRisk.riskScore))}
            {auditRisk.riskScore > 0 ? ' Unexplained' : ' Surplus'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Formula: (Asset Growth + Property Expenses + Living Expenses + Loan Payments) - (Income + New Loans)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
