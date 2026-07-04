import React from 'react';
import { useSettingsStore } from '../store';
import { MODULES } from '../constants/modules';
import { Switch } from '../../../components/ui/switch';
import { Warning, Info, Stack } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

export function ModuleSettings() {
  const { globalEnabledModules, toggleGlobalModule, logAction, fetchGlobalModules } = useSettingsStore();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();

  React.useEffect(() => {
    // Only fetch when user is authenticated and not loading
    if (!isAuthLoading && user) {
      fetchGlobalModules();
    }
  }, [fetchGlobalModules, isAuthLoading, user]);

  const handleToggle = async (moduleId: string, currentState: boolean) => {
    const newState = !currentState;
    
    if (!newState) {
      const confirmed = await confirm({
        title: `Disable ${moduleId} globally?`,
        description: 'This will disable it for ALL locations immediately.',
        confirmLabel: 'Disable',
        destructive: true,
      });
      if (!confirmed) {
        return;
      }
    }

    await toggleGlobalModule(moduleId, newState);
    logAction('TOGGLE_MODULE', `${newState ? 'Enabled' : 'Disabled'} module: ${moduleId}`, 'Admin');
    toast.success(`Module ${newState ? 'enabled' : 'disabled'} successfully`);
  };

  const enabledModules = globalEnabledModules || []; // Handle undefined state

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Organisation Modules</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage the core service lines available to your platform. 
            Disabling a module here removes it from all locations.
          </p>
        </div>
        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
          <Stack className="h-5 w-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {MODULES.filter(m => !m.isCore).map((module) => {
          const isEnabled = enabledModules.includes(module.id);

          return (
            <div 
              key={module.id} 
              className={`border rounded-lg p-6 transition-all ${isEnabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className={`p-3 rounded-lg ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      {module.label}
                      {isEnabled ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                          Disabled
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">{module.description}</p>
                    
                    {!isEnabled && (
                      <div className="flex items-center gap-2 mt-3 text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-100 w-fit">
                        <Warning className="h-3.5 w-3.5" />
                        Platform features for this module are hidden globally.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 font-medium">
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch 
                    checked={isEnabled}
                    onCheckedChange={() => handleToggle(module.id, isEnabled)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
        <Info className="h-5 w-5 shrink-0 text-blue-600" />
        <div>
           <p className="font-semibold">Core Platform Modules</p>
           <p className="mt-1 opacity-90">
             Dashboard, Customers, Messages, Billing, and Incidents are core operational modules and cannot be disabled. 
             They form the backbone of the MDC Operations Platform.
           </p>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}