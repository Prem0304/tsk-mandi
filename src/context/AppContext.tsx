// ============================================================================
// MAIN APPLICATION CONTEXT (REACTIVE ENTITY STATE, SYNC STATUS & SUMMARIES)
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { dbService, MandiDatabaseState } from '../lib/db';
import {
  LiveStockSummary,
  ShopCrateSummary,
  CustomerFinancialSummary,
  SupplierCollectionSummary,
  ProfitMetrics
} from '../types';
import {
  isSupabaseConfigured,
  fetchStateFromCloud,
  pushStateToCloud,
  subscribeToCloudChanges
} from '../lib/supabase';

export type SyncState = 'offline' | 'syncing' | 'synced';

interface AppContextType {
  state: MandiDatabaseState;
  syncState: SyncState;
  triggerManualSync: () => Promise<void>;
  stockSummaries: LiveStockSummary[];
  shopCrateSummaries: ShopCrateSummary[];
  customerSummaries: CustomerFinancialSummary[];
  supplierSummaries: SupplierCollectionSummary[];
  profitMetrics: ProfitMetrics;
  refreshState: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbState, setDbState] = useState<MandiDatabaseState>(() => dbService.getState());
  const [syncState, setSyncState] = useState<SyncState>(() => {
    return !navigator.onLine ? 'offline' : 'synced';
  });

  const refreshState = () => {
    setDbState({ ...dbService.getState() });
  };

  // Subscribe to DB changes
  useEffect(() => {
    const unsubscribe = dbService.subscribe(() => {
      refreshState();
    });
    return unsubscribe;
  }, []);

  // Monitor online/offline status and auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      setSyncState('syncing');
      if (isSupabaseConfigured()) {
        try {
          await pushStateToCloud(dbService.getState());
        } catch {}
      }
      setTimeout(() => setSyncState('synced'), 800);
    };

    const handleOffline = () => {
      setSyncState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Supabase Real-Time Cloud Sync (Mobile & Laptop 2-Way Sync)
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    let unsubscribeRealtime: (() => void) | null = null;

    const initCloud = async () => {
      try {
        setSyncState('syncing');
        // Initial state sync on load
        const cloudData = await fetchStateFromCloud();
        if (cloudData && cloudData.state) {
          dbService.applyRemoteState(cloudData.state);
        } else {
          // Cloud empty; seed with local state
          await pushStateToCloud(dbService.getState());
        }
        setSyncState('synced');

        // Subscribe to live changes broadcast by another device (Mobile or Laptop)
        unsubscribeRealtime = subscribeToCloudChanges((remoteState) => {
          setSyncState('syncing');
          dbService.applyRemoteState(remoteState);
          setSyncState('synced');
        });
      } catch (err) {
        console.warn('[AppContext] Cloud sync init error:', err);
        setSyncState('synced');
      }
    };

    initCloud();

    return () => {
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
      }
    };
  }, []);

  const triggerManualSync = async () => {
    if (!navigator.onLine) {
      setSyncState('offline');
      return;
    }
    setSyncState('syncing');
    if (isSupabaseConfigured()) {
      try {
        const cloudData = await fetchStateFromCloud();
        if (cloudData && cloudData.state) {
          dbService.applyRemoteState(cloudData.state);
        } else {
          await pushStateToCloud(dbService.getState());
        }
      } catch {}
    }
    setTimeout(() => setSyncState('synced'), 600);
  };

  // Derived reactive calculations
  const stockSummaries = useMemo(() => {
    return dbService.getLiveStockSummaries();
  }, [dbState]);

  const shopCrateSummaries = useMemo(() => {
    return dbService.getShopCrateSummaries();
  }, [dbState]);

  const customerSummaries = useMemo(() => {
    return dbState.customers
      .filter(c => !c.deletedAt)
      .map(c => dbService.getCustomerSummary(c.id))
      .filter(Boolean) as CustomerFinancialSummary[];
  }, [dbState]);

  const supplierSummaries = useMemo(() => {
    return dbState.suppliers
      .filter(s => !s.deletedAt)
      .map(s => dbService.getSupplierSummary(s.id))
      .filter(Boolean) as SupplierCollectionSummary[];
  }, [dbState]);

  const profitMetrics = useMemo(() => {
    return dbService.getProfitMetrics();
  }, [dbState]);

  return (
    <AppContext.Provider
      value={{
        state: dbState,
        syncState,
        triggerManualSync,
        stockSummaries,
        shopCrateSummaries,
        customerSummaries,
        supplierSummaries,
        profitMetrics,
        refreshState
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
