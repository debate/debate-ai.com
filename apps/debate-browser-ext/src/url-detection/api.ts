import { getSettings } from '@/src/settings/settings';

export async function detectPageUrl(url: string, title?: string, favicon?: string): Promise<{ id?: number; visitCount?: number } | null> {
  try {
    const { apiBase } = await getSettings();
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/url-detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, favicon }),
    });

    if (!response.ok) {
      console.warn('URL detection failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('URL detection error:', error);
    return null;
  }
}