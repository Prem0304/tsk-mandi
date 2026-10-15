// ============================================================================
// AUTH & ROLE CONTEXT (OWNER, ENTRY STAFF, VIEW ONLY) + 4-DIGIT PIN & AUTO-LOCK
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserRole } from '../types';
import { dbService } from '../lib/db';

interface AuthContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLocked: boolean;
  lockApp: () => void;
  unlockWithPin: (pin: string) => boolean;
  canCreateSales: boolean;
  canSeeProfit: boolean;
  canEditOrDelete: boolean;
  canRecordCratesAndPayments: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('tsk_mandi_user_role') as UserRole) || 'owner';
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    // If appPin is set, default to unlocked unless locked explicitly or on mobile startup
    return false;
  });

  const lastActivityRef = useRef<number>(Date.now());

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('tsk_mandi_user_role', newRole);
  };

  const lockApp = () => {
    setIsLocked(true);
  };

  const unlockWithPin = (enteredPin: string): boolean => {
    const settings = dbService.getState().settings;
    const targetPin = settings.appPin || '1234';
    if (enteredPin === targetPin) {
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      return true;
    }
    return false;
  };

  // Inactivity auto-lock timer
  useEffect(() => {
    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    const checkInterval = setInterval(() => {
      const settings = dbService.getState().settings;
      const autoLockMinutes = settings.autoLockMinutes || 10;
      if (autoLockMinutes > 0 && !isLocked) {
        const elapsedMinutes = (Date.now() - lastActivityRef.current) / (1000 * 60);
        if (elapsedMinutes >= autoLockMinutes) {
          setIsLocked(true);
        }
      }
    }, 30000); // Check every 30s

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      clearInterval(checkInterval);
    };
  }, [isLocked]);

  // Role capability flags
  const canCreateSales = role === 'owner';
  const canSeeProfit = role === 'owner';
  const canEditOrDelete = role === 'owner';
  const canRecordCratesAndPayments = role === 'owner' || role === 'entry_staff';

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole,
        isLocked,
        lockApp,
        unlockWithPin,
        canCreateSales,
        canSeeProfit,
        canEditOrDelete,
        canRecordCratesAndPayments
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
