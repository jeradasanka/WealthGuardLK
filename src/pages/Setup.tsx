/**
 * Setup Page
 * Initial setup for creating tax entities and setting passphrase
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Users, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/EntityForm';
import { ImportDialog } from '@/components/ImportDialog';
import { useStore } from '@/stores/useStore';
import { generatePassphrase } from '@/utils/crypto';
import type { TaxEntity } from '@/types';

export function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'welcome' | 'passphrase' | 'entity'>('welcome');
  const [passphrase, setPassphraseInput] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [generatedPassphrase, setGeneratedPassphrase] = useState('');
  const [showImport, setShowImport] = useState(false);
  
  const setStorePassphrase = useStore((state) => state.setPassphrase);
  const addEntity = useStore((state) => state.addEntity);
  const saveToStorage = useStore((state) => state.saveToStorage);

  const handleGeneratePassphrase = () => {
    const generated = generatePassphrase();
    setGeneratedPassphrase(generated);
    setPassphraseInput(generated);
    setConfirmPassphrase(generated);
  };

  const handlePassphraseSubmit = () => {
    if (passphrase !== confirmPassphrase) {
      alert('Passphrases do not match!');
      return;
    }
    if (passphrase.length < 8) {
      alert('Passphrase must be at least 8 characters long');
      return;
    }
    setStorePassphrase(passphrase);
    setStep('entity');
  };

  const handleEntitySave = async (entityData: Omit<TaxEntity, 'id' | 'createdAt'>) => {
    const entity: TaxEntity = {
      ...entityData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    
    addEntity(entity);
    
    try {
      await saveToStorage();
      navigate('/');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save data. Please try again.');
    }
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src="/icon.png" alt="WealthGuard LK Logo" className="w-16 h-16" />
            </div>
            <CardTitle className="text-3xl">Welcome to WealthGuard LK</CardTitle>
            <CardDescription className="text-base mt-2">
              Your private, offline Sri Lankan tax compliance assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <Lock className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold">Zero-Knowledge Privacy</h3>
                  <p className="text-sm text-muted-foreground">
                    All data is encrypted and stored locally in your browser. Nothing is sent to any server.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <Users className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold">Family Wealth Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Track assets, liabilities, and income for you and your spouse with joint asset management.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <Shield className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold">Audit Risk Detection</h3>
                  <p className="text-sm text-muted-foreground">
                    The "Danger Meter" warns you about unexplained wealth before you file your IRD return.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button onClick={() => setStep('passphrase')} className="w-full" size="lg">
                Get Started - Create New Profile
              </Button>
              <Button 
                onClick={() => setShowImport(true)} 
                variant="outline" 
                className="w-full" 
                size="lg"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import from Backup
              </Button>
            </div>
            
            <p className="text-xs text-center text-gray-500">
              Already have a backup? Import it to restore your data and skip setup.
            </p>
          </CardContent>
        </Card>
        
        {/* Import Dialog */}
        {showImport && <ImportDialog onClose={() => setShowImport(false)} redirectToDashboard={true} />}
      </div>
    );
  }

  if (step === 'passphrase') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Create Your Passphrase</CardTitle>
            <CardDescription>
              This passphrase will encrypt all your data. Keep it safe - you cannot recover it if lost!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passphrase">Passphrase *</Label>
              <Input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="Enter a strong passphrase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Passphrase *</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Re-enter your passphrase"
              />
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium mb-2">Or generate a secure passphrase:</p>
              {generatedPassphrase && (
                <p className="font-mono text-sm bg-white p-2 rounded mb-2 break-all">
                  {generatedPassphrase}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassphrase}
              >
                Generate Random Passphrase
              </Button>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handlePassphraseSubmit} className="flex-1">
                Continue
              </Button>
              <Button variant="outline" onClick={() => setStep('welcome')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <EntityForm
          onSave={handleEntitySave}
          onCancel={() => setStep('passphrase')}
        />
      </div>
    </div>
  );
}
