/**
 * AIT/WHT Certificates Page
 * Track and manage tax withholding certificates
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Pencil, Trash2, CheckCircle2, Circle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart } from '@/lib/taxYear';
import type { AITWHTCertificate } from '@/types';
import { CertificatePDFImportWizard } from '@/components/CertificatePDFImportWizard';

export function CertificatesPage() {
  const navigate = useNavigate();
  const [selectedEntityId, setSelectedEntityId] = useState<string | 'all'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showPDFImport, setShowPDFImport] = useState(false);
  
  const entities = useStore((state) => state.entities);
  const certificates = useStore((state) => state.certificates);
  const incomes = useStore((state) => state.incomes);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const setCurrentTaxYear = useStore((state) => state.setCurrentTaxYear);
  const removeCertificate = useStore((state) => state.removeCertificate);
  const updateCertificate = useStore((state) => state.updateCertificate);
  const saveToStorage = useStore((state) => state.saveToStorage);

  console.log('CertificatesPage - Total certificates in store:', certificates.length);
  console.log('CertificatesPage - Current tax year:', currentTaxYear);
  console.log('CertificatesPage - Certificates by year:', 
    certificates.reduce((acc, c) => {
      acc[c.taxYear] = (acc[c.taxYear] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );

  // Get available tax years
  const availableTaxYears = useMemo(() => {
    // Get standard tax years from entities
    const standardYears = entities.length === 0 ? [currentTaxYear] : (() => {
      const oldestTaxYear = entities.reduce(
        (oldest, entity) => (entity.taxYear < oldest ? entity.taxYear : oldest),
        entities[0].taxYear
      );
      return getTaxYearsFromStart(oldestTaxYear);
    })();
    
    // Add any unique tax years from certificates (handles legacy "YYYY/YYYY" format)
    const certificateYears = [...new Set(certificates.map(c => c.taxYear))];
    const allYears = [...new Set([...standardYears, ...certificateYears])];
    
    // Sort years in descending order
    return allYears.sort((a, b) => {
      // Extract first year for comparison (handles both "2024" and "2024/2025")
      const yearA = parseInt(a.split('/')[0]);
      const yearB = parseInt(b.split('/')[0]);
      return yearB - yearA;
    });
  }, [entities, currentTaxYear, certificates]);

  // Get employment income from income schedules (Schedule 1)
  const employmentIncomes = useMemo(() => {
    return incomes
      .filter(income => income.schedule === '1' && income.taxYear === currentTaxYear)
      .filter(income => selectedEntityId === 'all' || income.ownerId === selectedEntityId)
      .map(income => ({
        id: income.id,
        ownerId: income.ownerId,
        taxYear: income.taxYear,
        certificateNo: 'From Income Schedule',
        issueDate: '',
        type: 'employment' as const,
        details: {
          payerName: (income as any).details.employerName,
          payerTIN: (income as any).details.employerTIN,
          grossAmount: (income as any).details.grossRemuneration,
          taxDeducted: (income as any).details.apitDeducted,
          netAmount: (income as any).details.grossRemuneration - (income as any).details.apitDeducted,
        },
        fromIncomeSchedule: true,
        verified: true,
      }));
  }, [incomes, currentTaxYear, selectedEntityId]);

  // Filter certificates
  const filteredCertificates = certificates.filter((cert) => {
    if (cert.taxYear !== currentTaxYear) return false;
    if (selectedEntityId !== 'all' && cert.ownerId !== selectedEntityId) return false;
    if (selectedType !== 'all' && cert.type !== selectedType) return false;
    return true;
  });

  console.log('CertificatesPage - Filtered certificates:', filteredCertificates.length, 
    'for tax year', currentTaxYear, 
    'entity:', selectedEntityId, 
    'type:', selectedType);

  // Combine certificates with employment income from schedules
  const allCertificates = useMemo(() => {
    if (selectedType === 'all' || selectedType === 'employment') {
      return [...employmentIncomes, ...filteredCertificates];
    }
    return filteredCertificates;
  }, [employmentIncomes, filteredCertificates, selectedType]);

  // Calculate totals from all certificates (including employment income)
  const totalGross = allCertificates.reduce((sum, c) => sum + c.details.grossAmount, 0);
  const totalTaxDeducted = allCertificates.reduce((sum, c) => sum + c.details.taxDeducted, 0);
  const totalNetAmount = allCertificates.reduce((sum, c) => sum + c.details.netAmount, 0);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this certificate?')) {
      removeCertificate(id);
      await saveToStorage();
    }
  };

  const handleToggleVerified = async (cert: AITWHTCertificate) => {
    updateCertificate(cert.id, { verified: !cert.verified });
    await saveToStorage();
  };

  const getCertificateTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      employment: 'Employment (APIT)',
      interest: 'Interest Income (WHT)',
      dividend: 'Dividend Income (WHT)',
      rent: 'Rent Income (WHT)',
      other: 'Other (WHT)',
    };
    return labels[type] || type;
  };

  const getCertificateTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      employment: 'bg-blue-100 text-blue-800',
      interest: 'bg-green-100 text-green-800',
      dividend: 'bg-purple-100 text-purple-800',
      rent: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Tax Certificates (APIT/WHT)</h1>
                <p className="text-sm text-slate-600">Track Advance Personal Income Tax and Withholding Tax certificates</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPDFImport(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import from PDF
              </Button>
              <Button onClick={() => navigate('/certificates/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Certificate
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* PDF Import Wizard */}
      {showPDFImport && (
        <CertificatePDFImportWizard onClose={() => setShowPDFImport(false)} />
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Tax Year Selector */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Tax Year Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Tax Year</label>
                <select
                  value={currentTaxYear}
                  onChange={(e) => setCurrentTaxYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableTaxYears.map((year) => (
                    <option key={year} value={year}>
                      {formatTaxYear(year)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Entity</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                >
                  <option value="all">All Entities</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Certificate Type</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="employment">Employment (APIT)</option>
                  <option value="interest">Interest (WHT)</option>
                  <option value="dividend">Dividend (WHT)</option>
                  <option value="rent">Rent (WHT)</option>
                  <option value="other">Other (WHT)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Income Summary */}
        {(() => {
          const employmentCerts = filteredCertificates.filter(c => c.type === 'employment');
          const employmentAPIT = employmentCerts.reduce((sum, c) => sum + c.details.taxDeducted, 0);
          const employmentGross = employmentCerts.reduce((sum, c) => sum + c.details.grossAmount, 0);
          
          if (employmentCerts.length > 0) {
            return (
              <Card className="mb-6 bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg">Employment Income (APIT)</CardTitle>
                  <CardDescription>{employmentCerts.length} certificate(s) for {formatTaxYear(currentTaxYear)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Gross Remuneration</p>
                      <p className="text-xl font-bold text-blue-600">{formatLKR(employmentGross)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">APIT Deducted (Cage 903)</p>
                      <p className="text-xl font-bold text-red-600">{formatLKR(employmentAPIT)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Net Received</p>
                      <p className="text-xl font-bold text-green-600">{formatLKR(employmentGross - employmentAPIT)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* Employment Income Summary */}
        {(() => {
          const employmentCerts = filteredCertificates.filter(c => c.type === 'employment');
          const employmentAPIT = employmentCerts.reduce((sum, c) => sum + c.details.taxDeducted, 0);
          const employmentGross = employmentCerts.reduce((sum, c) => sum + c.details.grossAmount, 0);
          
          if (employmentCerts.length > 0) {
            return (
              <Card className="mb-6 bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg">Employment Income (APIT)</CardTitle>
                  <CardDescription>{employmentCerts.length} certificate(s) for {formatTaxYear(currentTaxYear)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Gross Remuneration</p>
                      <p className="text-xl font-bold text-blue-600">{formatLKR(employmentGross)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">APIT Deducted (Cage 903)</p>
                      <p className="text-xl font-bold text-red-600">{formatLKR(employmentAPIT)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Net Received</p>
                      <p className="text-xl font-bold text-green-600">{formatLKR(employmentGross - employmentAPIT)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Certificates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{allCertificates.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Gross Amount</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{formatLKR(totalGross)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tax Deducted</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatLKR(totalTaxDeducted)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Net Amount Received</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatLKR(totalNetAmount)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Certificates List */}
        {allCertificates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Certificates Found</h3>
              <p className="text-slate-600 mb-4">
                Start tracking your tax withholding certificates
              </p>
              <Button onClick={() => navigate('/certificates/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Certificate
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Certificate No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Payer</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Entity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Issue Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Payment Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">Gross Amount</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">Tax Deducted</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">Net Amount</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {allCertificates.map((cert) => {
                      const owner = entities.find((e) => e.id === cert.ownerId);
                      const fromSchedule = (cert as any).fromIncomeSchedule;
                      
                      return (
                        <tr key={cert.id} className={`hover:bg-slate-50 transition-colors ${fromSchedule ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-4 py-2">
                            {fromSchedule ? (
                              <CheckCircle2 className="w-4 h-4 text-blue-600" title="From Income Schedule" />
                            ) : (
                              <button
                                onClick={() => handleToggleVerified(cert)}
                                title={cert.verified ? 'Verified - Click to unverify' : 'Unverified - Click to verify'}
                                className="hover:scale-110 transition-transform"
                              >
                                {cert.verified ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-slate-900">{cert.certificateNo}</div>
                            {fromSchedule && (
                              <div className="text-xs text-blue-600">Schedule 1 - Employment</div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCertificateTypeColor(cert.type)}`}>
                              {cert.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-slate-900">{cert.details.payerName}</div>
                            <div className="text-xs text-slate-500">TIN: {cert.details.payerTIN}</div>
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-600">{owner?.name || 'Unknown'}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">
                            {fromSchedule ? (
                              <span className="text-slate-500">-</span>
                            ) : (
                              cert.issueDate ? new Date(cert.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-600">
                            {fromSchedule ? (
                              <span className="text-slate-500">-</span>
                            ) : (
                              cert.paymentDate ? new Date(cert.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-slate-900">{formatLKR(cert.details.grossAmount)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-red-600">{formatLKR(cert.details.taxDeducted)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-green-600">{formatLKR(cert.details.netAmount)}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {fromSchedule ? (
                                <span className="text-xs text-slate-500">From Schedule</span>
                              ) : (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => navigate(`/certificates/edit/${cert.id}`)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleDelete(cert.id)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
