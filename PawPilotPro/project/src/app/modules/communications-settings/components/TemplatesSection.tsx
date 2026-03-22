// Templates Section - Communications Settings

import React, { useState } from 'react';
import { useCommunicationsSettingsStore } from '../store';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Plus, Search, Edit2, Trash2, Mail, Phone, MessageSquare, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { TemplateBuilderDialog } from './modals/TemplateBuilderDialog';
import type { CommunicationTemplate } from '../types';

const channelIcons = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-amber-100 text-amber-700',
};

export function TemplatesSection() {
  const { templates, deleteTemplate, templateFilters, setTemplateFilters } = useCommunicationsSettingsStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);

  const handleEdit = (template: CommunicationTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await deleteTemplate(id);
      toast.success('Template deleted');
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    if (templateFilters.module && template.module !== templateFilters.module) return false;
    if (templateFilters.eventType && template.eventType !== templateFilters.eventType) return false;
    if (templateFilters.status && template.status !== templateFilters.status) return false;
    if (templateFilters.search) {
      const search = templateFilters.search.toLowerCase();
      return template.name.toLowerCase().includes(search) || 
             template.description.toLowerCase().includes(search);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Message Templates</h3>
          <p className="text-sm text-slate-600 mt-1">
            Create reusable, approved message templates for staff to use
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search templates..."
                value={templateFilters.search || ''}
                onChange={(e) => setTemplateFilters({ search: e.target.value })}
                className="pl-9"
              />
            </div>
            <Select
              value={templateFilters.module || 'all'}
              onValueChange={(value) => setTemplateFilters({ module: value === 'all' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                <SelectItem value="daycare">Daycare</SelectItem>
                <SelectItem value="grooming">Grooming</SelectItem>
                <SelectItem value="overnights">Overnights</SelectItem>
                <SelectItem value="transport">Transport</SelectItem>
                <SelectItem value="boutique">Boutique</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={templateFilters.eventType || 'all'}
              onValueChange={(value) => setTemplateFilters({ eventType: value === 'all' ? undefined : value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="automated">Automated</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={templateFilters.status || 'all'}
              onValueChange={(value) => setTemplateFilters({ status: value === 'all' ? undefined : value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      {filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No templates found</p>
            <p className="text-xs mt-1">Create your first template to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-slate-900">{template.name}</h4>
                      <Badge className={statusColors[template.status]}>{template.status}</Badge>
                      <Badge variant="outline" className="capitalize">{template.module}</Badge>
                      <Badge variant="outline" className="text-xs">{template.eventType}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                    
                    {/* Channels */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-slate-500">Channels:</span>
                      <div className="flex gap-2">
                        {template.channels.map((channel) => {
                          const Icon = channelIcons[channel as keyof typeof channelIcons];
                          return (
                            <div key={channel} className="flex items-center gap-1 text-xs text-slate-600">
                              <Icon className="h-3.5 w-3.5" />
                              <span className="capitalize">{channel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Variables */}
                    {template.variables.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-slate-500">Variables:</span>
                        <div className="flex flex-wrap gap-1">
                          {template.variables.slice(0, 5).map((variable) => (
                            <Badge key={variable} variant="secondary" className="text-xs">
                              {'{' + variable + '}'}
                            </Badge>
                          ))}
                          {template.variables.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.variables.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Usage Stats */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Used {template.usageCount} times</span>
                      {template.lastUsedAt && (
                        <span>Last used: {new Date(template.lastUsedAt).toLocaleDateString()}</span>
                      )}
                      <span>by {template.createdByName}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <TemplateBuilderDialog 
        open={dialogOpen}
        onClose={handleClose}
        template={editingTemplate}
      />
    </div>
  );
}
