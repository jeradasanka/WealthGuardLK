/**
 * Asset Form Component (FR-05)
 * Handles asset creation/editing with category-specific fields
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/stores/useStore';
import type { Asset } from '@/types';
import { formatLKR } from '@/lib/taxEngine';

interface AssetFormProps {
  asset?: Asset;
  onSave?: () => void;
  onCancel?: () => void;
}

export function AssetForm({ asset, onSave, onCancel }: AssetFormProps) {
  const entities = useStore((state) => state.entities);
  const addAsset = useStore((state) => state.addAsset);
  const updateAsset = useStore((state) => state.updateAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: asset?.ownerId || entities[0]?.id || '',
    cageCategory: asset?.cageCategory || ('701' as '701' | '711' | '721'),
    description: asset?.meta.description || '',
    dateAcquired: asset?.meta.dateAcquired || new Date().toISOString().split('T')[0],
    cost: asset?.financials.cost || 0,
    marketValue: asset?.financials.marketValue || 0,
    // Category-specific fields
    address: asset?.meta.address || '',
    deedNo: asset?.meta.deedNo || '',
    regNo: asset?.meta.regNo || '',
    brand: asset?.meta.brand || '',
    accountNo: asset?.meta.accountNo || '',
    bankName: asset?.meta.bankName || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const assetData: Asset = {
      id: asset?.id || crypto.randomUUID(),
      ownerId: formData.ownerId,
      cageCategory: formData.cageCategory,
      meta: {
        description: formData.description,
        dateAcquired: formData.dateAcquired,
        ...(formData.cageCategory === '701' && {
          address: formData.address,
          deedNo: formData.deedNo,
        }),
        ...(formData.cageCategory === '711' && {
          regNo: formData.regNo,
          brand: formData.brand,
        }),
        ...(formData.cageCategory === '721' && {
          accountNo: formData.accountNo,
          bankName: formData.bankName,
        }),
      },
      financials: {
        cost: Number(formData.cost),
        marketValue: Number(formData.marketValue),
        sourceOfFunds: asset?.financials.sourceOfFunds,
      },
      disposed: asset?.disposed,
    };

    if (asset) {
      updateAsset(asset.id, assetData);
    } else {
      addAsset(assetData);
    }

    try {
      await saveToStorage();
      onSave?.();
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    }
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const getCategoryLabel = () => {
    switch (formData.cageCategory) {
      case '701':
        return 'Immovable Property';
      case '711':
        return 'Motor Vehicle';
      case '721':
        return 'Bank/Financial Asset';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{asset ? 'Edit' : 'Add'} Asset</CardTitle>
        <CardDescription>
          Statement of Assets and Liabilities - {getCategoryLabel()} (Cage {formData.cageCategory})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ownerId">Owner *</Label>
            <select
              id="ownerId"
              value={formData.ownerId}
              onChange={handleChange('ownerId')}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select owner</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.tin})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cageCategory">Asset Category *</Label>
            <select
              id="cageCategory"
              value={formData.cageCategory}
              onChange={handleChange('cageCategory')}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="701">Cage 701 - Immovable Property (Land, House, Building)</option>
              <option value="711">Cage 711 - Motor Vehicles</option>
              <option value="721">Cage 721 - Bank/Financial Assets</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={handleChange('description')}
              required
              placeholder={
                formData.cageCategory === '701' ? 'e.g., House at Colombo' :
                formData.cageCategory === '711' ? 'e.g., Toyota Prius' :
                'e.g., Fixed Deposit'
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateAcquired">Date Acquired *</Label>
            <Input
              id="dateAcquired"
              type="date"
              value={formData.dateAcquired}
              onChange={handleChange('dateAcquired')}
              required
            />
          </div>

          {/* Category-specific fields */}
          {formData.cageCategory === '701' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="address">Property Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={handleChange('address')}
                  required
                  placeholder="Full address of property"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deedNo">Deed Number</Label>
                <Input
                  id="deedNo"
                  value={formData.deedNo}
                  onChange={handleChange('deedNo')}
                  placeholder="Land registry deed number"
                />
              </div>
            </>
          )}

          {formData.cageCategory === '711' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="regNo">Registration Number *</Label>
                  <Input
                    id="regNo"
                    value={formData.regNo}
                    onChange={handleChange('regNo')}
                    required
                    placeholder="ABC-1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand/Model *</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={handleChange('brand')}
                    required
                    placeholder="e.g., Toyota Prius"
                  />
                </div>
              </div>
            </>
          )}

          {formData.cageCategory === '721' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank/Institution *</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={handleChange('bankName')}
                    required
                    placeholder="Bank or financial institution name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNo">Account Number</Label>
                  <Input
                    id="accountNo"
                    value={formData.accountNo}
                    onChange={handleChange('accountNo')}
                    placeholder="Account or certificate number"
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost/Acquisition Value *</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={handleChange('cost')}
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Amount paid to acquire this asset
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketValue">Current Market Value *</Label>
              <Input
                id="marketValue"
                type="number"
                min="0"
                step="0.01"
                value={formData.marketValue}
                onChange={handleChange('marketValue')}
                required
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Estimated current market value
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
            <h4 className="font-semibold text-sm">Asset Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Acquisition Cost:</p>
                <p className="font-bold">{formatLKR(Number(formData.cost))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Market Value:</p>
                <p className="font-bold text-green-600">{formatLKR(Number(formData.marketValue))}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Capital Gain/Loss:</p>
                <p className={`font-bold ${Number(formData.marketValue) - Number(formData.cost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatLKR(Number(formData.marketValue) - Number(formData.cost))}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {asset ? 'Update' : 'Add'} Asset
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
