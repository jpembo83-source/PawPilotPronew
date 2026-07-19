import React, { useState } from 'react';
import { useUserStore, PermissionTemplate } from '../../stores/userStore';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Plus, Shield, Trash, PencilSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { TemplateDialog } from './TemplateDialog';

export function TemplateManager() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useUserStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PermissionTemplate | null>(null);

  const handleCreate = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (tpl: PermissionTemplate) => {
    setEditingTemplate(tpl);
    setIsDialogOpen(true);
  };

  // Templates persist server-side; surface failures instead of pretending.
  const handleSave = async (tplData: Partial<PermissionTemplate>) => {
    const saved = editingTemplate
      ? await updateTemplate(editingTemplate.id, tplData)
      : await addTemplate(tplData as Omit<PermissionTemplate, 'id'>);
    if (saved) {
      toast.success(`Template "${saved.name}" saved`);
    } else {
      toast.error(useUserStore.getState().error ?? 'Failed to save template');
    }
  };

  const handleDelete = async (tpl: PermissionTemplate) => {
    const ok = await deleteTemplate(tpl.id);
    if (ok) {
      toast.success(`Template "${tpl.name}" deleted`);
    } else {
      toast.error(useUserStore.getState().error ?? 'Failed to delete template');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h3 className="text-lg font-medium text-slate-900">Permission Templates</h3>
           <p className="text-sm text-slate-500">Define what staff can see and do.</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(tpl => (
          <div key={tpl.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-500" />
                <h4 className="font-semibold text-slate-900">{tpl.name}</h4>
                {tpl.isSystem && <Badge variant="secondary" className="text-[10px]">System</Badge>}
              </div>
              <div className="flex gap-1">
                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(tpl)}>
                    <PencilSimple className="h-4 w-4 text-slate-500" />
                 </Button>
                 {!tpl.isSystem && (
                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => void handleDelete(tpl)}>
                     <Trash className="h-4 w-4" />
                   </Button>
                 )}
              </div>
            </div>
            
            <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2">
              {tpl.description}
            </p>

            <div className="border-t border-slate-100 pt-3">
               <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Permissions</span>
               <div className="flex flex-wrap gap-2">
                 {tpl.permissions.slice(0, 4).map((p, idx) => (
                   <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-50 text-slate-600 border border-slate-100">
                     {p.module} : {p.action}
                   </span>
                 ))}
                 {tpl.permissions.length > 4 && (
                   <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-50 text-slate-400 border border-slate-100">
                     +{tpl.permissions.length - 4} more
                   </span>
                 )}
               </div>
            </div>
          </div>
        ))}
      </div>

      <TemplateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        template={editingTemplate}
        onSave={(tplData) => void handleSave(tplData)}
      />
    </div>
  );
}
