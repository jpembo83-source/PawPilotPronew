import React, { useEffect, useState } from 'react';
import { Settings, Plus, Filter, Shield, History, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { useAuth } from '../../context/AuthContext';
import { useOperationalRulesStore } from './store';
import { fetchRules, fetchTemplates } from './api';
import { toast } from 'sonner';
import { RuleBuilderModal } from './components/RuleBuilderModal';
import { RuleDetailsModal } from './components/RuleDetailsModal';
import { AuditLogModal } from './components/AuditLogModal';
import type { OperationalRule, RuleModule, RuleCategory, RuleScope, RuleStatus } from './types';

export function OperationalRulesPage() {
  const { user, hasPermission } = useAuth();
  const {
    rules,
    filters,
    templates,
    isLoading,
    isBuilderOpen,
    selectedRule,
    showAuditLog,
    setRules,
    setFilters,
    clearFilters,
    setTemplates,
    setLoading,
    openBuilder,
    closeBuilder,
    selectRule,
    setShowAuditLog
  } = useOperationalRulesStore();

  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Check permissions
  const canManageRules = hasPermission('operational_rules', 'create');
  const canViewRules = hasPermission('operational_rules', 'read');

  useEffect(() => {
    if (canViewRules) {
      loadRules();
      loadTemplates();
    }
  }, [filters, canViewRules]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await fetchRules(filters);
      setRules(data.rules);
    } catch (error: any) {
      console.error('Failed to load rules:', error);
      toast.error('Failed to load operational rules');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await fetchTemplates();
      setTemplates(data.templates);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
    }
  };

  const getModuleColor = (module: RuleModule) => {
    const colors: Record<RuleModule, string> = {
      daycare: 'bg-blue-100 text-blue-700 border-blue-200',
      grooming: 'bg-purple-100 text-purple-700 border-purple-200',
      transport: 'bg-orange-100 text-orange-700 border-orange-200',
      boutique: 'bg-pink-100 text-pink-700 border-pink-200',
      incidents: 'bg-red-100 text-red-700 border-red-200',
      communications: 'bg-green-100 text-green-700 border-green-200',
      billing: 'bg-amber-100 text-amber-700 border-amber-200'
    };
    return colors[module] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getStatusIcon = (status: RuleStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'disabled':
        return <XCircle className="h-4 w-4 text-slate-400" />;
      case 'draft':
        return <Clock className="h-4 w-4 text-amber-600" />;
    }
  };

  if (!canViewRules) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Access</h3>
              <p className="text-slate-600">
                You don't have permission to view operational rules.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-slate-600" />
            <div>
              <h1 className="text-2xl font-bold">Operational Rules</h1>
              <p className="text-sm text-slate-600">
                Configure operational policies and guardrails
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuditLog(true)}
            >
              <History className="h-4 w-4 mr-2" />
              Audit Log
            </Button>

            {canManageRules && (
              <Button onClick={() => openBuilder()}>
                <Plus className="h-4 w-4 mr-2" />
                New Rule
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {Object.keys(filters).length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.keys(filters).length}
                  </Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-4 gap-4 p-4 border rounded-lg bg-slate-50">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Module</label>
                  <Select
                    value={filters.module || 'ALL'}
                    onValueChange={(v) => setFilters({ module: v === 'ALL' ? undefined : v as RuleModule })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All modules</SelectItem>
                      <SelectItem value="daycare">Daycare</SelectItem>
                      <SelectItem value="grooming">Grooming</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="boutique">Boutique</SelectItem>
                      <SelectItem value="incidents">Incidents</SelectItem>
                      <SelectItem value="communications">Communications</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Scope</label>
                  <Select
                    value={filters.scope || 'ALL'}
                    onValueChange={(v) => setFilters({ scope: v === 'ALL' ? undefined : v as RuleScope })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All scopes</SelectItem>
                      <SelectItem value="organisation">Organisation</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={filters.status || 'ALL'}
                    onValueChange={(v) => setFilters({ status: v === 'ALL' ? undefined : v as RuleStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rules list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Rules ({rules.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-slate-600">
              Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-4">No rules found</p>
              {canManageRules && (
                <Button size="sm" onClick={() => openBuilder()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first rule
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => selectRule(rule)}
                  className="w-full text-left p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(rule.status)}
                      <div className="flex-1">
                        <h3 className="font-medium">{rule.name}</h3>
                        {rule.description && (
                          <p className="text-sm text-slate-600 mt-1">{rule.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={getModuleColor(rule.module)}>
                      {rule.module}
                    </Badge>

                    <Badge variant="outline" className="text-xs">
                      {rule.scope === 'organisation' ? 'Org-wide' : rule.scopeName}
                    </Badge>

                    <Badge variant="outline" className="text-xs">
                      {rule.type.replace('_', ' ')}
                    </Badge>

                    {rule.isOverride && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                        Override
                      </Badge>
                    )}

                    <Separator orientation="vertical" className="h-4" />

                    <span className="text-xs text-slate-500">
                      Modified {new Date(rule.updatedAt).toLocaleDateString('en-GB')} by {rule.updatedByName}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <RuleBuilderModal
        open={isBuilderOpen}
        onClose={closeBuilder}
        onSuccess={loadRules}
      />

      {selectedRule && (
        <RuleDetailsModal
          rule={selectedRule}
          onClose={() => selectRule(null)}
          onSuccess={loadRules}
        />
      )}

      <AuditLogModal
        open={showAuditLog}
        onClose={() => setShowAuditLog(false)}
      />
    </div>
  );
}
