/**
 * Google Drive API v3 and Google Identity Services (GIS) Utilities
 * Handles OAuth authentication and file backup/restore using fetch
 */

declare global {
  interface Window {
    google: any;
  }
}

/**
 * Dynamically loads the Google Identity Services script if not already loaded
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.accounts?.oauth2) return resolve();

    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      const handleLoad = () => resolve();
      existingScript.addEventListener('load', handleLoad);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

/**
 * Prompts user for Google login and requests authorization for drive.file scope
 */
export function getGoogleAccessToken(clientId: string): Promise<{ token: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    try {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services not loaded yet. Please wait.'));
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(tokenResponse);
          } else if (tokenResponse.access_token) {
            resolve({
              token: tokenResponse.access_token,
              expiresIn: Number(tokenResponse.expires_in),
            });
          } else {
            reject(new Error('Authentication failed: No access token returned.'));
          }
        },
      });

      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Searches the user's Google Drive for the encrypted backup file (wealthguard_backup.wglk)
 * Uses the drive.file scope so it can only find files created by this application.
 */
export async function searchBackupFile(accessToken: string): Promise<{ id: string; name: string; modifiedTime: string } | null> {
  const query = encodeURIComponent("name = 'wealthguard_backup.wglk' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to search backup: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      // Return the most recently modified backup file if multiple exist
      const sorted = data.files.sort((a: any, b: any) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
      return sorted[0];
    }
    return null;
  } catch (error) {
    console.error('Google Drive search failed:', error);
    throw error;
  }
}

/**
 * Downloads the encrypted backup file content from Google Drive
 */
export async function downloadBackupFile(accessToken: string, fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download backup: ${response.status} ${response.statusText}`);
    }

    const encryptedData = await response.text();
    return encryptedData;
  } catch (error) {
    console.error('Google Drive download failed:', error);
    throw error;
  }
}

/**
 * Uploads an encrypted backup string to Google Drive
 * If fileId is provided, updates the existing file. Otherwise, creates a new one.
 */
export async function uploadBackupFile(
  accessToken: string,
  encryptedContent: string,
  fileId?: string
): Promise<{ id: string }> {
  try {
    if (fileId) {
      // Update existing file using PATCH
      const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: encryptedContent,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update backup file: ${response.status} ${errorText}`);
      }

      return await response.json();
    } else {
      // Create new file using Multipart upload (metadata + media content)
      const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const boundary = 'wealthguard_boundary_marker';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: 'wealthguard_backup.wglk',
        mimeType: 'application/octet-stream',
        description: 'WealthGuard LK Encrypted Backup Data',
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/octet-stream\r\n\r\n' +
        encryptedContent +
        closeDelimiter;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create backup file: ${response.status} ${errorText}`);
      }

      return await response.json();
    }
  } catch (error) {
    console.error('Google Drive upload failed:', error);
    throw error;
  }
}
