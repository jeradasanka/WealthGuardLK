/**
 * Liability Payment PDF Import Wizard
 * 3-step wizard for importing loan payment data from statements and receipts
 */

import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useStore } from '@/stores/useStore';
import { parseLiabilityPaymentPdf, type ParsedLiabilityPayment } from '@/utils/liabilityPaymentPdfParser';
import { fetchAvailableGeminiModels, FALLBACK_GEMINI_MODELS } from '@/utils/geminiPdfParser';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart, getTaxYearForDate } from '@/lib/taxYear';

interface LiabilityPaymentPDFImportWizardProps {
  open: boolean;
  onClose: () => void;
  preSelectedLiabilityId?: string; // Liability to import payments for
}

type Step = 'upload' | 'preview' | 'complete';

export function LiabilityPaymentPDFImportWizard({ 
  open, 
  onClose,
  preSelectedLiabilityId 
}: LiabilityPaymentPDFImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [selectedLiabilityId, setSelectedLiabilityId] = useState<string>(preSelectedLiabilityId || '');
  const [availableModels, setAvailableModels] = useState<Array<{ value: string; label: string; description: string }>>([...FALLBACK_GEMINI_MODELS]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [taxYearOverrides, setTaxYearOverrides] = useState<{ [taxYear: string]: string }>({});
  const [entityOverride, setEntityOverride] = useState<string>('');

  const liabilities = useStore((state) => state.liabilities);
  const entities = useStore((state) => state.entities);
  const addPaymentToLiability = useStore((state) => state.addPaymentToLiability);
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
      console.log('Parsing liability payment PDF with Gemini AI...');
      const data = await parseLiabilityPaymentPdf(file, geminiApiKey, geminiModel);
      
      // Aggregate payments by tax year
      const aggregatedByYear = data.reduce((acc, payment) => {
        const year = getTaxYearForDate(payment.date);
        if (!acc[year]) {
          acc[year] = {
            taxYear: year,
            principalPaid: 0,
            interestPaid: 0,
            totalPaid: 0,
            payments: [],
            lenderName: payment.lenderName,
            loanAccountNumber: payment.loanAccountNumber,
          };
        }
        acc[year].principalPaid += payment.principalPaid;
        acc[year].interestPaid += payment.interestPaid;
        acc[year].totalPaid += payment.totalPaid;
        acc[year].payments.push(payment);
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
    if (!selectedLiabilityId) {
      setError('Please select a liability');
      return;
    }

    parsedData.forEach((yearData) => {
      const taxYear = taxYearOverrides[yearData.taxYear] || yearData.taxYear;
      const paymentDates = yearData.payments.map((p: any) => p.date).join(', ');
      
      addPaymentToLiability(selectedLiabilityId, {
        id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        taxYear,
        date: yearData.payments[yearData.payments.length - 1].date, // Use last payment date
        principalPaid: yearData.principalPaid,
        interestPaid: yearData.interestPaid,
        notes: `Imported from ${file?.name || 'PDF'} - ${yearData.payments.length} payment(s) for FY ${taxYear}${paymentDates ? ` (Dates: ${paymentDates})` : ''}`,
      });
    });

    console.log(`Imported ${parsedData.length} aggregated payment record(s)`);
    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setError(null);
    setTaxYearOverrides({});
    setEntityOverride('');
    setSelectedLiabilityId(preSelectedLiabilityId || '');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Loan Payments from PDF</DialogTitle>
          <DialogDescription>
            Upload loan statements, payment receipts, or amortization schedules to automatically extract payment information
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
                  <p className="text-sm text-gray-500 mt-1">Loan statements, payment receipts, amortization schedules</p>
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
              <Label htmlFor="liability-select">Select Liability (Loan)</Label>
              <select
                id="liability-select"
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={selectedLiabilityId}
                onChange={(e) => setSelectedLiabilityId(e.target.value)}
              >
                <option value="">-- Select Liability --</option>
                {liabilities
                  .filter(liability => !entityOverride || liability.ownerId === entityOverride)
                  .map((liability) => (
                  <option key={liability.id} value={liability.id}>
                    {liability.description} - {liability.lenderName} (Balance: {formatLKR(liability.currentBalance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Aggregated Payment Records by Tax Year: {parsedData.length}</h3>
              <p className="text-sm text-gray-600">Review the aggregated payment data:</p>
              
              {parsedData.map((yearData) => {
                const availableTaxYears = getTaxYearsFromStart(entities[0]?.taxYear || '2022');
                return (
                <Card key={yearData.taxYear}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          Tax Year: {formatTaxYear(taxYearOverrides[yearData.taxYear] || yearData.taxYear)} ({yearData.payments.length} payment{yearData.payments.length > 1 ? 's' : ''})
                        </CardTitle>
                        {yearData.lenderName && (
                          <p className="text-sm text-gray-600 mt-1">Lender: {yearData.lenderName}</p>
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
                        <p className="text-sm text-gray-600">Total Payments</p>
                        <p className="font-semibold text-lg">{yearData.payments.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Amount Paid</p>
                        <p className="font-semibold text-green-600">{formatLKR(yearData.totalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Principal Paid</p>
                        <p className="font-medium">{formatLKR(yearData.principalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Interest Paid</p>
                        <p className="font-medium text-red-600">{formatLKR(yearData.interestPaid)}</p>
                      </div>
                      {yearData.loanAccountNumber && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600">Loan Account</p>
                          <p className="font-medium">{yearData.loanAccountNumber}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600">Payment Dates</p>
                        <p className="font-medium text-xs">
                          {yearData.payments.map((p: any) => p.date).join(', ')}
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
              <Button onClick={handleImport} disabled={!selectedLiabilityId || parsedData.length === 0}>
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
                {parsedData.length} aggregated payment record(s) have been imported successfully.
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
