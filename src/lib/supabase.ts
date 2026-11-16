// ============================================================================
// SUPABASE REALTIME MULTI-DEVICE SYNC ENGINE
// Connects Mobile & Laptop in Real-Time for T.S.K Mandi
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'tsk_supabase_url';
const STORAGE_KEY_ANON = 'tsk_supabase_anon_key';
const SYNC_TABLE = 'mandi_sync_store';
const SYNC_ROW_ID = 'tsk_mandi_prod';

// Unique Device ID for this browser tab/session to avoid echoing own broadcasts
const DEVICE_ID = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export function getDeviceId(): string {
  return DEVICE_ID;
}

export function getStoredSupabaseCredentials(): { url: string; key: string } {
  let url = '';
  let key = '';

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      url = window.localStorage.getItem(STORAGE_KEY_URL) || '';
      key = window.localStorage.getItem(STORAGE_KEY_ANON) || '';
    }
  } catch {}

  // Fallback to Vite environment variables or process.env if not set in localStorage
  if (!url) {
    const envUrl = typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL
      : (typeof process !== 'undefined' ? process?.env?.VITE_SUPABASE_URL : '');
    url = (envUrl || '').trim();
  }
  if (!key) {
    const envKey = typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_ANON_KEY
      ? import.meta.env.VITE_SUPABASE_ANON_KEY
      : (typeof process !== 'undefined' ? process?.env?.VITE_SUPABASE_ANON_KEY : '');
    key = (envKey || '').trim();
  }

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getStoredSupabaseCredentials();
  return Boolean(
    url &&
    key &&
    url.startsWith('https://') &&
    !url.includes('placeholder') &&
    key.length > 20
  );
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseCredentials();
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }

  return supabaseInstance;
}

export function saveSupabaseCredentials(url: string, key: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_URL, url.trim());
      window.localStorage.setItem(STORAGE_KEY_ANON, key.trim());
    }
  } catch {}
  // Reset client to reinitialize with new credentials
  supabaseInstance = null;
  return getSupabaseClient();
}

export function clearSupabaseCredentials() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY_URL);
      window.localStorage.removeItem(STORAGE_KEY_ANON);
    }
  } catch {}
  supabaseInstance = null;
}

// Test connection to Supabase and check if sync table is ready
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string; tableReady: boolean }> {
  try {
    const creds = url && key ? { url: url.trim(), key: key.trim() } : getStoredSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return { success: false, message: 'URL and Anon Key are required', tableReady: false };
    }

    const testClient = createClient(creds.url, creds.key);
    
    // Test basic connectivity and table existence
    const { data, error } = await testClient
      .from(SYNC_TABLE)
      .select('id, version, updated_at')
      .eq('id', SYNC_ROW_ID)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return {
          success: true,
          tableReady: false,
          message: 'Connected to Supabase, but the "mandi_sync_store" table has not been created yet. Please run the SQL setup script.'
        };
      }
      return { success: false, message: error.message, tableReady: false };
    }

    return {
      success: true,
      tableReady: true,
      message: data ? 'Connected successfully! Live sync is active.' : 'Connected! Sync table is ready to receive initial data.'
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error connecting to Supabase', tableReady: false };
  }
}

// Fetch the complete mandi state from Supabase
export async function fetchStateFromCloud(): Promise<{ state: any; version: number } | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from(SYNC_TABLE)
      .select('state, version, updated_at, device_id')
      .eq('id', SYNC_ROW_ID)
      .maybeSingle();

    if (error) {
      console.warn('[CloudSync] Error fetching cloud state:', error.message);
      return null;
    }

    if (data && data.state) {
      return { state: data.state, version: Number(data.version) || 1 };
    }

    return null;
  } catch (err) {
    console.warn('[CloudSync] Network failure fetching cloud state:', err);
    return null;
  }
}

// Push local state to Supabase
export async function pushStateToCloud(state: any, version: number = Date.now()): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const payload = {
      id: SYNC_ROW_ID,
      state,
      version,
      device_id: DEVICE_ID,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from(SYNC_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[CloudSync] Push error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[CloudSync] Network error pushing state:', err);
    return false;
  }
}

// Debounced cloud push to prevent spamming while user is actively typing
let debounceTimer: any = null;
export function debouncedPushToCloud(state: any, delayMs: number = 400) {
  if (!isSupabaseConfigured()) return;
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    pushStateToCloud(state);
  }, delayMs);
}

// Real-Time Subscription: Listen for changes made by other devices
export function subscribeToCloudChanges(
  onRemoteUpdate: (remoteState: any, version: number) => void
): (() => void) | null {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('mandi-realtime-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SYNC_TABLE,
          filter: `id=eq.${SYNC_ROW_ID}`
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (!newRecord || !newRecord.state) return;

          // Ignore updates originating from this exact device/tab
          if (newRecord.device_id === DEVICE_ID) {
            return;
          }

          console.log('[CloudSync] ⚡ Live update received from another device! Applying...');
          onRemoteUpdate(newRecord.state, Number(newRecord.version) || Date.now());
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[CloudSync] ✅ Connected to Supabase Realtime channel.');
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[CloudSync] Subscription error:', err);
    return null;
  }
}

// SQL Script needed for Supabase setup
export const SUPABASE_SETUP_SQL = `-- ============================================================================
-- TSK MANDI - LIVE MULTI-DEVICE REALTIME SYNC SETUP (1-CLICK RUN IN SUPABASE)
-- Run this in Supabase Dashboard -> SQL Editor -> Click RUN
-- ============================================================================

-- 1. Create the live sync store table
CREATE TABLE IF NOT EXISTS public.mandi_sync_store (
    id TEXT PRIMARY KEY DEFAULT 'tsk_mandi_prod',
    state JSONB NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    device_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.mandi_sync_store ENABLE ROW LEVEL SECURITY;

-- 3. Allow anonymous public read and write access for your Mandi app
DROP POLICY IF EXISTS "Allow public read-write on mandi_sync_store" ON public.mandi_sync_store;
CREATE POLICY "Allow public read-write on mandi_sync_store"
ON public.mandi_sync_store
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. Enable Realtime broadcasting so Mobile & Laptop sync live
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'mandi_sync_store'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mandi_sync_store;
  END IF;
END $$;
`;

// Legacy exports for backwards compatibility
export const supabase = new Proxy({} as any, {
  get: (_target, prop) => {
    const client = getSupabaseClient();
    if (!client) return undefined;
    return (client as any)[prop];
  }
});
export function getSyncQueue() { return []; }
export function addToSyncQueue(_item: any) {}
export function clearSyncQueue() {}
export async function flushSyncQueue() {
  return { success: true, syncedCount: 0 };
}
