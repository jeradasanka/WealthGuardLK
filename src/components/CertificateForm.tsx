/**
 * Certificate Form Component
 * Form for adding/editing AIT/WHT certificates
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import { getTaxYearsFromStart, formatTaxYear } from '@/lib/taxYear';
import type { AITWHTCertificate } from '@/types';

interface CertificateFormProps {
  certificateId?: string;
  onCancel?: () => void;
}

export function CertificateForm({ certificateId, onCancel }: CertificateFormProps) {
  const navigate = useNavigate();
  const entities = useStore((state) => state.entities);
  const certificates = useStore((state) => state.certificates);
  const incomes = useStore((state) => state.incomes);
  const addCertificate = useStore((state) => state.addCertificate);
  const updateCertificate = useStore((state) => state.updateCertificate);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const existingCertificate = certificateId
    ? certificates.find((c) => c.id === certificateId)
    : undefined;

  const [formData, setFormData] = useState({
    ownerId: existingCertificate?.ownerId || entities[0]?.id || '',
    taxYear: existingCertificate?.taxYear || entities[0]?.taxYear || '2023',
    certificateNo: existingCertificate?.certificateNo || '',
    issueDate: existingCertificate?.issueDate || new Date().toISOString().split('T')[0],
    type: existingCertificate?.type || 'interest' as const,
    payerName: existingCertificate?.details.payerName || '',
    payerTIN: existingCertificate?.details.payerTIN || '',
    grossAmount: existingCertificate?.details.grossAmount?.toString() || '',
    taxDeducted: existingCertificate?.details.taxDeducted?.toString() || '',
    netAmount: existingCertificate?.details.netAmount?.toString() || '',
    description: existingCertificate?.details.description || '',
    relatedIncomeId: existingCertificate?.relatedIncomeId || '',
    notes: existingCertificate?.notes || '',
    verified: existingCertificate?.verified || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate net amount when gross and tax are entered
  useEffect(() => {
    const gross = parseFloat(formData.grossAmount) || 0;
    const tax = parseFloat(formData.taxDeducted) || 0;
    const net = gross - tax;
    
    if (gross > 0 && tax >= 0 && net >= 0) {
      setFormData((prev) => ({
        ...prev,
        netAmount: net.toFixed(2),
      }));
    }
  }, [formData.grossAmount, formData.taxDeducted]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.ownerId) newErrors.ownerId = 'Please select an entity';
    if (!formData.taxYear) newErrors.taxYear = 'Please select a tax year';
    if (!formData.certificateNo.trim()) newErrors.certificateNo = 'Certificate number is required';
    if (!formData.issueDate) newErrors.issueDate = 'Issue date is required';
    if (!formData.payerName.trim()) newErrors.payerName = 'Payer name is required';
    if (!formData.payerTIN.trim()) newErrors.payerTIN = 'Payer TIN is required';
    
    const gross = parseFloat(formData.grossAmount);
    const tax = parseFloat(formData.taxDeducted);
    const net = parseFloat(formData.netAmount);

    if (isNaN(gross) || gross <= 0) newErrors.grossAmount = 'Valid gross amount is required';
    if (isNaN(tax) || tax < 0) newErrors.taxDeducted = 'Valid tax amount is required';
    if (isNaN(net) || net < 0) newErrors.netAmount = 'Valid net amount is required';
    if (!isNaN(gross) && !isNaN(tax) && tax > gross) {
      newErrors.taxDeducted = 'Tax cannot exceed gross amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const certificateData: AITWHTCertificate = {
      id: existingCertificate?.id || `cert-${Date.now()}`,
      ownerId: formData.ownerId,
      taxYear: formData.taxYear,
      certificateNo: formData.certificateNo.trim(),
      issueDate: formData.issueDate,
      type: formData.type,
      details: {
        payerName: formData.payerName.trim(),
        payerTIN: formData.payerTIN.trim(),
        grossAmount: parseFloat(formData.grossAmount),
        taxDeducted: parseFloat(formData.taxDeducted),
        netAmount: parseFloat(formData.netAmount),
        description: formData.description.trim() || undefined,
      },
      relatedIncomeId: formData.relatedIncomeId || undefined,
      notes: formData.notes.trim() || undefined,
      verified: formData.verified,
    };

    if (existingCertificate) {
      updateCertificate(existingCertificate.id, certificateData);
    } else {
      addCertificate(certificateData);
    }

    await saveToStorage();

    if (onCancel) {
      onCancel();
    } else {
      navigate('/certificates');
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/certificates');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{existingCertificate ? 'Edit Certificate' : 'Add New Certificate'}</CardTitle>
          <CardDescription>
            Enter the details from your AIT/WHT certificate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity and Tax Year */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ownerId">Entity *</Label>
              <select
                id="ownerId"
                className={`w-full px-3 py-2 border rounded-md ${errors.ownerId ? 'border-red-500' : ''}`}
                value={formData.ownerId}
                onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
              >
                <option value="">Select Entity</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
              {errors.ownerId && <p className="text-sm text-red-500">{errors.ownerId}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxYear">Tax Year *</Label>
              <select
                id="taxYear"
                className={`w-full px-3 py-2 border rounded-md ${errors.taxYear ? 'border-red-500' : ''}`}
                value={formData.taxYear}
                onChange={(e) => setFormData({ ...formData, taxYear: e.target.value })}
              >
                {getTaxYearsFromStart(entities[0]?.taxYear || '2022').map((year) => (
                  <option key={year} value={year}>
                    {formatTaxYear(year)}
                  </option>
                ))}
              </select>
              {errors.taxYear && <p className="text-sm text-red-500">{errors.taxYear}</p>}
            </div>
          </div>

          {/* Certificate Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="certificateNo">Certificate Number *</Label>
              <Input
                id="certificateNo"
                placeholder="e.g., AIT/2024/12345"
                value={formData.certificateNo}
                onChange={(e) => setFormData({ ...formData, certificateNo: e.target.value })}
                className={errors.certificateNo ? 'border-red-500' : ''}
              />
              {errors.certificateNo && <p className="text-sm text-red-500">{errors.certificateNo}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date *</Label>
              <Input
                id="issueDate"
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className={errors.issueDate ? 'border-red-500' : ''}
              />
              {errors.issueDate && <p className="text-sm text-red-500">{errors.issueDate}</p>}
            </div>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Certificate Type *</Label>
            <select
              id="type"
              className="w-full px-3 py-2 border rounded-md"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            >
              <option value="employment">Employment Income (APIT)</option>
              <option value="interest">Interest Income (WHT)</option>
              <option value="dividend">Dividend Income (WHT)</option>
              <option value="rent">Rent Income (WHT)</option>
              <option value="other">Other Withholding Tax</option>
            </select>
          </div>

          {/* Payer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payerName">Payer Name (Employer/Bank/Tenant) *</Label>
              <Input
                id="payerName"
                placeholder="e.g., ABC Bank Limited"
                value={formData.payerName}
                onChange={(e) => setFormData({ ...formData, payerName: e.target.value })}
                className={errors.payerName ? 'border-red-500' : ''}
              />
              {errors.payerName && <p className="text-sm text-red-500">{errors.payerName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payerTIN">Payer TIN *</Label>
              <Input
                id="payerTIN"
                placeholder="e.g., 123456789"
                value={formData.payerTIN}
                onChange={(e) => setFormData({ ...formData, payerTIN: e.target.value })}
                className={errors.payerTIN ? 'border-red-500' : ''}
              />
              {errors.payerTIN && <p className="text-sm text-red-500">{errors.payerTIN}</p>}
            </div>
          </div>

          {/* Financial Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grossAmount">Gross Amount (Rs.) *</Label>
              <Input
                id="grossAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.grossAmount}
                onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
                className={errors.grossAmount ? 'border-red-500' : ''}
              />
              {errors.grossAmount && <p className="text-sm text-red-500">{errors.grossAmount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxDeducted">Tax Deducted (Rs.) *</Label>
              <Input
                id="taxDeducted"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.taxDeducted}
                onChange={(e) => setFormData({ ...formData, taxDeducted: e.target.value })}
                className={errors.taxDeducted ? 'border-red-500' : ''}
              />
              {errors.taxDeducted && <p className="text-sm text-red-500">{errors.taxDeducted}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="netAmount">Net Amount Received (Rs.) *</Label>
              <Input
                id="netAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.netAmount}
                onChange={(e) => setFormData({ ...formData, netAmount: e.target.value })}
                className={errors.netAmount ? 'border-red-500' : ''}
                readOnly
              />
              {errors.netAmount && <p className="text-sm text-red-500">{errors.netAmount}</p>}
              <p className="text-xs text-slate-500">Auto-calculated: Gross - Tax Deducted</p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="e.g., Interest on savings account"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Link to Income Entry */}
          <div className="space-y-2">
            <Label htmlFor="relatedIncomeId">Link to Income Entry (Optional)</Label>
            <select
              id="relatedIncomeId"
              className="w-full px-3 py-2 border rounded-md"
              value={formData.relatedIncomeId}
              onChange={(e) => setFormData({ ...formData, relatedIncomeId: e.target.value })}
            >
              <option value="">Not linked to any income entry</option>
              {incomes
                .filter(income => income.ownerId === formData.ownerId && income.taxYear === formData.taxYear)
                .map(income => {
                  let label = '';
                  if (income.schedule === '1') {
                    label = `Employment: ${(income as any).details.employerName}`;
                  } else if (income.schedule === '2') {
                    label = `Business: ${(income as any).details.businessName}`;
                  } else if (income.schedule === '3') {
                    label = `Investment: ${(income as any).details.source}`;
                  }
                  return (
                    <option key={income.id} value={income.id}>
                      {label}
                    </option>
                  );
                })}
            </select>
            <p className="text-xs text-slate-500">
              Link this certificate to a specific income entry for better tracking
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <textarea
              id="notes"
              className="w-full px-3 py-2 border rounded-md min-h-[80px]"
              placeholder="Additional notes or comments..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          {/* Verified Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              id="verified"
              type="checkbox"
              checked={formData.verified}
              onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="verified" className="cursor-pointer">
              Mark as verified (I have verified this certificate against the original document)
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {existingCertificate ? 'Update Certificate' : 'Add Certificate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
