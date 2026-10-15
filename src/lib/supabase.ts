// ============================================================================
// SUPABASE CLIENT & OFFLINE QUEUE SYNC BRIDGE
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-mandi.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Offline Sync Queue using localStorage
export interface SyncQueueItem {
  id: string;
  timestamp: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: any;
}

const SYNC_QUEUE_KEY = 'tsk_mandi_sync_queue';

export function getSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>) {
  const queue = getSyncQueue();
  queue.push({
    ...item,
    id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function clearSyncQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function flushSyncQueue(): Promise<{ success: boolean; syncedCount: number }> {
  if (!isSupabaseConfigured || !navigator.onLine) {
    return { success: false, syncedCount: 0 };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) return { success: true, syncedCount: 0 };

  let syncedCount = 0;
  const remainingQueue: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.action === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.payload);
        if (error) throw error;
      } else if (item.action === 'update') {
        const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.payload.id);
        if (error) throw error;
      } else if (item.action === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id);
        if (error) throw error;
      }
      syncedCount++;
    } catch (err) {
      console.warn(`Failed to sync queue item ${item.id}:`, err);
      remainingQueue.push(item);
    }
  }

  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
  return { success: remainingQueue.length === 0, syncedCount };
}
