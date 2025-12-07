/**
 * Valuation Form Component
 * Manages yearly valuations for Immovable Properties (A) and Motor Vehicles (Bi)
 * IRD Cage A & Bi compliance
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit } from 'lucide-react';
import type { Asset, ValuationEntry } from '@/types';
import { formatLKR } from '@/lib/taxEngine';
import { useStore } from '@/stores/useStore';
import { getCurrentTaxYear, getTaxYearForDate, formatTaxYear } from '@/lib/taxYear';

interface ValuationFormProps {
  asset: Asset;
  onClose: () => void;
}

export function ValuationForm({ asset, onClose }: ValuationFormProps) {
  const updateAsset = useStore((state) => state.updateAsset);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const entities = useStore((state) => state.entities);

  const [valuations, setValuations] = useState<ValuationEntry[]>(
    asset.valuations || []
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    taxYear: getCurrentTaxYear(),
    marketValue: 0,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Get available tax years from acquisition date to current year
  const getAvailableTaxYears = () => {
    const acquisitionYear = parseInt(getTaxYearForDate(asset.meta.dateAcquired));
    const currentYear = parseInt(getCurrentTaxYear());
    const years: string[] = [];
    
    for (let year = currentYear; year >= acquisitionYear; year--) {
      years.push(year.toString());
    }
    
    return years;
  };

  const taxYears = getAvailableTaxYears();

  const handleAddValuation = () => {
    const valuation: ValuationEntry = {
      id: crypto.randomUUID(),
      taxYear: formData.taxYear,
      marketValue: formData.marketValue,
      date: formData.date,
      notes: formData.notes,
    };

    const updatedValuations = [...valuations, valuation].sort(
      (a, b) => b.taxYear.localeCompare(a.taxYear)
    );
    setValuations(updatedValuations);
    resetForm();
  };

  const handleUpdateValuation = () => {
    if (!editingId) return;

    const updatedValuations = valuations.map(v =>
      v.id === editingId ? { ...v, ...formData } : v
    ).sort((a, b) => b.taxYear.localeCompare(a.taxYear));
    
    setValuations(updatedValuations);
    resetForm();
  };

  const handleDeleteValuation = (id: string) => {
    if (window.confirm('Are you sure you want to delete this valuation?')) {
      setValuations(valuations.filter((v) => v.id !== id));
    }
  };

  const handleSave = async () => {
    updateAsset(asset.id, {
      ...asset,
      valuations: valuations,
    });
    await saveToStorage();
    onClose();
  };

  const handleEditValuation = (valuation: ValuationEntry) => {
    setEditingId(valuation.id);
    setFormData({
      taxYear: valuation.taxYear,
      marketValue: valuation.marketValue,
      date: valuation.date,
      notes: valuation.notes || '',
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({
      taxYear: getCurrentTaxYear(),
      marketValue: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const getEntityName = (ownerId: string) => {
    return entities.find((e) => e.id === ownerId)?.name || 'Unknown';
  };

  const ownerName = asset.ownerId
    ? getEntityName(asset.ownerId)
    : asset.ownershipShares
      ? 'Joint Ownership'
      : 'Unknown';

  const getCategoryLabel = () => {
    if (asset.cageCategory === 'A') return 'Immovable Property';
    if (asset.cageCategory === 'Bi') return 'Motor Vehicle';
    return 'Asset';
  };

  const latestValuation = valuations.length > 0 
    ? valuations.sort((a, b) => b.taxYear.localeCompare(a.taxYear))[0]
    : null;

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Asset Valuations - IRD Cage {asset.cageCategory}</CardTitle>
        <CardDescription>
          {asset.meta.description} • {ownerName}
          <br />
          Track yearly market valuations for {getCategoryLabel()} (IRD compliance)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Valuation Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <p className="text-sm text-muted-foreground">Initial Cost</p>
            <p className="text-xl font-semibold">{formatLKR(asset.financials.cost)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Market Value</p>
            <p className="text-xl font-semibold text-green-600">{formatLKR(asset.financials.marketValue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Latest Valuation</p>
            <p className="text-2xl font-bold text-blue-600">
              {latestValuation ? formatLKR(latestValuation.marketValue) : 'N/A'}
            </p>
            {latestValuation && (
              <p className="text-xs text-muted-foreground">
                Tax Year {formatTaxYear(latestValuation.taxYear)}
              </p>
            )}
          </div>
        </div>

        {/* Add/Edit Valuation Button */}
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Valuation
          </Button>
        )}

        {/* Add/Edit Valuation Form */}
        {showAddForm && (
          <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
            <h3 className="font-semibold">{editingId ? 'Edit Valuation' : 'New Valuation'}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxYear">Tax Year *</Label>
                <select
                  id="taxYear"
                  value={formData.taxYear}
                  onChange={(e) => setFormData({ ...formData, taxYear: e.target.value })}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {taxYears.map((year) => (
                    <option key={year} value={year}>
                      {formatTaxYear(year)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Valuation Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketValue">Market Value (LKR) *</Label>
              <Input
                id="marketValue"
                type="number"
                min="0"
                step="0.01"
                value={formData.marketValue}
                onChange={(e) => setFormData({ ...formData, marketValue: Number(e.target.value) })}
                placeholder="0.00"
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter the market valuation for this {getCategoryLabel().toLowerCase()} for this tax year
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., Professional valuation, Comparable sales, Online estimate"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={editingId ? handleUpdateValuation : handleAddValuation}
                disabled={!formData.marketValue || formData.marketValue <= 0}
              >
                {editingId ? 'Update Valuation' : 'Add Valuation'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Valuations List */}
        {valuations.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-semibold">Valuation History</h3>
            <div className="border rounded-lg divide-y">
              {valuations
                .sort((a, b) => b.taxYear.localeCompare(a.taxYear))
                .map((valuation) => (
                  <div key={valuation.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full font-semibold bg-blue-100 text-blue-700">
                            Tax Year {formatTaxYear(valuation.taxYear)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(valuation.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-blue-600 mt-1">
                          Market Value: {formatLKR(valuation.marketValue)}
                        </p>
                        {valuation.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Note: {valuation.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditValuation(valuation)}
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteValuation(valuation.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            <p>No valuations recorded yet.</p>
            <p className="text-sm mt-1">Add yearly valuations to track asset value changes for IRD compliance.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
