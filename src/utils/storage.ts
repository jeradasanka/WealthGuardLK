/**
 * Storage utilities using encrypted cookies
 * Implements encrypted storage as per SRS Section 2.1
 */

import { encrypt, decrypt } from './crypto';
import type { AppState } from '@/types';

const STORAGE_KEY = 'wealthguard_lk_data';
const PASSPHRASE_KEY = 'wealthguard_lk_passphrase_hash';
const PASSPHRASE_STORE_KEY = 'wealthguard_lk_passphrase';

// Cookie expiration: 10 years
const COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60;

/**
 * Store passphrase in localStorage for convenience
 */
export function storePassphrase(passphrase: string): void {
  localStorage.setItem(PASSPHRASE_STORE_KEY, passphrase);
}

/**
 * Retrieve stored passphrase from localStorage
 */
export function getStoredPassphrase(): string | null {
  return localStorage.getItem(PASSPHRASE_STORE_KEY);
}

/**
 * Clear stored passphrase
 */
export function clearStoredPassphrase(): void {
  localStorage.removeItem(PASSPHRASE_STORE_KEY);
}

/**
 * Set a cookie value
 */
function setCookie(name: string, value: string): void {
  // Only use Secure flag in production (HTTPS). In development (HTTP), omit it.
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Strict${secureFlag}`;
}

/**
 * Get a cookie value
 */
function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  return null;
}

/**
 * Delete a cookie
 */
function deleteCookie(name: string): void {
  document.cookie = `${name}=; max-age=0; path=/`;
}


/**
 * Saves application state to cookies with encryption
 */
export async function saveState(
  state: AppState,
  passphrase: string
): Promise<void> {
  try {
    console.log('saveState() called with:', {
      entities: state.entities?.length || 0,
      assets: state.assets?.length || 0,
      liabilities: state.liabilities?.length || 0,
      incomes: state.incomes?.length || 0
    });
    
    const jsonData = JSON.stringify(state);
    console.log('JSON data length:', jsonData.length, 'chars');
    console.log('JSON preview:', jsonData.substring(0, 500));
    
    const encryptedData = await encrypt(jsonData, passphrase);
    console.log('Encrypted data length:', encryptedData.length, 'chars');
    
    setCookie(STORAGE_KEY, encryptedData);
    
    // Verify it was saved
    const savedCookie = getCookie(STORAGE_KEY);
    console.log('Verified cookie saved:', savedCookie ? `${savedCookie.length} chars` : 'NULL');
    
    // Store a hash of the passphrase for validation (not the passphrase itself)
    const passphraseHash = await hashPassphrase(passphrase);
    setCookie(PASSPHRASE_KEY, passphraseHash);
    
    // Store passphrase in localStorage for auto-login
    storePassphrase(passphrase);
    
    console.log('State saved successfully to cookies');
  } catch (error) {
    console.error('Failed to save state:', error);
    throw new Error('Failed to save data. Please try again.');
  }
}

/**
 * Loads application state from cookies and decrypts it
 */
export async function loadState(passphrase: string): Promise<AppState | null> {
  try {
    const encryptedData = getCookie(STORAGE_KEY);
    
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
    
    console.log('State loaded successfully from cookies');
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
  const data = getCookie(STORAGE_KEY);
  return data !== null;
}


/**
 * Exports encrypted data as a downloadable file
 */
export async function exportData(passphrase: string): Promise<Blob> {
  console.log('=== EXPORT DATA DEBUG ===');
  const encryptedData = getCookie(STORAGE_KEY);
  
  if (!encryptedData) {
    console.error('No cookie data found!');
    throw new Error('No data to export');
  }
  
  console.log('Cookie data length:', encryptedData.length, 'chars');
  
  // Decrypt to verify contents
  try {
    const jsonData = await decrypt(encryptedData, passphrase);
    const state = JSON.parse(jsonData) as AppState;
    console.log('Decrypted state from cookie:', {
      entities: state.entities?.length || 0,
      assets: state.assets?.length || 0,
      liabilities: state.liabilities?.length || 0,
      incomes: state.incomes?.length || 0
    });
  } catch (err) {
    console.error('Failed to decrypt for verification:', err);
  }
  
  const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
  console.log('Blob size:', blob.size, 'bytes');
  console.log('=== EXPORT COMPLETE ===');
  
  return blob;
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
  setCookie(STORAGE_KEY, encryptedData);
  const passphraseHash = await hashPassphrase(passphrase);
  setCookie(PASSPHRASE_KEY, passphraseHash);
  
  return state;
}

/**
 * Clears all stored data (use with caution)
 */
export async function clearAllData(): Promise<void> {
  deleteCookie(STORAGE_KEY);
  deleteCookie(PASSPHRASE_KEY);
  clearStoredPassphrase();
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
  const storedHash = getCookie(PASSPHRASE_KEY);
  
  if (!storedHash) {
    return true; // No passphrase set yet
  }
  
  const inputHash = await hashPassphrase(passphrase);
  return inputHash === storedHash;
}
