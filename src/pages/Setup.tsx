/**
 * Setup Page
 * Initial setup for creating tax entities and setting passphrase
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Users, Upload, Sparkles, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/EntityForm';
import { ImportDialog } from '@/components/ImportDialog';
import { useStore } from '@/stores/useStore';
import { generatePassphrase } from '@/utils/crypto';
import { importData } from '@/utils/storage';
import { loadGsiScript, getGoogleAccessToken, searchBackupFile, downloadBackupFile } from '@/utils/googleDrive';
import type { TaxEntity } from '@/types';

export function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'welcome' | 'passphrase' | 'entity' | 'google-setup'>('welcome');
  const [passphrase, setPassphraseInput] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [generatedPassphrase, setGeneratedPassphrase] = useState('');
  const [showImport, setShowImport] = useState(false);
  
  const setStorePassphrase = useStore((state) => state.setPassphrase);
  const addEntity = useStore((state) => state.addEntity);
  const saveToStorage = useStore((state) => state.saveToStorage);
  const setUseAiParsing = useStore((state) => state.setUseAiParsing);
  const setGeminiApiKey = useStore((state) => state.setGeminiApiKey);
  const [showGeminiSetup, setShowGeminiSetup] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');

  // Google Drive Sync local state
  const googleClientIdStore = useStore((state) => state.googleClientId);
  const [isConnecting, setIsConnecting] = useState(false);
  const [googleAccessToken, setGoogleAccessTokenLocal] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [driveBackupFile, setDriveBackupFile] = useState<{ id: string; name: string; modifiedTime: string } | null>(null);
  const [googlePassphrase, setGooglePassphrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Google Drive Store actions
  const setGoogleAccessToken = useStore((state) => state.setGoogleAccessToken);
  const setIsGoogleDriveSynced = useStore((state) => state.setIsGoogleDriveSynced);
  const setGoogleDriveFileId = useStore((state) => state.setGoogleDriveFileId);
  const loadFromStorage = useStore((state) => state.loadFromStorage);

  // Pre-load Google Identity Services script on mount
  useEffect(() => {
    loadGsiScript().catch((err) => console.error('Failed to pre-load GSI script:', err));
  }, []);

  const handleGoogleSignIn = async () => {
    setIsConnecting(true);
    setAuthError('');
    try {
      if (!googleClientIdStore) {
        throw new Error('Google Drive Integration is not configured. Please ensure VITE_GOOGLE_CLIENT_ID is set during deployment.');
      }
      await loadGsiScript();
      const auth = await getGoogleAccessToken(googleClientIdStore);
      setGoogleAccessTokenLocal(auth.token);
      
      // Save globally
      setGoogleAccessToken(auth.token, auth.expiresIn);
      
      // Search backup file
      setIsSearching(true);
      const backup = await searchBackupFile(auth.token);
      setDriveBackupFile(backup);
      setIsSearching(false);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Failed to authenticate with Google. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRestoreBackup = async () => {
    setIsRestoring(true);
    setAuthError('');
    try {
      if (!driveBackupFile) return;
      const encryptedContent = await downloadBackupFile(googleAccessToken, driveBackupFile.id);
      
      // Use temporary File object to parse using importData
      const file = new File([encryptedContent], 'wealthguard_backup.wglk', { type: 'application/octet-stream' });
      await importData(file, googlePassphrase);
      
      // Decrypted successfully and saved to storage! Load it:
      await loadFromStorage(googlePassphrase);
      
      // Save Google file ID & sync status
      setGoogleDriveFileId(driveBackupFile.id);
      setIsGoogleDriveSynced(true);
      
      alert('Backup successfully restored from Google Drive!');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setAuthError('Decryption failed. Please verify that your passphrase is correct.');
    } finally {
      setIsRestoring(false);
    }
  };

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
              
              <div className="flex gap-3 items-start">
                <Sparkles className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold">AI-Powered PDF Import (Optional)</h3>
                  <p className="text-sm text-muted-foreground">
                    Use Google Gemini AI to automatically extract data from RAMIS tax return PDFs with high accuracy.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Optional Gemini API Setup */}
            <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-sm">Enable AI-Powered PDF Import</h3>
              </div>
              {!showGeminiSetup ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Optionally enable AI to extract tax data from RAMIS PDFs with higher accuracy.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowGeminiSetup(true)}
                    className="w-full"
                  >
                    Setup Gemini AI (Optional)
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Enter your Google Gemini API key. Get one free at{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Google AI Studio
                    </a>
                  </p>
                  <Input
                    type="password"
                    placeholder="Enter Gemini API Key"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => {
                        if (geminiKey.trim()) {
                          setGeminiApiKey(geminiKey);
                          setUseAiParsing(true);
                          alert('Gemini AI enabled! You can now use AI-powered PDF import.');
                        }
                      }}
                      disabled={!geminiKey.trim()}
                      className="flex-1"
                    >
                      Enable AI
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setShowGeminiSetup(false);
                        setGeminiKey('');
                      }}
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button onClick={() => setStep('passphrase')} className="w-full" size="lg">
                Get Started - Create New Profile
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => setShowImport(true)} 
                  variant="outline" 
                  className="w-full text-sm py-5"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Local Backup
                </Button>
                <Button 
                  onClick={() => setStep('google-setup')} 
                  variant="outline" 
                  className="w-full text-sm py-5 border-blue-200 hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <Cloud className="mr-2 h-4 w-4 text-blue-600 animate-pulse" />
                  Google Drive
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-center text-gray-500">
              Already have a backup? Restore your data via a local file or from your Google Drive.
            </p>
          </CardContent>
        </Card>
        
        {/* Import Dialog */}
        {showImport && <ImportDialog onClose={() => setShowImport(false)} redirectToDashboard={true} />}
      </div>
    );
  }

  if (step === 'google-setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Cloud className="w-6 h-6" />
              <CardTitle className="text-xl">Sync with Google Drive</CardTitle>
            </div>
            <CardDescription>
              Keep your encrypted tax backup in your personal Google Drive for easy access and cross-device sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Privacy Alert */}
            <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-lg text-xs text-blue-900 space-y-2">
              <p>
                <strong>🔒 Zero-Knowledge Security:</strong> Your data is fully encrypted using your passphrase <em>before</em> upload. Google and WealthGuard LK cannot see or read your data.
              </p>
              <p>
                <strong>🛡️ Restricted Access:</strong> We request the secure <code>drive.file</code> scope. The app can ONLY view and edit files it created itself. It has zero access to other files in your drive.
              </p>
            </div>

            {/* Error Message */}
            {authError && (
              <p className="text-xs font-medium text-red-600 bg-red-50 p-2 rounded border border-red-100">
                ⚠️ {authError}
              </p>
            )}

            {/* Google Authentication States */}
            {!googleAccessToken ? (
              <Button 
                onClick={handleGoogleSignIn} 
                disabled={isConnecting || !googleClientIdStore} 
                className="w-full flex items-center justify-center gap-2"
                size="lg"
              >
                {isConnecting ? (
                  <span>Connecting...</span>
                ) : (
                  <>
                    <Cloud className="w-5 h-5" />
                    Sign In with Google
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4 pt-2 border-t">
                {isSearching ? (
                  <p className="text-sm text-center text-muted-foreground py-2">
                    🔍 Searching Google Drive for existing backup...
                  </p>
                ) : driveBackupFile ? (
                  <div className="space-y-3">
                    <div className="bg-green-50/80 border border-green-100 rounded-lg p-3 text-xs text-green-900">
                      <p className="font-semibold mb-1">✅ Backup Found in Google Drive!</p>
                      <p>File: {driveBackupFile.name}</p>
                      <p>Last Modified: {new Date(driveBackupFile.modifiedTime).toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="googlePassphrase">Enter Backup Passphrase</Label>
                      <Input
                        id="googlePassphrase"
                        type="password"
                        placeholder="Passphrase used for encryption"
                        value={googlePassphrase}
                        onChange={(e) => setGooglePassphrase(e.target.value)}
                      />
                    </div>
                    {authError && (
                      <p className="text-xs font-medium text-red-600 bg-red-50 p-2 rounded border border-red-100">
                        ⚠️ {authError}
                      </p>
                    )}
                    <Button 
                      onClick={handleRestoreBackup} 
                      disabled={isRestoring || !googlePassphrase} 
                      className="w-full"
                    >
                      {isRestoring ? 'Restoring...' : 'Decrypt & Restore Backup'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-900">
                      <p className="font-semibold mb-1">ℹ️ No Backup Found</p>
                      <p>No existing WealthGuard backup file was found in your Google Drive. You can start with a new profile and it will auto-sync to your Drive.</p>
                    </div>
                    <Button 
                      onClick={() => {
                        // Enable sync in store and proceed to create passphrase
                        setIsGoogleDriveSynced(true);
                        setStep('passphrase');
                      }}
                      className="w-full font-semibold"
                    >
                      Create New Profile & Auto-Sync
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button 
              variant="ghost" 
              onClick={() => {
                setStep('welcome');
                setAuthError('');
              }} 
              className="w-full text-sm"
              disabled={isRestoring}
            >
              Cancel & Go Back
            </Button>
          </CardContent>
        </Card>
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
