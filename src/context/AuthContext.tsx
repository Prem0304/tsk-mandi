// ============================================================================
// AUTH & ROLE CONTEXT (OWNER, ENTRY STAFF, VIEW ONLY) + 4-DIGIT PIN & AUTO-LOCK
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserRole } from '../types';
import { dbService } from '../lib/db';

export interface ActionAuthChallenge {
  actionName: string;
  actionDetails?: string;
  onConfirm: () => void;
}

interface AuthContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isLocked: boolean;
  lockApp: () => void;
  unlockWithPin: (pin: string) => boolean;
  switchToStaff: () => void;
  switchToOwner: (pin: string) => boolean;
  activeChallenge: ActionAuthChallenge | null;
  requestActionAuthorization: (challenge: ActionAuthChallenge) => void;
  cancelActionAuthorization: () => void;
  verifyAndExecuteAction: (enteredPassword: string) => boolean;
  canCreateSales: boolean;
  canSeeProfit: boolean;
  canRecordPurchases: boolean;
  canPaySuppliers: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canEditOrDelete: boolean;
  canRecordCratesAndPayments: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('tsk_mandi_user_role') as UserRole) || 'owner';
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    // Start locked so application is password protected on entry
    return true;
  });

  const [activeChallenge, setActiveChallenge] = useState<ActionAuthChallenge | null>(null);

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
    const ownerPin = settings.ownerPin || settings.appPin || '1234';
    const staffPin = settings.staffPin || '5678';

    if (enteredPin.trim() === ownerPin.trim()) {
      setRole('owner');
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      return true;
    }

    if (enteredPin.trim() === staffPin.trim()) {
      setRole('staff');
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      return true;
    }

    return false;
  };

  const switchToStaff = () => {
    setRole('staff');
  };

  const switchToOwner = (enteredPin: string): boolean => {
    const settings = dbService.getState().settings;
    const ownerPin = settings.ownerPin || settings.appPin || '1234';
    if (enteredPin.trim() === ownerPin.trim()) {
      setRole('owner');
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

  const requestActionAuthorization = (challenge: ActionAuthChallenge) => {
    const settings = dbService.getState().settings;
    if (settings.requirePasswordOnChange === false) {
      challenge.onConfirm();
      return;
    }
    setActiveChallenge(challenge);
  };

  const cancelActionAuthorization = () => {
    setActiveChallenge(null);
  };

  const verifyAndExecuteAction = (enteredPassword: string): boolean => {
    const settings = dbService.getState().settings;
    const targetPassword = settings.modificationPassword || '9999';
    if (enteredPassword.trim() === targetPassword.trim()) {
      if (activeChallenge) {
        const actionToRun = activeChallenge.onConfirm;
        setActiveChallenge(null);
        setTimeout(() => actionToRun(), 50);
      }
      return true;
    }
    return false;
  };

  // Role capability flags (Owner vs Staff)
  const isOwner = role === 'owner';
  const canSeeProfit = isOwner;
  const canCreateSales = true; // Both Owner and Staff can create sales & quick sales!
  const canRecordPurchases = isOwner; // Only owner buys stock from farmers/suppliers
  const canPaySuppliers = isOwner; // Only owner pays suppliers
  const canManageSettings = isOwner; // Only owner manages settings and passwords
  const canViewReports = isOwner; // Only owner views P&L / audit reports
  const canEditOrDelete = isOwner; // Only owner can edit/delete transactions
  const canRecordCratesAndPayments = true; // Both can record crate returns and customer payments

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole,
        isLocked,
        lockApp,
        unlockWithPin,
        switchToStaff,
        switchToOwner,
        activeChallenge,
        requestActionAuthorization,
        cancelActionAuthorization,
        verifyAndExecuteAction,
        canCreateSales,
        canSeeProfit,
        canRecordPurchases,
        canPaySuppliers,
        canManageSettings,
        canViewReports,
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
