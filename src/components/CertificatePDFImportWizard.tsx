/**
 * Certificate PDF Import Wizard
 * Allows importing WHT/AIT certificates from PDF documents using Gemini AI
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useStore } from '@/stores/useStore';
import { parseCertificatePdf, determineTaxYearFromDate, type ParsedCertificateData } from '@/utils/certificatePdfParser';
import { FileText, Upload, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getTaxYearsFromStart } from '@/lib/taxYear';

interface CertificatePDFImportWizardProps {
  onClose: () => void;
}

export function CertificatePDFImportWizard({ onClose }: CertificatePDFImportWizardProps) {
  const navigate = useNavigate();
  const entities = useStore((state) => state.entities);
  const addCertificate = useStore((state) => state.addCertificate);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const geminiApiKey = useStore((state) => state.geminiApiKey);
  const geminiModel = useStore((state) => state.geminiModel);

  const [file, setFile] = useState<File | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState(entities[0]?.id || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedCertificates, setParsedCertificates] = useState<ParsedCertificateData[]>([]);
  const [selectedCertificates, setSelectedCertificates] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleParsePDF = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    if (!geminiApiKey) {
      setError('Gemini API key is not configured. Please set it in Settings.');
      return;
    }

    if (!selectedOwnerId) {
      setError('Please select an entity');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const certificates = await parseCertificatePdf(file, geminiApiKey, geminiModel);
      
      if (certificates.length === 0) {
        setError('No certificates found in the PDF. Please check the document format.');
        setIsProcessing(false);
        return;
      }

      // Auto-determine tax years if not provided
      const certificatesWithTaxYear = certificates.map(cert => ({
        ...cert,
        taxYear: cert.taxYear || determineTaxYearFromDate(cert.issueDate),
      }));

      setParsedCertificates(certificatesWithTaxYear);
      setSelectedCertificates(new Array(certificatesWithTaxYear.length).fill(true));
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCertificateSelection = (index: number) => {
    setSelectedCertificates(prev => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  };

  const handleImport = async () => {
    const certificatesToImport = parsedCertificates.filter((_, idx) => selectedCertificates[idx]);

    if (certificatesToImport.length === 0) {
      setError('Please select at least one certificate to import');
      return;
    }

    setIsProcessing(true);

    try {
      for (const cert of certificatesToImport) {
        const newCertificate = {
          id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ownerId: selectedOwnerId,
          taxYear: cert.taxYear || determineTaxYearFromDate(cert.issueDate),
          certificateNo: cert.certificateNo,
          issueDate: cert.issueDate,
          type: cert.type,
          details: {
            payerName: cert.payerName,
            payerTIN: cert.payerTIN,
            grossAmount: cert.grossAmount,
            taxDeducted: cert.taxDeducted,
            netAmount: cert.netAmount,
            description: cert.description,
          },
          notes: cert.period ? `Period: ${cert.period}` : undefined,
          verified: false,
        };

        addCertificate(newCertificate);
      }

      await saveToStorage();
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import certificates');
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    onClose();
    navigate('/certificates');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Import WHT/AIT Certificates from PDF</CardTitle>
          <CardDescription>
            Upload a PDF certificate and let AI extract the details automatically
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 'upload' && (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="entity">Select Entity</Label>
                  <select
                    id="entity"
                    value={selectedOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  >
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name} {entity.tin ? `(${entity.tin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="pdf-file">Upload Certificate PDF</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="pdf-file"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                    {file && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {file.name}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports APIT, WHT (Interest, Dividend, Rent) certificate PDFs
                  </p>
                </div>

                {!geminiApiKey && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">Gemini API Key Required</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Please configure your Gemini API key in Settings to use AI-powered PDF import.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/settings')}
                          className="mt-2"
                        >
                          Go to Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">How it works:</p>
                      <ul className="list-disc list-inside text-blue-700 mt-1 space-y-1">
                        <li>Upload your WHT/AIT certificate PDF</li>
                        <li>AI extracts certificate details automatically</li>
                        <li>Review and verify the extracted data</li>
                        <li>Select certificates to import</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <p className="text-sm text-red-900">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleParsePDF} disabled={!file || !geminiApiKey || isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing PDF...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Parse PDF
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Found {parsedCertificates.length} Certificate{parsedCertificates.length !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Review the extracted data and select certificates to import
                </p>

                <div className="space-y-4">
                  {parsedCertificates.map((cert, idx) => (
                    <Card
                      key={idx}
                      className={`${
                        selectedCertificates[idx] ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedCertificates[idx]}
                            onChange={() => toggleCertificateSelection(idx)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Certificate No</p>
                              <p className="font-medium">{cert.certificateNo}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Type</p>
                              <p className="font-medium capitalize">{cert.type}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Payer</p>
                              <p className="font-medium">{cert.payerName}</p>
                              <p className="text-xs text-muted-foreground">TIN: {cert.payerTIN}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Issue Date</p>
                              <p className="font-medium">{cert.issueDate}</p>
                              <p className="text-xs text-muted-foreground">Tax Year: {cert.taxYear}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Gross Amount</p>
                              <p className="font-medium">Rs. {cert.grossAmount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tax Deducted</p>
                              <p className="font-medium">Rs. {cert.taxDeducted.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Net Amount</p>
                              <p className="font-medium">Rs. {cert.netAmount.toLocaleString()}</p>
                            </div>
                            {cert.period && (
                              <div>
                                <p className="text-xs text-muted-foreground">Period</p>
                                <p className="font-medium">{cert.period}</p>
                              </div>
                            )}
                            {cert.description && (
                              <div className="col-span-2">
                                <p className="text-xs text-muted-foreground">Description</p>
                                <p className="text-sm">{cert.description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <p className="text-sm text-red-900">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={isProcessing || !selectedCertificates.some(Boolean)}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {selectedCertificates.filter(Boolean).length} Certificate
                      {selectedCertificates.filter(Boolean).length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'complete' && (
            <>
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Import Successful!</h3>
                <p className="text-muted-foreground">
                  {selectedCertificates.filter(Boolean).length} certificate
                  {selectedCertificates.filter(Boolean).length !== 1 ? 's have' : ' has'} been imported successfully.
                </p>
              </div>

              <div className="flex justify-center">
                <Button onClick={handleFinish}>
                  Go to Certificates
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
