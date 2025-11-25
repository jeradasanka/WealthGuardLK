/**
 * Export Dialog (FR-11)
 * Handles data export: encrypted backup, WHT Schedule 7 CSV, summary report
 */

import { useState } from 'react';
import { Download, FileDown, FileText, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useStore } from '@/stores/useStore';
import { downloadBackup, downloadSchedule7CSV, generateSummaryReport, downloadSummaryReport } from '@/utils/export';
import { computeTax } from '@/lib/taxEngine';
import type { InvestmentIncome } from '@/types';

interface ExportDialogProps {
  onClose: () => void;
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const { entities, incomes, assets, liabilities, passphrase, saveToStorage } = useStore();
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const entity = entities[0]; // Primary entity
  const investmentIncomes = incomes.filter((i) => i.type === 'investment') as InvestmentIncome[];
  const hasWHT = investmentIncomes.some((i) => i.details.whtDeducted > 0);

  const totalIncome = incomes.reduce((sum, i) => sum + i.details.grossAmount, 0);
  const totalAssets = assets.reduce((sum, a) => sum + a.marketValue, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const taxComputation = computeTax(incomes, totalAssets, totalLiabilities, assets, liabilities, 1200000);

  const handleBackupExport = async () => {
    if (!exportPassphrase) {
      setError('Please enter your passphrase');
      return;
    }

    if (exportPassphrase !== passphrase) {
      setError('Incorrect passphrase');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Save current state to storage before exporting
      await saveToStorage();
      await downloadBackup(exportPassphrase);
      alert('Backup downloaded successfully');
    } catch (err) {
      setError('Failed to export backup');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule7Export = () => {
    if (!hasWHT) {
      alert('No WHT deductions found. You need investment income with WHT to export Schedule 7.');
      return;
    }

    try {
      downloadSchedule7CSV(investmentIncomes, entity.taxYear, entity.tin || 'UNKNOWN');
      alert('Schedule 7 CSV downloaded successfully');
    } catch (err) {
      alert('Failed to export Schedule 7');
    }
  };

  const handleSummaryExport = () => {
    const report = generateSummaryReport(
      entity.name,
      entity.tin || 'N/A',
      entity.taxYear,
      totalIncome,
      totalAssets,
      totalLiabilities,
      taxComputation.finalTaxPayable
    );
    downloadSummaryReport(report, entity.tin || 'TAXPAYER', entity.taxYear);
    alert('Summary report downloaded successfully');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>Download backups and IRD submission files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Encrypted Backup */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <FileDown className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium">Encrypted Backup</h4>
                <p className="text-sm text-gray-600">
                  Download all your data as an encrypted .wgbak file
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="exportPassphrase">Confirm Passphrase</Label>
              <Input
                id="exportPassphrase"
                type="password"
                placeholder="Enter your passphrase"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
              />
              {error && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}
            </div>
            <Button onClick={handleBackupExport} disabled={loading} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {loading ? 'Exporting...' : 'Download Backup'}
            </Button>
          </div>

          {/* Schedule 7 CSV */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium">IRD Schedule 7 (WHT)</h4>
                <p className="text-sm text-gray-600">
                  Export WHT certificate details for IRD submission
                </p>
                {hasWHT ? (
                  <p className="text-xs text-green-600 mt-1">
                    {investmentIncomes.filter((i) => i.details.whtDeducted > 0).length} WHT entries found
                  </p>
                ) : (
                  <p className="text-xs text-yellow-600 mt-1">No WHT deductions to export</p>
                )}
              </div>
            </div>
            <Button onClick={handleSchedule7Export} disabled={!hasWHT} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download Schedule 7 CSV
            </Button>
          </div>

          {/* Summary Report */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium">Tax Summary Report</h4>
                <p className="text-sm text-gray-600">
                  Plain text summary of income, assets, and tax computation
                </p>
              </div>
            </div>
            <Button onClick={handleSummaryExport} variant="outline" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download Summary Report
            </Button>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
