/**
 * Income Schedule PDF Import Wizard
 * Allows importing income data from T10 and other schedule forms using Gemini AI
 */

import { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useStore } from '@/stores/useStore';
import { parseIncomeSchedulePdf, ParsedIncomeScheduleData } from '@/utils/incomeSchedulePdfParser';
import { fetchAvailableGeminiModels, FALLBACK_GEMINI_MODELS } from '@/utils/geminiPdfParser';
import { formatLKR } from '@/lib/taxEngine';

interface IncomeSchedulePDFImportWizardProps {
  open: boolean;
  onClose: () => void;
}

export function IncomeSchedulePDFImportWizard({ open, onClose }: IncomeSchedulePDFImportWizardProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedIncomeScheduleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncomes, setSelectedIncomes] = useState<boolean[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [autoDetectedEntity, setAutoDetectedEntity] = useState<string | null>(null);
  
  const entities = useStore((state) => state.entities);
  const addIncome = useStore((state) => state.addIncome);
  const geminiApiKey = useStore((state) => state.geminiApiKey);
  const geminiModel = useStore((state) => state.geminiModel);
  const setGeminiModel = useStore((state) => state.setGeminiModel);
  
  const [availableModels, setAvailableModels] = useState<Array<{ value: string; label: string; description: string }>>([
    ...FALLBACK_GEMINI_MODELS
  ]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setParsedData([]);
      setError(null);
      setSelectedIncomes([]);
      setSelectedEntityId(entities[0]?.id || '');
      setAutoDetectedEntity(null);
    } else {
      setSelectedEntityId(entities[0]?.id || '');
    }
  }, [open, entities]);

  // Fetch available models when dialog opens
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.type !== 'application/pdf') {
      setError('Please select a valid PDF file');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    
    // Automatically parse the file
    await handleParse(selectedFile);
  };

  const handleParse = async (fileToProcess: File) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!geminiApiKey) {
        throw new Error('Gemini API key is required. Please configure it in Settings.');
      }

      console.log('Parsing income schedule PDF with Gemini AI...');
      const data = await parseIncomeSchedulePdf(fileToProcess, geminiApiKey, geminiModel);
      
      setParsedData(data);
      setSelectedIncomes(new Array(data.length).fill(true));
      
      // Try to auto-detect entity from employment or business TIN
      let detectedEntityId: string | null = null;
      
      // Check employment income for employer TIN match
      const employmentIncome = data.find(d => d.schedule === '1' && d.employmentDetails);
      if (employmentIncome?.employmentDetails?.employerTIN) {
        const entityByTin = entities.find(e => e.tin === employmentIncome.employmentDetails?.employerTIN);
        if (entityByTin) {
          detectedEntityId = entityByTin.id;
          console.log('Auto-detected entity by employment TIN:', entityByTin.name);
        }
      }
      
      // If not found, check business TIN
      if (!detectedEntityId) {
        const businessIncome = data.find(d => d.schedule === '2' && d.businessDetails);
        if (businessIncome?.businessDetails?.businessTIN) {
          const entityByTin = entities.find(e => e.tin === businessIncome.businessDetails?.businessTIN);
          if (entityByTin) {
            detectedEntityId = entityByTin.id;
            console.log('Auto-detected entity by business TIN:', entityByTin.name);
          }
        }
      }
      
      // If not found, try matching by name (case-insensitive partial match)
      if (!detectedEntityId && employmentIncome?.employmentDetails?.employerName) {
        const entityByName = entities.find(e => 
          e.name.toLowerCase().includes(employmentIncome.employmentDetails!.employerName.toLowerCase()) ||
          employmentIncome.employmentDetails!.employerName.toLowerCase().includes(e.name.toLowerCase())
        );
        if (entityByName) {
          detectedEntityId = entityByName.id;
          console.log('Auto-detected entity by employer name:', entityByName.name);
        }
      }
      
      if (detectedEntityId) {
        setSelectedEntityId(detectedEntityId);
        setAutoDetectedEntity(detectedEntityId);
      }
      
      setStep('preview');
    } catch (err) {
      console.error('Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedEntityId) {
      setError('Please select an entity');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let imported = 0;
      
      parsedData.forEach((income, idx) => {
        if (!selectedIncomes[idx]) return;
        
        const baseIncome = {
          id: `income-${Date.now()}-${idx}`,
          ownerId: selectedEntityId,
          schedule: income.schedule,
          taxYear: income.taxYear,
        };

        if (income.schedule === '1' && income.employmentDetails) {
          addIncome({
            ...baseIncome,
            schedule: '1',
            details: {
              employerName: income.employmentDetails.employerName,
              employerTIN: income.employmentDetails.employerTIN,
              grossRemuneration: income.employmentDetails.totalGross || income.employmentDetails.grossRemuneration,
              nonCashBenefits: income.employmentDetails.nonCashBenefits || 0,
              apitDeducted: income.employmentDetails.apitDeducted,
              exemptIncome: income.employmentDetails.exemptIncome || 0,
            },
          });
          imported++;
        } else if (income.schedule === '2' && income.businessDetails) {
          addIncome({
            ...baseIncome,
            schedule: '2',
            details: {
              businessName: income.businessDetails.businessName,
              grossRevenue: income.businessDetails.grossRevenue,
              directExpenses: income.businessDetails.totalExpenses || income.businessDetails.directExpenses || 0,
              netProfit: income.businessDetails.taxableProfit || income.businessDetails.netProfit,
            },
          });
          imported++;
        } else if (income.schedule === '3' && income.investmentDetails) {
          addIncome({
            ...baseIncome,
            schedule: '3',
            type: income.investmentDetails.sourceType,
            details: {
              source: income.investmentDetails.source,
              grossAmount: income.investmentDetails.taxableAmount || income.investmentDetails.grossAmount,
              whtDeducted: income.investmentDetails.whtDeducted || 0,
            },
          });
          imported++;
        }
        
        // Small delay to ensure unique IDs
        if (idx < parsedData.length - 1) {
          const now = Date.now();
          while (Date.now() - now < 10) {}
        }
      });

      console.log(`Successfully imported ${imported} income entries`);
      setStep('complete');
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import income data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (index: number) => {
    const newSelection = [...selectedIncomes];
    newSelection[index] = !newSelection[index];
    setSelectedIncomes(newSelection);
  };

  const getScheduleName = (schedule: string) => {
    switch (schedule) {
      case '1': return 'Employment Income';
      case '2': return 'Business Income';
      case '3': return 'Investment Income';
      default: return 'Unknown';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Income Schedule (T10 Forms)</DialogTitle>
          <DialogDescription>
            Upload income schedule PDFs and extract data using AI. Supports both digital and scanned PDFs.
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
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
                      {model.label}
                    </option>
                  ))
                )}
              </select>
              <p className="text-sm text-muted-foreground">
                Select the Gemini model to use for PDF analysis
              </p>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="pdf-upload"
                disabled={!geminiApiKey || loading}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-1">
                  {file ? file.name : 'Click to upload income schedule PDF'}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  T10 forms, employment certificates, or other income schedules
                </p>
                <p className="text-xs text-green-600 font-medium">
                  ✓ Scanned PDFs supported (with OCR)
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Tips for scanned PDFs: Use high-quality scans (300 DPI+), ensure proper alignment
                </p>
              </label>
            </div>

            {loading && (
              <div className="text-center text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                Analyzing PDF with Gemini AI...
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium">Import Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Entries Found</div>
                  <div className="text-2xl font-bold text-blue-600">{parsedData.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Selected for Import</div>
                  <div className="text-2xl font-bold text-green-600">
                    {selectedIncomes.filter(Boolean).length}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity">Import To Entity *</Label>
              <select
                id="entity"
                className="w-full px-3 py-2 border rounded-md"
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
              >
                <option value="">Select Entity</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} (TIN: {entity.tin}){entity.id === autoDetectedEntity ? ' ✓ Auto-detected' : ''}
                  </option>
                ))}
              </select>
              {autoDetectedEntity && (
                <p className="text-sm text-green-600">✓ Entity auto-detected from PDF (TIN match)</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">Income Entries</h3>
              {parsedData.map((income, idx) => (
                <Card key={idx} className={!selectedIncomes[idx] ? 'opacity-50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIncomes[idx]}
                          onChange={() => toggleSelection(idx)}
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                        />
                        <div>
                          <CardTitle className="text-base">
                            {getScheduleName(income.schedule)} - Tax Year {income.taxYear}
                          </CardTitle>
                          <CardDescription>
                            {income.employmentDetails && `Employer: ${income.employmentDetails.employerName}`}
                            {income.businessDetails && `Business: ${income.businessDetails.businessName}`}
                            {income.investmentDetails && `Source: ${income.investmentDetails.source}`}
                          </CardDescription>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        income.schedule === '1' ? 'bg-blue-100 text-blue-700' :
                        income.schedule === '2' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        Schedule {income.schedule}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {income.employmentDetails && (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground">Employer TIN</p>
                            <p className="font-medium">{income.employmentDetails.employerTIN}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Gross Remuneration</p>
                            <p className="font-medium">{formatLKR(income.employmentDetails.grossRemuneration)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">APIT Deducted</p>
                            <p className="font-medium text-red-600">{formatLKR(income.employmentDetails.apitDeducted)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Gross</p>
                            <p className="font-medium">{formatLKR(income.employmentDetails.totalGross)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Net Taxable</p>
                            <p className="font-medium text-green-600">{formatLKR(income.employmentDetails.netTaxableIncome)}</p>
                          </div>
                        </>
                      )}
                      {income.businessDetails && (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground">Nature of Business</p>
                            <p className="font-medium">{income.businessDetails.natureOfBusiness}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Gross Revenue</p>
                            <p className="font-medium">{formatLKR(income.businessDetails.grossRevenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Expenses</p>
                            <p className="font-medium text-red-600">{formatLKR(income.businessDetails.totalExpenses)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Net Profit</p>
                            <p className="font-medium">{formatLKR(income.businessDetails.netProfit)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Taxable Profit</p>
                            <p className="font-medium text-green-600">{formatLKR(income.businessDetails.taxableProfit)}</p>
                          </div>
                        </>
                      )}
                      {income.investmentDetails && (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground">Source Type</p>
                            <p className="font-medium capitalize">{income.investmentDetails.sourceType}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Payer</p>
                            <p className="font-medium">{income.investmentDetails.payerName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Gross Amount</p>
                            <p className="font-medium">{formatLKR(income.investmentDetails.grossAmount)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">WHT Deducted</p>
                            <p className="font-medium text-red-600">{formatLKR(income.investmentDetails.whtDeducted || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Taxable Amount</p>
                            <p className="font-medium text-green-600">{formatLKR(income.investmentDetails.taxableAmount)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-600 mb-4" />
            <h3 className="text-lg font-medium mb-2">Import Complete!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Successfully imported {selectedIncomes.filter(Boolean).length} income entries
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')} disabled={loading}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading || !selectedEntityId || selectedIncomes.filter(Boolean).length === 0}>
                {loading ? 'Importing...' : `Import ${selectedIncomes.filter(Boolean).length} Entries`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
