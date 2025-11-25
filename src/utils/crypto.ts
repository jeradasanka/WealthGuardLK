/**
 * Crypto utilities for AES-GCM encryption with PBKDF2 key derivation
 * Implements Zero-Knowledge architecture as per SRS Section 5
 */

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * Derives an encryption key from a passphrase using PBKDF2
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-GCM
 * Returns base64-encoded string: [salt][iv][ciphertext]
 */
export async function encrypt(
  data: string,
  passphrase: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Derive key
  const key = await deriveKey(passphrase, salt);
  
  // Encrypt
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(
    SALT_LENGTH + IV_LENGTH + encryptedData.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(encryptedData), SALT_LENGTH + IV_LENGTH);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts AES-GCM encrypted data
 * Input is base64-encoded string: [salt][iv][ciphertext]
 */
export async function decrypt(
  encryptedData: string,
  passphrase: string
): Promise<string> {
  const decoder = new TextDecoder();
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);
  
  // Derive key
  const key = await deriveKey(passphrase, salt);
  
  // Decrypt
  try {
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    return decoder.decode(decryptedData);
  } catch (error) {
    throw new Error('Decryption failed. Invalid passphrase or corrupted data.');
  }
}

/**
 * Generates a random passphrase (for initial setup)
 */
export function generatePassphrase(): string {
  const words = [
    'wealth', 'guard', 'secure', 'protect', 'tax', 'income',
    'asset', 'liability', 'audit', 'shield', 'privacy', 'zero'
  ];
  
  const randomWords = Array.from({ length: 4 }, () => 
    words[Math.floor(Math.random() * words.length)]
  );
  
  const randomNum = Math.floor(Math.random() * 9999);
  
  return `${randomWords.join('-')}-${randomNum}`;
}
