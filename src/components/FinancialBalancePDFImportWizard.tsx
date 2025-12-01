/**
 * Financial Balance PDF Import Wizard
 * 3-step wizard for importing bank statements and financial balance data
 */

import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useStore } from '@/stores/useStore';
import { parseFinancialBalancePdf, type ParsedFinancialBalance } from '@/utils/financialBalancePdfParser';
import { fetchAvailableGeminiModels, FALLBACK_GEMINI_MODELS } from '@/utils/geminiPdfParser';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart } from '@/lib/taxYear';

interface FinancialBalancePDFImportWizardProps {
  open: boolean;
  onClose: () => void;
  preSelectedAssetId?: string; // Asset to import balances for
}

type Step = 'upload' | 'preview' | 'complete';

export function FinancialBalancePDFImportWizard({ 
  open, 
  onClose,
  preSelectedAssetId 
}: FinancialBalancePDFImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(preSelectedAssetId || '');
  const [availableModels, setAvailableModels] = useState<Array<{ value: string; label: string; description: string }>>([...FALLBACK_GEMINI_MODELS]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [taxYearOverrides, setTaxYearOverrides] = useState<{ [taxYear: string]: string }>({});
  const [entityOverride, setEntityOverride] = useState<string>('');

  const assets = useStore((state) => state.assets);
  const entities = useStore((state) => state.entities);
  const addBalanceToAsset = useStore((state) => state.addBalanceToAsset);
  const geminiApiKey = useStore((state) => state.geminiApiKey);
  const geminiModel = useStore((state) => state.geminiModel);
  const setGeminiModel = useStore((state) => state.setGeminiModel);

  // Fetch available models when dialog opens and API key is available
  useEffect(() => {
    if (open && geminiApiKey && geminiApiKey.trim() !== '') {
      setLoadingModels(true);
      fetchAvailableGeminiModels(geminiApiKey)
        .then(models => {
          setAvailableModels(models);
          setLoadingModels(false);
        })
        .catch(err => {
          console.error('Failed to fetch models:', err);
          setLoadingModels(false);
        });
    }
  }, [open, geminiApiKey]);

  // Filter assets to only show financial assets (Bank, Cash, Loans Given)
  const financialAssets = assets.filter(a => 
    !a.disposed && 
    !a.closed &&
    (a.cageCategory === 'Bii' || a.cageCategory === 'Biv' || a.cageCategory === 'Bv')
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a valid PDF file');
      setFile(null);
    }
  };

  const handleParse = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!geminiApiKey) {
      setError('Gemini API key is required. Please configure it in Settings.');
      return;
    }

    setParsing(true);
    setError(null);

    try {
      console.log('Parsing financial balance PDF with Gemini AI...');
      const data = await parseFinancialBalancePdf(file, geminiApiKey, geminiModel);
      
      // Aggregate balances by tax year (use the latest/closing balance for each year)
      const aggregatedByYear = data.reduce((acc, balance) => {
        const year = balance.taxYear;
        if (!acc[year]) {
          acc[year] = {
            taxYear: year,
            closingBalance: balance.closingBalance,
            interestEarned: 0,
            balances: [],
            bankName: balance.bankName,
            accountType: balance.accountType,
            accountNumber: balance.accountNumber,
          };
        }
        // Sum interest earned across all statements for the year
        acc[year].interestEarned += balance.interestEarned;
        // Keep the latest closing balance
        if (balance.closingBalance > 0) {
          acc[year].closingBalance = balance.closingBalance;
        }
        acc[year].balances.push(balance);
        return acc;
      }, {} as Record<string, any>);
      
      const aggregatedData = Object.values(aggregatedByYear);
      setParsedData(aggregatedData);
      setStep('preview');
    } catch (err) {
      console.error('Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = () => {
    if (!selectedAssetId) {
      setError('Please select a financial asset');
      return;
    }

    parsedData.forEach((yearData) => {
      const taxYear = taxYearOverrides[yearData.taxYear] || yearData.taxYear;
      const periods = yearData.balances
        .filter((b: any) => b.statementPeriod)
        .map((b: any) => `${b.statementPeriod.from} to ${b.statementPeriod.to}`)
        .join('; ');
      
      addBalanceToAsset(selectedAssetId, {
        id: `bal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taxYear,
        closingBalance: yearData.closingBalance,
        interestEarned: yearData.interestEarned,
        notes: `Imported from ${file?.name || 'PDF'} - ${yearData.balances.length} statement(s) for FY ${taxYear}${periods ? ` (${periods})` : ''}`,
      });
    });

    console.log(`Imported ${parsedData.length} aggregated balance record(s)`);
    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setError(null);
    setTaxYearOverrides({});
    setEntityOverride('');
    setSelectedAssetId(preSelectedAssetId || '');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Financial Balance from PDF</DialogTitle>
          <DialogDescription>
            Upload bank statements or account summaries to automatically extract balance information
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1</div>
            <span className="font-medium">Upload</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>2</div>
            <span className="font-medium">Preview</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <div className={`flex items-center gap-2 ${step === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'complete' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>3</div>
            <span className="font-medium">Complete</span>
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {!geminiApiKey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm text-yellow-900">
                    Gemini API key is required. Please configure it in Settings.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="gemini-model">Gemini Model</Label>
              <select
                id="gemini-model"
                className="w-full px-3 py-2 border rounded-md"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                disabled={loadingModels}
              >
                {loadingModels ? (
                  <option>Loading models...</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label} - {model.description}
                    </option>
                  ))
                )}
              </select>
              {loadingModels && (
                <p className="text-sm text-muted-foreground mt-1">Loading available models...</p>
              )}
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700 font-medium">
                      Choose a PDF file
                    </span>
                    <input
                      id="pdf-upload"
                      type="file"
                      className="hidden"
                      accept="application/pdf"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-1">Bank statements, account summaries</p>
                  <p className="text-xs text-gray-400 mt-2">Supports scanned documents with OCR</p>
                </div>
                {file && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-green-600">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleParse} disabled={!file || parsing || !geminiApiKey}>
                {parsing ? 'Parsing...' : 'Parse PDF'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity-filter">Filter by Entity (Optional)</Label>
              <select
                id="entity-filter"
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={entityOverride}
                onChange={(e) => setEntityOverride(e.target.value)}
              >
                <option value="">-- All Entities --</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} ({entity.tin})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-select">Select Financial Asset</Label>
              <select
                id="asset-select"
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
              >
                <option value="">-- Select Asset --</option>
                {financialAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.cageCategory === 'Bii' ? 'Bank Account' : asset.cageCategory === 'Biv' ? 'Cash' : 'Loan Given'})
                    {asset.meta.accountNo && ` - ${asset.meta.accountNo}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Aggregated Balance Records by Tax Year: {parsedData.length}</h3>
              <p className="text-sm text-gray-600">Review the aggregated balance data:</p>
              
              {parsedData.map((yearData) => {
                const availableTaxYears = getTaxYearsFromStart(entities[0]?.taxYear || '2022');
                return (
                <Card key={yearData.taxYear}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {yearData.bankName || 'Financial Institution'} - {formatTaxYear(taxYearOverrides[yearData.taxYear] || yearData.taxYear)}
                        </CardTitle>
                        {yearData.accountType && (
                          <p className="text-sm text-gray-600 mt-1">{yearData.accountType} ({yearData.balances.length} statement{yearData.balances.length > 1 ? 's' : ''})</p>
                        )}
                      </div>
                      <div className="ml-4">
                        <select
                          className="text-sm px-2 py-1 border rounded"
                          value={taxYearOverrides[yearData.taxYear] || yearData.taxYear}
                          onChange={(e) => setTaxYearOverrides({ ...taxYearOverrides, [yearData.taxYear]: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {availableTaxYears.map(year => (
                            <option key={year} value={year}>{formatTaxYear(year)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Closing Balance (Latest)</p>
                        <p className="font-semibold text-green-600">{formatLKR(yearData.closingBalance)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Interest Earned</p>
                        <p className="font-semibold">{formatLKR(yearData.interestEarned)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Statements</p>
                        <p className="font-medium">{yearData.balances.length}</p>
                      </div>
                      {yearData.accountNumber && (
                        <div>
                          <p className="text-sm text-gray-600">Account Number</p>
                          <p className="font-medium">{yearData.accountNumber}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600">Statement Periods</p>
                        <p className="font-medium text-xs">
                          {yearData.balances
                            .filter((b: any) => b.statementPeriod)
                            .map((b: any) => `${b.statementPeriod.from} to ${b.statementPeriod.to}`)
                            .join('; ') || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              })}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={!selectedAssetId || parsedData.length === 0}>
                Import {parsedData.length} Tax Year Record(s)
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
              <h3 className="mt-4 text-lg font-semibold">Import Successful!</h3>
              <p className="text-gray-600 mt-2">
                {parsedData.length} aggregated balance record(s) have been imported successfully.
              </p>
            </div>

            <div className="flex justify-center">
              <Button onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
