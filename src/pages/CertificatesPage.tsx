/**
 * AIT/WHT Certificates Page
 * Track and manage tax withholding certificates
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { formatLKR } from '@/lib/taxEngine';
import { formatTaxYear, getTaxYearsFromStart } from '@/lib/taxYear';
import type { AITWHTCertificate } from '@/types';

export function CertificatesPage() {
  const navigate = useNavigate();
  const [selectedEntityId, setSelectedEntityId] = useState<string | 'all'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const entities = useStore((state) => state.entities);
  const certificates = useStore((state) => state.certificates);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const setCurrentTaxYear = useStore((state) => state.setCurrentTaxYear);
  const removeCertificate = useStore((state) => state.removeCertificate);
  const updateCertificate = useStore((state) => state.updateCertificate);
  const saveToStorage = useStore((state) => state.saveToStorage);

  // Get available tax years
  const availableTaxYears = useMemo(() => {
    if (entities.length === 0) return [currentTaxYear];
    const oldestTaxYear = entities.reduce(
      (oldest, entity) => (entity.taxYear < oldest ? entity.taxYear : oldest),
      entities[0].taxYear
    );
    return getTaxYearsFromStart(oldestTaxYear);
  }, [entities, currentTaxYear]);

  // Filter certificates
  const filteredCertificates = certificates.filter((cert) => {
    if (cert.taxYear !== currentTaxYear) return false;
    if (selectedEntityId !== 'all' && cert.ownerId !== selectedEntityId) return false;
    if (selectedType !== 'all' && cert.type !== selectedType) return false;
    return true;
  });

  // Calculate totals
  const totalGross = filteredCertificates.reduce((sum, c) => sum + c.details.grossAmount, 0);
  const totalTaxDeducted = filteredCertificates.reduce((sum, c) => sum + c.details.taxDeducted, 0);
  const totalNetAmount = filteredCertificates.reduce((sum, c) => sum + c.details.netAmount, 0);

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
                <h1 className="text-2xl font-bold text-slate-900">AIT/WHT Certificates</h1>
                <p className="text-sm text-slate-600">Track withholding tax certificates</p>
              </div>
            </div>
            <Button onClick={() => navigate('/certificates/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Certificate
            </Button>
          </div>
        </div>
      </header>

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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Certificates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{filteredCertificates.length}</p>
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
        {filteredCertificates.length === 0 ? (
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
          <div className="space-y-4">
            {filteredCertificates.map((cert) => {
              const owner = entities.find((e) => e.id === cert.ownerId);
              
              return (
                <Card key={cert.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCertificateTypeColor(cert.type)}`}>
                            {getCertificateTypeLabel(cert.type)}
                          </span>
                          <span className="text-sm text-slate-600">
                            Certificate No: {cert.certificateNo}
                          </span>
                          {cert.verified && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <CardTitle className="text-lg">{cert.details.payerName}</CardTitle>
                        <CardDescription>
                          {owner?.name} • TIN: {cert.details.payerTIN} • Issue Date: {new Date(cert.issueDate).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleVerified(cert)}
                          title={cert.verified ? 'Mark as unverified' : 'Mark as verified'}
                        >
                          {cert.verified ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-400" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/certificates/edit/${cert.id}`)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(cert.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Gross Amount</p>
                        <p className="text-lg font-semibold">{formatLKR(cert.details.grossAmount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Tax Deducted</p>
                        <p className="text-lg font-semibold text-red-600">{formatLKR(cert.details.taxDeducted)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Net Amount</p>
                        <p className="text-lg font-semibold text-green-600">{formatLKR(cert.details.netAmount)}</p>
                      </div>
                    </div>
                    {cert.details.description && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-slate-600">Description</p>
                        <p className="text-sm text-slate-900">{cert.details.description}</p>
                      </div>
                    )}
                    {cert.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-slate-600">Notes</p>
                        <p className="text-sm text-slate-900">{cert.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
