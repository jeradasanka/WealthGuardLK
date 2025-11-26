import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ParsedTaxData, ImportPreview, ImportConflict } from '@/types/import';
import { parseTaxPDF } from '@/utils/pdfParser';
import { useStore } from '@/stores/useStore';
import { formatLKR } from '@/lib/taxEngine';

interface PDFImportWizardProps {
  open: boolean;
  onClose: () => void;
}

export function PDFImportWizard({ open, onClose }: PDFImportWizardProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTaxData | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    employmentIncome: boolean[];
    businessIncome: boolean[];
    investmentIncome: boolean[];
    assets: boolean[];
    liabilities: boolean[];
  }>({
    employmentIncome: [],
    businessIncome: [],
    investmentIncome: [],
    assets: [],
    liabilities: [],
  });
  
  const entities = useStore((state) => state.entities);
  const addIncome = useStore((state) => state.addIncome);
  const addAsset = useStore((state) => state.addAsset);
  const addLiability = useStore((state) => state.addLiability);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(entities[0]?.id || '');

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
      const data = await parseTaxPDF(fileToProcess);
      setParsedData(data);
      
      // Generate preview with conflict detection
      const previewData = generatePreview(data);
      setPreview(previewData);
      
      // Initialize selection (all selected by default)
      setSelection({
        employmentIncome: new Array(data.employmentIncome?.length || 0).fill(true),
        businessIncome: new Array(data.businessIncome?.length || 0).fill(true),
        investmentIncome: new Array(data.investmentIncome?.length || 0).fill(true),
        assets: new Array(data.assets?.length || 0).fill(true),
        liabilities: new Array(data.liabilities?.length || 0).fill(true),
      });

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = (data: ParsedTaxData): ImportPreview => {
    const conflicts: ImportConflict[] = [];
    let newItems = 0;
    let updates = 0;
    let skipped = 0;

    // Check for conflicts (simplified version)
    // In production, you'd do more sophisticated duplicate detection
    
    if (data.employmentIncome?.length) {
      newItems += data.employmentIncome.length;
    }
    if (data.businessIncome?.length) {
      newItems += data.businessIncome.length;
    }
    if (data.investmentIncome?.length) {
      newItems += data.investmentIncome.length;
    }
    if (data.assets?.length) {
      newItems += data.assets.length;
    }
    if (data.liabilities?.length) {
      newItems += data.liabilities.length;
    }

    return {
      parsedData: data,
      conflicts,
      summary: {
        newItems,
        updates,
        skipped,
      },
    };
  };

  const handleImport = async () => {
    if (!parsedData || !selectedEntityId) return;

    setLoading(true);
    setError(null);
    
    try {
      console.log('Starting import with data:', parsedData);
      console.log('Selected entity:', selectedEntityId);
      
      // Import employment income
      if (parsedData.employmentIncome && parsedData.employmentIncome.length > 0) {
        const selectedItems = parsedData.employmentIncome.filter((_, idx) => selection.employmentIncome[idx]);
        console.log('Importing employment income:', selectedItems.length);
        selectedItems.forEach(income => {
          addIncome({
            id: crypto.randomUUID(),
            ownerId: selectedEntityId,
            type: 'employment',
            schedule: '1',
            taxYear: parsedData.taxYear,
            details: {
              employerName: income.employerName,
              employerTIN: income.employerTIN || '',
              grossRemuneration: income.grossRemuneration,
              grossAmount: income.grossRemuneration,
              nonCashBenefits: income.nonCashBenefits || 0,
              apitDeducted: income.apitDeducted || 0,
              exemptIncome: income.exemptIncome || 0,
            },
          });
        });
      }

      // Import business income
      if (parsedData.businessIncome && parsedData.businessIncome.length > 0) {
        const selectedItems = parsedData.businessIncome.filter((_, idx) => selection.businessIncome[idx]);
        console.log('Importing business income:', selectedItems.length);
        selectedItems.forEach(income => {
          addIncome({
            id: crypto.randomUUID(),
            ownerId: selectedEntityId,
            type: 'business',
            schedule: '2',
            taxYear: parsedData.taxYear,
            details: {
              businessName: income.businessName,
              grossRevenue: income.grossRevenue,
              grossAmount: income.netProfit,
              directExpenses: income.directExpenses || 0,
              netProfit: income.netProfit,
            },
          });
        });
      }

      // Import investment income
      if (parsedData.investmentIncome && parsedData.investmentIncome.length > 0) {
        const selectedItems = parsedData.investmentIncome.filter((_, idx) => selection.investmentIncome[idx]);
        console.log('Importing investment income:', selectedItems.length);
        selectedItems.forEach(income => {
          addIncome({
            id: crypto.randomUUID(),
            ownerId: selectedEntityId,
            type: 'investment',
            schedule: '3',
            taxYear: parsedData.taxYear,
            details: {
              source: income.source,
              grossAmount: (income.dividends || 0) + (income.interest || 0) + (income.rent || 0),
              dividends: income.dividends || 0,
              interest: income.interest || 0,
              rent: income.rent || 0,
            },
          });
        });
      }

      // Import assets
      if (parsedData.assets && parsedData.assets.length > 0) {
        const selectedItems = parsedData.assets.filter((_, idx) => selection.assets[idx]);
        console.log('Importing assets:', selectedItems.length);
        selectedItems.forEach(asset => {
          addAsset({
            id: crypto.randomUUID(),
            ownerId: selectedEntityId,
            cageCategory: asset.category,
            meta: {
              description: asset.description,
              dateAcquired: asset.dateAcquired || new Date().toISOString().split('T')[0],
            },
            financials: {
              cost: asset.cost,
              marketValue: asset.marketValue,
            },
          });
        });
      }

      // Import liabilities
      if (parsedData.liabilities && parsedData.liabilities.length > 0) {
        const selectedItems = parsedData.liabilities.filter((_, idx) => selection.liabilities[idx]);
        console.log('Importing liabilities:', selectedItems.length);
        selectedItems.forEach(liability => {
          addLiability({
            id: crypto.randomUUID(),
            ownerId: selectedEntityId,
            description: liability.description,
            lenderName: liability.lenderName,
            originalAmount: liability.originalAmount,
            currentBalance: liability.currentBalance,
            date: liability.dateAcquired || new Date().toISOString().split('T')[0],
            dateAcquired: liability.dateAcquired || new Date().toISOString().split('T')[0],
          });
        });
      }

      console.log('Import completed successfully');
      
      // Save to storage
      await saveToStorage();
      console.log('Data saved to storage');
      
      setStep('complete');
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setParsedData(null);
    setPreview(null);
    setError(null);
    onClose();
  };

  const toggleSelection = (category: keyof typeof selection, index: number) => {
    setSelection(prev => ({
      ...prev,
      [category]: prev[category].map((val, i) => i === index ? !val : val)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tax Data from PDF</DialogTitle>
          <DialogDescription>
            Upload a RAMIS tax return PDF to automatically import income, assets, and liabilities
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="mt-4">
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <span className="text-sm font-medium text-primary hover:text-primary/80">
                    Click to upload
                  </span>
                  <span className="text-sm text-muted-foreground"> or drag and drop</span>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={loading}
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">PDF files only (RAMIS tax returns)</p>
              </div>
              {file && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {loading && (
              <div className="text-center text-sm text-muted-foreground">
                Parsing PDF file...
              </div>
            )}
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium">Import Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">New Items</div>
                  <div className="text-2xl font-bold text-green-600">{preview.summary.newItems}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Updates</div>
                  <div className="text-2xl font-bold text-blue-600">{preview.summary.updates}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Skipped</div>
                  <div className="text-2xl font-bold text-gray-600">{preview.summary.skipped}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Tax Year</h3>
              <p className="text-sm text-muted-foreground">{parsedData?.taxYear}</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Assign to Entity</h3>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                {entities.map(entity => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </div>

            {parsedData && (
              <div className="space-y-4">
                {parsedData.employmentIncome && parsedData.employmentIncome.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <h4 className="font-medium text-sm mb-2">Employment Income ({parsedData.employmentIncome.length})</h4>
                    {parsedData.employmentIncome.map((income, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selection.employmentIncome[idx]}
                          onChange={() => toggleSelection('employmentIncome', idx)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="text-sm text-muted-foreground">
                          {income.employerName}: {formatLKR(income.grossRemuneration)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {parsedData.businessIncome && parsedData.businessIncome.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <h4 className="font-medium text-sm mb-2">Business Income ({parsedData.businessIncome.length})</h4>
                    {parsedData.businessIncome.map((income, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selection.businessIncome[idx]}
                          onChange={() => toggleSelection('businessIncome', idx)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="text-sm text-muted-foreground">
                          {income.businessName}: {formatLKR(income.netProfit)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {parsedData.investmentIncome && parsedData.investmentIncome.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <h4 className="font-medium text-sm mb-2">Investment Income ({parsedData.investmentIncome.length})</h4>
                    {parsedData.investmentIncome.map((income, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selection.investmentIncome[idx]}
                          onChange={() => toggleSelection('investmentIncome', idx)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="text-sm text-muted-foreground">
                          {income.source}: {formatLKR((income.dividends || 0) + (income.interest || 0) + (income.rent || 0))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {parsedData.assets && parsedData.assets.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <h4 className="font-medium text-sm mb-2">Assets ({parsedData.assets.length})</h4>
                    {parsedData.assets.map((asset, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selection.assets[idx]}
                          onChange={() => toggleSelection('assets', idx)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="text-sm text-muted-foreground">
                          {asset.description}: {formatLKR(asset.marketValue)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {parsedData.liabilities && parsedData.liabilities.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <h4 className="font-medium text-sm mb-2">Liabilities ({parsedData.liabilities.length})</h4>
                    {parsedData.liabilities.map((liability, idx) => (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selection.liabilities[idx]}
                          onChange={() => toggleSelection('liabilities', idx)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="text-sm text-muted-foreground">
                          {liability.description}: {formatLKR(liability.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {preview.conflicts.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Conflicts Detected
                </h3>
                <div className="space-y-2">
                  {preview.conflicts.map((conflict, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground">
                      {conflict.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Import Complete!</h3>
            <p className="text-sm text-muted-foreground">
              Successfully imported {preview?.summary.newItems} items from the PDF
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading || !selectedEntityId}>
                {loading ? 'Importing...' : 'Import Data'}
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
