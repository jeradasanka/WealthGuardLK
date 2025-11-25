/**
 * Import Dialog
 * Handles importing encrypted backup files
 */

import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useStore } from '@/stores/useStore';
import { importData } from '@/utils/storage';
import { storePassphrase } from '@/utils/storage';

interface ImportDialogProps {
  onClose: () => void;
}

export function ImportDialog({ onClose }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const setStorePassphrase = useStore((state) => state.setPassphrase);
  const loadFromStorage = useStore((state) => state.loadFromStorage);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setSuccess(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a backup file');
      return;
    }

    if (!passphrase || passphrase.length < 12) {
      setError('Please enter a valid passphrase (minimum 12 characters)');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Import the data
      const importedState = await importData(file, passphrase);
      
      // Update the store with imported data
      setStorePassphrase(passphrase);
      storePassphrase(passphrase);
      
      // Reload from storage to update the UI
      await loadFromStorage(passphrase);
      
      setSuccess(true);
      setError('');
      
      // Close dialog after 2 seconds
      setTimeout(() => {
        onClose();
        window.location.reload(); // Reload to ensure all UI updates
      }, 2000);
    } catch (err) {
      console.error('Import failed:', err);
      setError('Failed to import backup. Please check your passphrase and file.');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Backup
              </CardTitle>
              <CardDescription>
                Restore your data from an encrypted backup file
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="backup-file">Backup File</Label>
            <div className="flex gap-2">
              <Input
                id="backup-file"
                type="file"
                accept=".wglk"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={loading || success}
              />
            </div>
            {file && (
              <p className="text-sm text-gray-600">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Passphrase Input */}
          <div className="space-y-2">
            <Label htmlFor="import-passphrase">Passphrase</Label>
            <Input
              id="import-passphrase"
              type="password"
              placeholder="Enter the passphrase used to create the backup"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={loading || success}
            />
            <p className="text-xs text-gray-500">
              This must be the same passphrase used when the backup was created
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded p-3 flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                Backup imported successfully! Reloading application...
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">⚠️ Warning</p>
                <p>
                  Importing a backup will <strong>replace all your current data</strong>. 
                  Make sure to export your current data first if you want to keep it.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleImport}
              disabled={loading || success || !file || !passphrase}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Backup
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading || success}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
