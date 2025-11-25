/**
 * Settings Page
 * Manage entity profile, passphrase, and application settings
 */

import { useState } from 'react';
import { ArrowLeft, Settings as SettingsIcon, Download, Shield, User, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/stores/useStore';
import { ExportDialog } from '@/components/ExportDialog';
import { deriveKey } from '@/utils/crypto';

export function SettingsPage() {
  const navigate = useNavigate();
  const { entities, updateEntity, passphrase, setPassphrase } = useStore();
  const [showExport, setShowExport] = useState(false);
  const [showPassphraseChange, setShowPassphraseChange] = useState(false);
  const [oldPassphrase, setOldPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');

  const entity = entities[0];

  const handleEntityUpdate = (field: string, value: string) => {
    if (entity) {
      updateEntity(entity.id, { ...entity, [field]: value });
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
      await deriveKey(newPassphrase);
      setPassphrase(newPassphrase);
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

        {/* Entity Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Tax Entity Profile</CardTitle>
            </div>
            <CardDescription>Your personal or business information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name/Business Name</Label>
              <Input
                id="name"
                value={entity?.name || ''}
                onChange={(e) => handleEntityUpdate('name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tin">Tax Identification Number (TIN)</Label>
              <Input
                id="tin"
                value={entity?.tin || ''}
                onChange={(e) => handleEntityUpdate('tin', e.target.value)}
                placeholder="123456789V"
              />
            </div>
            <div>
              <Label htmlFor="nic">NIC Number</Label>
              <Input
                id="nic"
                value={entity?.nic || ''}
                onChange={(e) => handleEntityUpdate('nic', e.target.value)}
                placeholder="987654321V or 199012345678"
              />
            </div>
            <div>
              <Label htmlFor="type">Entity Type</Label>
              <select
                id="type"
                className="w-full px-3 py-2 border rounded-md"
                value={entity?.type || 'individual'}
                onChange={(e) => handleEntityUpdate('type', e.target.value)}
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
                <option value="partnership">Partnership</option>
                <option value="trust">Trust</option>
              </select>
            </div>
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
              <CardTitle>Export & Backup</CardTitle>
            </div>
            <CardDescription>Download your data and IRD submission files</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowExport(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Export Dialog */}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </div>
  );
}
