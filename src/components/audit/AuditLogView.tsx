// ============================================================================
// AUDIT LOG & RECOVERY MODULE (SECTION 17)
// Immutable Audit Trail, Old vs New Values, Soft Delete Recovery
// ============================================================================

import React, { useState } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatDate } from '../../lib/utils';
import { History, Shield, RotateCcw, AlertTriangle, Search } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const { t } = useI18n();
  const { state } = useApp();
  const [query, setQuery] = useState('');

  const filteredLogs = state.auditLogs.filter(log => {
    const q = query.toLowerCase();
    return (
      log.description.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <History className="w-6 h-6 text-slate-700" />
            <span>{t('nav.audit')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Immutable system audit trail • Recalculates balances on every edit or soft-delete
          </p>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search audit events..."
            className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold"
          />
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No audit records matching query.
            </div>
          ) : (
            filteredLogs.map(log => {
              const isDelete = log.action === 'delete' || log.action === 'soft_delete';
              const isCreate = log.action === 'create';
              return (
                <div key={log.id} className="p-3.5 sm:p-4 hover:bg-slate-50 transition-colors space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isDelete
                          ? 'bg-rose-100 text-rose-800'
                          : isCreate
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-800">{log.entityType}</span>
                      <span className="text-slate-400 font-mono text-[11px]">#{log.entityId.slice(0, 8)}</span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-slate-700 font-medium pl-1">
                    {log.description}
                  </p>

                  {/* Old vs New values snippet if present */}
                  {log.oldValues && (
                    <div className="mt-2 text-[10px] bg-slate-100 p-2 rounded-xl text-slate-600 font-mono overflow-x-auto">
                      <strong>Previous Values:</strong> {JSON.stringify(log.oldValues)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
