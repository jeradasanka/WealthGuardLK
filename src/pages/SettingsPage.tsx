/**
 * Settings Page
 * Manage entity profile, passphrase, and application settings
 */

import { useState } from 'react';
import { ArrowLeft, Settings as SettingsIcon, Download, Upload, Shield, User, Calendar, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/stores/useStore';
import { ExportDialog } from '@/components/ExportDialog';
import { ImportDialog } from '@/components/ImportDialog';
import { EntityForm } from '@/components/EntityForm';
import { deriveKey } from '@/utils/crypto';
import { storePassphrase, clearStoredPassphrase } from '@/utils/storage';

export function SettingsPage() {
  const navigate = useNavigate();
  const { entities, updateEntity, removeEntity, passphrase, setPassphrase, saveToStorage, addEntity, resetState } = useStore();
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPassphraseChange, setShowPassphraseChange] = useState(false);
  const [oldPassphrase, setOldPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [editingEntity, setEditingEntity] = useState<string | null>(null);

  const entity = entities[0];

  const handleEntityUpdate = (entityId: string, field: string, value: string) => {
    const entityToUpdate = entities.find(e => e.id === entityId);
    if (entityToUpdate) {
      updateEntity(entityId, { ...entityToUpdate, [field]: value });
    }
  };

  const handleRemoveEntity = (entityId: string) => {
    if (entities.length <= 1) {
      alert('Cannot remove the last entity. You must have at least one taxpayer.');
      return;
    }
    if (confirm('Are you sure you want to remove this family member? This will also remove their associated income, assets, and liabilities.')) {
      removeEntity(entityId);
    }
  };

  const handleClearAllData = () => {
    if (confirm('⚠️ WARNING: This will permanently delete ALL your data including entities, income, assets, and liabilities. This action cannot be undone.\n\nAre you absolutely sure?')) {
      if (confirm('Last chance! Are you REALLY sure you want to delete everything?')) {
        // Clear localStorage
        clearStoredPassphrase();
        // Clear cookies by resetting state
        resetState();
        // Redirect to setup
        navigate('/setup');
      }
    }
  };

  const handlePassphraseChange = async () => {
    setError('');

    if (oldPassphrase !== passphrase) {
      setError('Current passphrase is incorrect');
      return;
    }

    if (newPassphrase.length < 12) {
      setError('New passphrase must be at least 12 characters');
      return;
    }

    if (newPassphrase !== confirmPassphrase) {
      setError('New passphrases do not match');
      return;
    }

    try {
      // Derive new key to verify it works
      const salt = crypto.getRandomValues(new Uint8Array(16));
      await deriveKey(newPassphrase, salt);
      setPassphrase(newPassphrase);
      storePassphrase(newPassphrase); // Store in localStorage
      await saveToStorage(); // Re-save with new passphrase
      setShowPassphraseChange(false);
      setOldPassphrase('');
      setNewPassphrase('');
      setConfirmPassphrase('');
      alert('Passphrase changed successfully. Please backup your data with the new passphrase.');
    } catch (err) {
      setError('Failed to change passphrase');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-gray-600">Manage your profile and preferences</p>
            </div>
          </div>
          <SettingsIcon className="h-8 w-8 text-gray-600" />
        </div>

        {/* Family Members / Tax Entities */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <div>
                  <CardTitle>Family Members / Tax Entities</CardTitle>
                  <CardDescription>Manage individual and family taxpayer profiles</CardDescription>
                </div>
              </div>
              <Button onClick={() => setShowAddFamily(true)} size="sm">
                Add Family Member
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {entities.map((ent, index) => (
              <div key={ent.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">
                    {index === 0 ? '👤 Primary Taxpayer' : '👥 Family Member'}
                  </h4>
                  {entities.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEntity(ent.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`name-${ent.id}`}>Name</Label>
                    <Input
                      id={`name-${ent.id}`}
                      value={ent.name}
                      onChange={(e) => handleEntityUpdate(ent.id, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`tin-${ent.id}`}>TIN</Label>
                    <Input
                      id={`tin-${ent.id}`}
                      value={ent.tin || ''}
                      onChange={(e) => handleEntityUpdate(ent.id, 'tin', e.target.value)}
                      placeholder="123456789V"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`nic-${ent.id}`}>NIC</Label>
                    <Input
                      id={`nic-${ent.id}`}
                      value={ent.nic || ''}
                      onChange={(e) => handleEntityUpdate(ent.id, 'nic', e.target.value)}
                      placeholder="987654321V"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`type-${ent.id}`}>Type</Label>
                    <select
                      id={`type-${ent.id}`}
                      className="w-full px-3 py-2 border rounded-md"
                      value={ent.type}
                      onChange={(e) => handleEntityUpdate(ent.id, 'type', e.target.value)}
                    >
                      <option value="individual">Individual</option>
                      <option value="company">Company</option>
                      <option value="partnership">Partnership</option>
                      <option value="trust">Trust</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tax Year Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Tax Year</CardTitle>
            </div>
            <CardDescription>Select the tax year for reporting</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="taxYear">Tax Year</Label>
              <select
                id="taxYear"
                className="w-full px-3 py-2 border rounded-md"
                value={entity?.taxYear || '2024'}
                onChange={(e) => handleEntityUpdate('taxYear', e.target.value)}
              >
                <option value="2022">2022</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage your passphrase and encryption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showPassphraseChange ? (
              <Button onClick={() => setShowPassphraseChange(true)} variant="outline">
                Change Passphrase
              </Button>
            ) : (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="oldPassphrase">Current Passphrase</Label>
                  <Input
                    id="oldPassphrase"
                    type="password"
                    value={oldPassphrase}
                    onChange={(e) => setOldPassphrase(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newPassphrase">New Passphrase (min 12 characters)</Label>
                  <Input
                    id="newPassphrase"
                    type="password"
                    value={newPassphrase}
                    onChange={(e) => setNewPassphrase(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassphrase">Confirm New Passphrase</Label>
                  <Input
                    id="confirmPassphrase"
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button onClick={handlePassphraseChange}>Save New Passphrase</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPassphraseChange(false);
                      setError('');
                      setOldPassphrase('');
                      setNewPassphrase('');
                      setConfirmPassphrase('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
              <p className="font-medium mb-1">Security Notice:</p>
              <p>Your passphrase is used to encrypt all data locally. If you forget it, your data cannot be recovered.</p>
            </div>
          </CardContent>
        </Card>

        {/* Export & Backup */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              <CardTitle>Backup & Restore</CardTitle>
            </div>
            <CardDescription>Export and import encrypted backup files</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={() => setShowExport(true)}>
                <Download className="mr-2 h-4 w-4" />
                Export Backup
              </Button>
              <Button onClick={() => setShowImport(true)} variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import Backup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </div>
            <CardDescription>Irreversible actions - proceed with caution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded border border-red-200">
                <p className="text-sm text-red-800 mb-3">
                  <strong>Clear All Data:</strong> This will permanently delete all entities, income, assets, liabilities, and settings. You will be redirected to the initial setup screen.
                </p>
                <Button 
                  variant="destructive"
                  onClick={handleClearAllData}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Data & Reset App
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Dialog */}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      
      {/* Import Dialog */}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
      
      {/* Add Family Member Dialog */}
      {showAddFamily && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <EntityForm
              onSave={(entityData) => {
                const newEntity = {
                  ...entityData,
                  id: crypto.randomUUID(),
                  createdAt: new Date().toISOString(),
                  taxYear: entities[0]?.taxYear || '2024',
                  type: 'individual' as const,
                };
                addEntity(newEntity);
                saveToStorage();
                setShowAddFamily(false);
              }}
              onCancel={() => setShowAddFamily(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
