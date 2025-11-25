/**
 * Storage utilities for IndexedDB using idb-keyval
 * Implements encrypted storage as per SRS Section 2.1
 */

import { get, set, del, clear } from 'idb-keyval';
import { encrypt, decrypt } from './crypto';
import type { AppState } from '@/types';

const STORAGE_KEY = 'wealthguard_lk_data';
const PASSPHRASE_KEY = 'wealthguard_lk_passphrase_hash';

/**
 * Saves application state to IndexedDB with encryption
 */
export async function saveState(
  state: AppState,
  passphrase: string
): Promise<void> {
  try {
    const jsonData = JSON.stringify(state);
    const encryptedData = await encrypt(jsonData, passphrase);
    
    await set(STORAGE_KEY, encryptedData);
    
    // Store a hash of the passphrase for validation (not the passphrase itself)
    const passphraseHash = await hashPassphrase(passphrase);
    await set(PASSPHRASE_KEY, passphraseHash);
    
    console.log('State saved successfully');
  } catch (error) {
    console.error('Failed to save state:', error);
    throw new Error('Failed to save data. Please try again.');
  }
}

/**
 * Loads application state from IndexedDB and decrypts it
 */
export async function loadState(passphrase: string): Promise<AppState | null> {
  try {
    const encryptedData = await get<string>(STORAGE_KEY);
    
    if (!encryptedData) {
      return null; // No saved data
    }
    
    // Verify passphrase
    const isValid = await verifyPassphrase(passphrase);
    if (!isValid) {
      throw new Error('Invalid passphrase');
    }
    
    const jsonData = await decrypt(encryptedData, passphrase);
    const state = JSON.parse(jsonData) as AppState;
    
    console.log('State loaded successfully');
    return state;
  } catch (error) {
    console.error('Failed to load state:', error);
    throw error;
  }
}

/**
 * Checks if there is saved data
 */
export async function hasSavedData(): Promise<boolean> {
  const data = await get<string>(STORAGE_KEY);
  return data !== undefined;
}

/**
 * Exports encrypted data as a downloadable file
 */
export async function exportData(passphrase: string): Promise<Blob> {
  const encryptedData = await get<string>(STORAGE_KEY);
  
  if (!encryptedData) {
    throw new Error('No data to export');
  }
  
  return new Blob([encryptedData], { type: 'application/octet-stream' });
}

/**
 * Imports encrypted data from a file
 */
export async function importData(
  file: File,
  passphrase: string
): Promise<AppState> {
  const encryptedData = await file.text();
  const jsonData = await decrypt(encryptedData, passphrase);
  const state = JSON.parse(jsonData) as AppState;
  
  // Save the imported data
  await set(STORAGE_KEY, encryptedData);
  const passphraseHash = await hashPassphrase(passphrase);
  await set(PASSPHRASE_KEY, passphraseHash);
  
  return state;
}

/**
 * Clears all stored data (use with caution)
 */
export async function clearAllData(): Promise<void> {
  await clear();
  console.log('All data cleared');
}

/**
 * Hashes a passphrase for validation (not for encryption)
 */
async function hashPassphrase(passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passphrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies if a passphrase is correct
 */
async function verifyPassphrase(passphrase: string): Promise<boolean> {
  const storedHash = await get<string>(PASSPHRASE_KEY);
  
  if (!storedHash) {
    return true; // No passphrase set yet
  }
  
  const inputHash = await hashPassphrase(passphrase);
  return inputHash === storedHash;
}
