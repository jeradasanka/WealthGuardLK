/**
 * Asset Form Component (FR-05)
 * Handles asset creation/editing with category-specific fields
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import type { Asset } from '@/types';
import { formatLKR, calculatePreciousItemMarketValue } from '@/lib/taxEngine';

interface AssetFormProps {
  asset?: Asset;
  onSave?: () => void;
  onCancel?: () => void;
}

export function AssetForm({ asset, onSave, onCancel }: AssetFormProps) {
  const entities = useStore((state) => state.entities);
  const currentTaxYear = useStore((state) => state.currentTaxYear);
  const addAsset = useStore((state) => state.addAsset);
  const updateAsset = useStore((state) => state.updateAsset);
  const removeAsset = useStore((state) => state.removeAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const [formData, setFormData] = useState({
    ownerId: asset?.ownerId || entities[0]?.id || '',
    ownershipShares: asset?.ownershipShares || [],
    multipleOwners: (asset?.ownershipShares && asset.ownershipShares.length > 0) || false,
    cageCategory: asset?.cageCategory || ('A' as 'A' | 'Bi' | 'Bii' | 'Biii' | 'Biv' | 'Bv' | 'Bvi' | 'C'),
    description: asset?.meta.description || '',
    dateAcquired: asset?.meta.dateAcquired || new Date().toISOString().split('T')[0],
    cost: asset?.financials.cost || 0,
    marketValue: asset?.financials.marketValue || 0,
    // A - Immovable Properties
    address: asset?.meta.address || '',
    deedNo: asset?.meta.deedNo || '',
    extentArea: asset?.meta.extentArea || '',
    // Bi - Motor Vehicles
    regNo: asset?.meta.regNo || '',
    brand: asset?.meta.brand || '',
    model: asset?.meta.model || '',
    // Bii - Bank Balances / Term Deposits
    accountNo: asset?.meta.accountNo || '',
    bankName: asset?.meta.bankName || '',
    accountType: asset?.meta.accountType || '',
    currency: asset?.meta.currency || 'LKR',
    // Biii - Shares/stocks/securities
    companyName: asset?.meta.companyName || '',
    numberOfShares: asset?.meta.numberOfShares || 0,
    certificateNo: asset?.meta.certificateNo || '',
    // Bv - Loans given & amount receivable
    borrowerName: asset?.meta.borrowerName || '',
    agreementNo: asset?.meta.agreementNo || '',
    interestRate: asset?.meta.interestRate || 0,
    // Bvi - Gold, silver, gems, jewellery
    itemType: asset?.meta.itemType || '',
    weight: asset?.meta.weight || 0,
    purity: asset?.meta.purity || '',
    // C - Business properties
    businessName: asset?.meta.businessName || '',
    businessRegNo: asset?.meta.businessRegNo || '',
    // Close fields for financial assets (Bii, Biv, Bv)
    isClosed: !!asset?.closed,
    closedDate: asset?.closed?.date || '',
    finalBalance: asset?.closed?.finalBalance || 0,
    // Sold fields for jewellery assets (Bvi)
    isSold: !!asset?.disposed,
    soldDate: asset?.disposed?.date || '',
    salePrice: asset?.disposed?.salePrice || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate ownership percentages if multiple owners
    if (formData.multipleOwners && formData.ownershipShares.length > 0) {
      const totalPercentage = formData.ownershipShares.reduce((sum, share) => sum + share.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        alert('Total ownership percentage must equal 100%');
        return;
      }
    }

    const assetData: Asset = {
      id: asset?.id || crypto.randomUUID(),
      ownerId: formData.multipleOwners ? '' : formData.ownerId,
      ownershipShares: formData.multipleOwners ? formData.ownershipShares : undefined,
      cageCategory: formData.cageCategory,
      meta: {
        description: formData.description,
        dateAcquired: formData.dateAcquired,
        ...(formData.cageCategory === 'A' && {
          address: formData.address,
          deedNo: formData.deedNo,
          extentArea: formData.extentArea,
        }),
        ...(formData.cageCategory === 'Bi' && {
          regNo: formData.regNo,
          brand: formData.brand,
          model: formData.model,
        }),
        ...(formData.cageCategory === 'Bii' && {
          accountNo: formData.accountNo,
          bankName: formData.bankName,
          accountType: formData.accountType,
          currency: formData.currency,
        }),
        ...(formData.cageCategory === 'Biii' && {
          companyName: formData.companyName,
          numberOfShares: formData.numberOfShares,
          certificateNo: formData.certificateNo,
        }),
        ...(formData.cageCategory === 'Bv' && {
          borrowerName: formData.borrowerName,
          agreementNo: formData.agreementNo,
          interestRate: formData.interestRate,
        }),
        ...(formData.cageCategory === 'Bvi' && {
          itemType: formData.itemType,
          weight: formData.weight,
          purity: formData.purity,
        }),
        ...(formData.cageCategory === 'C' && {
          businessName: formData.businessName,
          businessRegNo: formData.businessRegNo,
        }),
      },
      financials: {
        cost: Number(formData.cost),
        // Auto-calculate market value based on category
        marketValue: formData.isClosed ? 0 : formData.isSold ? 0 :
          // For Biv (Cash), Bii (Bank), Bv (Loans Given), market value equals cost
          (formData.cageCategory === 'Biv' || formData.cageCategory === 'Bii' || formData.cageCategory === 'Bv') 
            ? Number(formData.cost)
          // For Bvi (Jewellery), auto-calculate using price appreciation
          : formData.cageCategory === 'Bvi'
            ? calculatePreciousItemMarketValue(
                Number(formData.cost),
                formData.itemType || 'Other',
                formData.dateAcquired.substring(0, 4),
                (parseInt(currentTaxYear) + 1).toString()
              )
          // For other categories, use user-entered market value
          : Number(formData.marketValue),
        sourceOfFunds: asset?.financials.sourceOfFunds,
      },
      fundingSources: asset?.fundingSources,
      balances: asset?.balances,
      closed: formData.isClosed ? {
        date: formData.closedDate,
        finalBalance: Number(formData.finalBalance),
      } : undefined,
      disposed: formData.isSold ? {
        date: formData.soldDate,
        salePrice: Number(formData.salePrice),
      } : undefined,
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

  const handleDelete = () => {
    if (!asset?.id) return;
    
    const categoryLabel = getCategoryLabel().toLowerCase();
    const verification = window.prompt(
      `⚠️ WARNING: You are about to permanently delete this ${categoryLabel}.\n\n` +
      `Asset: ${formData.description || 'Untitled'}\n` +
      `Category: ${getCategoryLabel()} (Cage ${formData.cageCategory})\n` +
      `Acquired: ${formData.dateAcquired}\n` +
      `Cost: ${formatLKR(formData.cost)}\n\n` +
      `This action CANNOT be undone. All data including balance history will be permanently lost.\n\n` +
      `To confirm deletion, type DELETE in capital letters:`
    );
    
    if (verification === 'DELETE') {
      removeAsset(asset.id);
      saveToStorage();
      onCancel?.(); // Close form and return to list
    } else if (verification !== null) {
      alert('Deletion cancelled. The verification text did not match.');
    }
  };

  const getCategoryLabel = () => {
    switch (formData.cageCategory) {
      case 'A':
        return 'Immovable Properties';
      case 'Bi':
        return 'Motor Vehicles';
      case 'Bii':
        return 'Bank Balances / Term Deposits';
      case 'Biii':
        return 'Shares/Stocks/Securities';
      case 'Biv':
        return 'Cash in Hand';
      case 'Bv':
        return 'Loans Given & Amount Receivable';
      case 'Bvi':
        return 'Gold, Silver, Gems, Jewellery';
      case 'C':
        return 'Properties Held as Part of Business';
      default:
        return 'Asset';
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
            <Label htmlFor="multipleOwners">Ownership Type</Label>
            <select
              id="multipleOwners"
              value={formData.multipleOwners ? 'multiple' : 'single'}
              onChange={(e) => {
                const isMultiple = e.target.value === 'multiple';
                setFormData((prev) => ({
                  ...prev,
                  multipleOwners: isMultiple,
                  ownershipShares: isMultiple
                    ? entities.map((entity) => ({ entityId: entity.id, percentage: 100 / entities.length }))
                    : [],
                }));
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="single">Single Owner</option>
              <option value="multiple">Multiple Owners (Joint Ownership)</option>
            </select>
          </div>

          {!formData.multipleOwners && (
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
          )}

          {formData.multipleOwners && (
            <div className="space-y-2 border rounded-lg p-4 bg-slate-50">
              <Label>Ownership Distribution *</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Specify ownership percentage for each owner (total must equal 100%)
              </p>
              {formData.ownershipShares.map((share, index) => {
                const entity = entities.find((e) => e.id === share.entityId);
                return (
                  <div key={share.entityId} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-sm">{entity?.name}</Label>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={share.percentage}
                        onChange={(e) => {
                          const newShares = [...formData.ownershipShares];
                          newShares[index].percentage = Number(e.target.value);
                          setFormData((prev) => ({ ...prev, ownershipShares: newShares }));
                        }}
                        required
                        className="text-right"
                      />
                    </div>
                    <span className="text-sm font-medium">%</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total:</span>
                  <span className={`text-sm font-bold ${
                    Math.abs(formData.ownershipShares.reduce((sum, s) => sum + s.percentage, 0) - 100) < 0.01
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {formData.ownershipShares.reduce((sum, s) => sum + s.percentage, 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cageCategory">Asset Category *</Label>
            <select
              id="cageCategory"
              value={formData.cageCategory}
              onChange={handleChange('cageCategory')}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="A">A - Immovable Properties (Land, House, Building)</option>
              <option value="Bi">Bi - Motor Vehicles</option>
              <option value="Bii">Bii - Bank Balances / Term Deposits</option>
              <option value="Biii">Biii - Shares/Stocks/Securities</option>
              <option value="Biv">Biv - Cash in Hand</option>
              <option value="Bv">Bv - Loans Given & Amount Receivable</option>
              <option value="Bvi">Bvi - Gold, Silver, Gems, Jewellery</option>
              <option value="C">C - Properties Held as Part of Business</option>
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
                formData.cageCategory === 'A' ? 'e.g., House at Colombo' :
                formData.cageCategory === 'Bi' ? 'e.g., Toyota Prius 2020' :
                formData.cageCategory === 'Bii' ? 'e.g., Fixed Deposit at Bank of Ceylon' :
                formData.cageCategory === 'Biii' ? 'e.g., Shares in ABC Company' :
                formData.cageCategory === 'Biv' ? 'e.g., Cash kept at home' :
                formData.cageCategory === 'Bv' ? 'e.g., Loan given to Mr. Silva' :
                formData.cageCategory === 'Bvi' ? 'e.g., Gold jewellery' :
                formData.cageCategory === 'C' ? 'e.g., Shop building' :
                'e.g., Asset description'
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
          {formData.cageCategory === 'A' && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deedNo">Deed Number</Label>
                  <Input
                    id="deedNo"
                    value={formData.deedNo}
                    onChange={handleChange('deedNo')}
                    placeholder="Land registry deed number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extentArea">Extent/Area</Label>
                  <Input
                    id="extentArea"
                    value={formData.extentArea}
                    onChange={handleChange('extentArea')}
                  placeholder="e.g., 10 perches, 2 acres"
                />
              </div>
            </div>

            {/* Sold Section for Immovable Properties */}
            {asset && (
              <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isSold"
                      checked={formData.isSold}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          isSold: e.target.checked,
                          soldDate: e.target.checked ? (prev.soldDate || new Date().toISOString().split('T')[0]) : '',
                          salePrice: e.target.checked ? prev.salePrice : 0,
                        }));
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isSold" className="font-semibold">
                      {formData.isSold ? 'Property Sold (Uncheck to Mark as Unsold)' : 'Mark Property as Sold'}
                    </Label>
                  </div>

                  {formData.isSold && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div className="space-y-2">
                        <Label htmlFor="soldDate">Sale Date *</Label>
                        <Input
                          id="soldDate"
                          type="date"
                          value={formData.soldDate}
                          onChange={handleChange('soldDate')}
                          required={formData.isSold}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="salePrice">Sale Price *</Label>
                        <Input
                          id="salePrice"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.salePrice}
                          onChange={handleChange('salePrice')}
                          placeholder="0.00"
                          required={formData.isSold}
                        />
                        <p className="text-xs text-muted-foreground">
                          Price received from sale
                        </p>
                      </div>
                    </div>
                  )}

                  {formData.isSold && (
                    <p className="text-xs text-orange-700 mt-2">
                      💡 When marked as sold, this property will be flagged but remain visible in your records for reference.
                    </p>
                  )}
                </div>
              </div>
            )}
            </>
          )}

          {formData.cageCategory === 'Bi' && (
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
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={handleChange('brand')}
                    placeholder="e.g., Toyota"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={handleChange('model')}
                  placeholder="e.g., Prius 2020"
                />
              </div>

              {/* Sold Section for Motor Vehicles */}
              {asset && (
                <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isSold"
                        checked={formData.isSold}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            isSold: e.target.checked,
                            soldDate: e.target.checked ? (prev.soldDate || new Date().toISOString().split('T')[0]) : '',
                            salePrice: e.target.checked ? prev.salePrice : 0,
                          }));
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="isSold" className="font-semibold">
                        {formData.isSold ? 'Vehicle Sold (Uncheck to Mark as Unsold)' : 'Mark Vehicle as Sold'}
                      </Label>
                    </div>

                    {formData.isSold && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <Label htmlFor="soldDate">Sale Date *</Label>
                          <Input
                            id="soldDate"
                            type="date"
                            value={formData.soldDate}
                            onChange={handleChange('soldDate')}
                            required={formData.isSold}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="salePrice">Sale Price *</Label>
                          <Input
                            id="salePrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.salePrice}
                            onChange={handleChange('salePrice')}
                            placeholder="0.00"
                            required={formData.isSold}
                          />
                        </div>
                      </div>
                    )}

                    {formData.isSold && (
                      <p className="text-xs text-orange-700 mt-2">
                        💡 When marked as sold, this vehicle will be flagged but remain visible in your records for reference.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {formData.cageCategory === 'Bii' && (
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
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Input
                  id="accountType"
                  value={formData.accountType}
                  onChange={handleChange('accountType')}
                  placeholder="e.g., Savings, Current, Fixed Deposit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <select
                  id="currency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.currency}
                  onChange={handleChange('currency')}
                  required
                >
                  <option value="LKR">🇱🇰 LKR (Sri Lankan Rupee)</option>
                  <option value="USD">🇺🇸 USD (US Dollar)</option>
                  <option value="EUR">🇪🇺 EUR (Euro)</option>
                  <option value="GBP">🇬🇧 GBP (British Pound)</option>
                  <option value="AUD">🇦🇺 AUD (Australian Dollar)</option>
                  <option value="CAD">🇨🇦 CAD (Canadian Dollar)</option>
                  <option value="JPY">🇯🇵 JPY (Japanese Yen)</option>
                  <option value="CNY">🇨🇳 CNY (Chinese Yuan)</option>
                  <option value="INR">🇮🇳 INR (Indian Rupee)</option>
                  <option value="SGD">🇸🇬 SGD (Singapore Dollar)</option>
                </select>
                {formData.currency !== 'LKR' && (
                  <p className="text-xs text-muted-foreground">
                    💡 Foreign currency deposits require exchange rates in balance records for accurate LKR valuation
                  </p>
                )}
              </div>

              {/* Account Closure Section */}
              {asset && (
                <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isClosed"
                        checked={formData.isClosed}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            isClosed: e.target.checked,
                            closedDate: e.target.checked ? (prev.closedDate || new Date().toISOString().split('T')[0]) : '',
                            finalBalance: e.target.checked ? prev.finalBalance : 0,
                          }));
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="isClosed" className="font-semibold">
                        {formData.isClosed ? 'Account Closed (Uncheck to Reopen)' : 'Mark Account as Closed'}
                      </Label>
                    </div>

                    {formData.isClosed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <Label htmlFor="closedDate">Closure Date *</Label>
                          <Input
                            id="closedDate"
                            type="date"
                            value={formData.closedDate}
                            onChange={handleChange('closedDate')}
                            required={formData.isClosed}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="finalBalance">Final Balance</Label>
                          <Input
                            id="finalBalance"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.finalBalance}
                            onChange={handleChange('finalBalance')}
                            placeholder="0.00"
                          />
                          <p className="text-xs text-muted-foreground">
                            Final balance at closure (if any)
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {formData.isClosed
                        ? 'This account is marked as closed and excluded from current assets, but kept for historical records. Uncheck to reopen the account.'
                        : 'Check this box if this account has been closed.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {formData.cageCategory === 'Biii' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={handleChange('companyName')}
                    required
                    placeholder="Name of the company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfShares">Number of Shares</Label>
                  <Input
                    id="numberOfShares"
                    type="number"
                    min="0"
                    value={formData.numberOfShares}
                    onChange={handleChange('numberOfShares')}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="certificateNo">Certificate Number</Label>
                <Input
                  id="certificateNo"
                  value={formData.certificateNo}
                  onChange={handleChange('certificateNo')}
                  placeholder="Share certificate number"
                />
              </div>
            </>
          )}

          {/* Biv - Cash in Hand has no special fields */}

          {formData.cageCategory === 'Bv' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="borrowerName">Borrower Name *</Label>
                <Input
                  id="borrowerName"
                  value={formData.borrowerName}
                  onChange={handleChange('borrowerName')}
                  required
                  placeholder="Name of the borrower"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agreementNo">Agreement Number</Label>
                  <Input
                    id="agreementNo"
                    value={formData.agreementNo}
                    onChange={handleChange('agreementNo')}
                    placeholder="Loan agreement reference"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interestRate">Interest Rate (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.interestRate}
                    onChange={handleChange('interestRate')}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          )}

          {formData.cageCategory === 'Bvi' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="itemType">Item Type *</Label>
                  <select
                    id="itemType"
                    value={formData.itemType}
                    onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                    required
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="">Select item type</option>
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Gems">Gems</option>
                    <option value="Jewellery">Jewellery</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Ruby">Ruby</option>
                    <option value="Sapphire">Sapphire</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    value={formData.weight}
                    onChange={handleChange('weight')}
                    placeholder="e.g., 10g, 2 carats"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purity">Purity/Grade</Label>
                <Input
                  id="purity"
                  value={formData.purity}
                  onChange={handleChange('purity')}
                  placeholder="e.g., 22K, 24K, 999"
                />
              </div>

              {/* Auto-calculation notice */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  ℹ️ <strong>Market value will be calculated automatically</strong> based on the item type, acquisition date, and current commodity prices (2015-2025 appreciation data).
                </p>
              </div>

              {/* Sold Section for Jewellery */}
              {asset && (
                <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isSold"
                        checked={formData.isSold}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            isSold: e.target.checked,
                            soldDate: e.target.checked ? (prev.soldDate || new Date().toISOString().split('T')[0]) : '',
                            salePrice: e.target.checked ? prev.salePrice : 0,
                          }));
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="isSold" className="font-semibold">
                        {formData.isSold ? 'Item Sold (Uncheck to Mark as Unsold)' : 'Mark Item as Sold'}
                      </Label>
                    </div>

                    {formData.isSold && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div className="space-y-2">
                          <Label htmlFor="soldDate">Sale Date *</Label>
                          <Input
                            id="soldDate"
                            type="date"
                            value={formData.soldDate}
                            onChange={handleChange('soldDate')}
                            required={formData.isSold}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="salePrice">Sale Price *</Label>
                          <Input
                            id="salePrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.salePrice}
                            onChange={handleChange('salePrice')}
                            placeholder="0.00"
                            required={formData.isSold}
                          />
                          <p className="text-xs text-muted-foreground">
                            Price received from sale
                          </p>
                        </div>
                      </div>
                    )}

                    {formData.isSold && (
                      <p className="text-xs text-orange-700 mt-2">
                        💡 When marked as sold, this item will be flagged but remain visible in your records for reference.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {formData.cageCategory === 'C' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={handleChange('businessName')}
                    required
                    placeholder="Name of the business"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessRegNo">Business Registration Number</Label>
                  <Input
                    id="businessRegNo"
                    value={formData.businessRegNo}
                    onChange={handleChange('businessRegNo')}
                    placeholder="Business registration or BR number"
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">
                {formData.cageCategory === 'Biv' ? 'Amount *' :
                 formData.cageCategory === 'Bii' ? 'Amount *' :
                 formData.cageCategory === 'Bv' ? 'Loan Amount *' :
                 'Cost/Acquisition Value *'}
              </Label>
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
                {formData.cageCategory === 'Biv' ? 'Cash amount in hand' :
                 formData.cageCategory === 'Bii' ? 'Account balance or deposit amount' :
                 formData.cageCategory === 'Bv' ? 'Amount loaned or receivable' :
                 'Amount paid to acquire this asset'}
              </p>
            </div>

            {/* Only show market value for categories that need it */}
            {formData.cageCategory !== 'Biv' && formData.cageCategory !== 'Bii' && formData.cageCategory !== 'Bv' && formData.cageCategory !== 'Bvi' && (
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
            )}
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
            <h4 className="font-semibold text-sm">Asset Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {formData.cageCategory === 'Biv' ? 'Cash Amount:' :
                   formData.cageCategory === 'Bii' ? 'Balance:' :
                   formData.cageCategory === 'Bv' ? 'Loan Amount:' :
                   'Acquisition Cost:'}
                </p>
                <p className="font-bold">{formatLKR(Number(formData.cost))}</p>
              </div>
              {formData.cageCategory !== 'Biv' && formData.cageCategory !== 'Bii' && formData.cageCategory !== 'Bv' && (
                <>
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
                </>
              )}
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
            {asset && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
