// Policies Management Page - Manager/Admin View
// Complete policy lifecycle management, assignments, and compliance tracking
// Uses the Staff module API for policy management with full audit trail

import React, { useEffect, useState } from 'react';
import { usePoliciesStore, PolicyDocument, PolicyAssignment } from '../store';
import { useStaffStore } from '../../staff/store';
import { useAuth } from '../../../context/AuthContext';
import { 
  FileText, Plus, UploadSimple, UsersThree, ChartBar, CheckCircle,
  Warning, CalendarBlank, DownloadSimple, Eye, Archive, MagnifyingGlass,
  Funnel, X, Gear, Clock, ArrowClockwise, Shield
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { supabase } from '../../../../utils/supabase/client';
import { UploadPolicyModal, AssignPolicyModal } from '../components/PolicyModals';

type TabType = 'policies' | 'assignments' | 'compliance' | 'audit';

export function PoliciesManagementPage() {
  const { user } = useAuth();
  
  // Use policies store for backward compatibility
  const {
    policies: oldPolicies,
    allAssignments,
    complianceStats,
    policyCompliance,
    auditLogs,
    isLoading: policiesLoading,
    error: policiesError,
    fetchPolicies: fetchOldPolicies,
    fetchAllAssignments,
    fetchComplianceStats,
    fetchPolicyCompliance,
    fetchAuditLogs,
    createPolicy: createOldPolicy,
    publishPolicy: publishOldPolicy,
    archivePolicy: archiveOldPolicy,
    createAssignments: createOldAssignments,
    exportAcknowledgements,
    exportAssignments,
    clearError,
  } = usePoliciesStore();
  
  // Use staff store for enhanced policy management
  const {
    policies: staffPolicies,
    isLoading: staffLoading,
    error: staffError,
    fetchPolicies: fetchStaffPolicies,
    createPolicy: createStaffPolicy,
    createPolicyVersion,
    publishPolicy: publishStaffPolicy,
    archivePolicy: archiveStaffPolicy,
    assignPolicy,
    fetchAssignments,
    assignments,
  } = useStaffStore();
  
  // Merge policies from both sources
  const policies = [...oldPolicies, ...staffPolicies];
  const isLoading = policiesLoading || staffLoading;
  const error = policiesError || staffError;

  const staffPolicyIds = new Set(staffPolicies.map((p: any) => p.id));

  const handlePublishPolicy = async (id: string) => {
    if (staffPolicyIds.has(id)) {
      return publishStaffPolicy(id);
    }
    return publishOldPolicy(id);
  };

  const handleArchivePolicy = async (id: string) => {
    if (staffPolicyIds.has(id)) {
      return archiveStaffPolicy(id);
    }
    return archiveOldPolicy(id);
  };
  
  const [activeTab, setActiveTab] = useState<TabType>('compliance');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDocument | null>(null);
  
  const isAdmin = user?.role === 'admin';
  const canManage = isAdmin || user?.role === 'manager';
  
  useEffect(() => {
    if (canManage) {
      console.log('🚀 Starting data fetches for policies management...');
      // Only fetch if user is authenticated
      if (!user?.id) {
        console.log('⚠️ User not authenticated, skipping data fetches');
        return;
      }
      
      // Fetch from both old policies store and new staff-based store
      fetchOldPolicies().catch(err => console.debug('Old policies API:', err.message));
      fetchStaffPolicies().catch(err => console.debug('Staff policies API:', err.message));
      
      // Fetch assignments from both sources
      fetchAllAssignments().catch(err => console.debug('Old assignments:', err.message));
      fetchAssignments().catch(err => console.debug('Staff assignments:', err.message));
      
      // Compliance features
      fetchComplianceStats().catch(err => console.debug('Compliance stats:', err.message));
      fetchPolicyCompliance().catch(err => console.debug('Policy compliance:', err.message));
      
      if (isAdmin) {
        fetchAuditLogs().catch(err => console.debug('Audit logs:', err.message));
      }
    }
  }, [canManage, user?.id]);
  
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);
  
  const handleExportAcknowledgements = async () => {
    try {
      const data = await exportAcknowledgements();
      
      // Convert to CSV
      const csvContent = [
        ['User Name', 'User Email', 'Policy Title', 'Policy ID', 'Acknowledged At', 'Viewed At'].join(','),
        ...data.map(ack => [
          ack.user_name,
          ack.user_email,
          '', // We'd need to fetch policy title
          ack.policy_id,
          new Date(ack.acknowledged_at).toLocaleString('en-GB'),
          ack.viewed_at ? new Date(ack.viewed_at).toLocaleString('en-GB') : 'Not viewed',
        ].join(','))
      ].join('\n');
      
      // DownloadSimple
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `policy-acknowledgements-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Acknowledgements exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export acknowledgements');
    }
  };
  
  const handleExportAssignments = async () => {
    try {
      const data = await exportAssignments();
      
      // Convert to CSV
      const csvContent = [
        ['Policy Title', 'Version', 'Assigned To', 'Email', 'Status', 'Due Date', 'Assigned By', 'Assigned At'].join(','),
        ...data.map(assignment => [
          assignment.policy_title,
          assignment.policy_version,
          assignment.assigned_to_name,
          assignment.assigned_to_email,
          assignment.status,
          new Date(assignment.due_date).toLocaleDateString('en-GB'),
          assignment.assigned_by_name,
          new Date(assignment.created_at).toLocaleString('en-GB'),
        ].join(','))
      ].join('\n');
      
      // DownloadSimple
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `policy-assignments-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Assignments exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export assignments');
    }
  };
  
  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Warning className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-slate-600">You don't have permission to access this page</p>
        </div>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Policies & Acknowledgements</h1>
            <p className="text-slate-600">
              Manage policies, assignments, and compliance tracking
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleExportAssignments}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <DownloadSimple className="w-4 h-4" />
              Export Assignments
            </button>
            <button
              onClick={handleExportAcknowledgements}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <DownloadSimple className="w-4 h-4" />
              Export Acknowledgements
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Upload Policy
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('compliance')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'compliance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <ChartBar className="w-4 h-4" />
                Compliance Dashboard
              </div>
            </button>
            <button
              onClick={() => setActiveTab('policies')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'policies'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Policies Library
              </div>
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'assignments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <UsersThree className="w-4 h-4" />
                Assignments
              </div>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activeTab === 'audit'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Audit Log
                </div>
              </button>
            )}
          </div>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'compliance' && (
          <ComplianceDashboardTab
            stats={complianceStats}
            policyCompliance={policyCompliance}
            isLoading={isLoading}
          />
        )}
        
        {activeTab === 'policies' && (
          <PoliciesLibraryTab
            policies={policies}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onAssign={(policy) => {
              setSelectedPolicy(policy);
              setShowAssignModal(true);
            }}
            onPublish={handlePublishPolicy}
            onArchive={handleArchivePolicy}
            isLoading={isLoading}
            isAdmin={isAdmin}
          />
        )}
        
        {activeTab === 'assignments' && (
          <AssignmentsTab
            assignments={allAssignments}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isLoading={isLoading}
          />
        )}
        
        {activeTab === 'audit' && isAdmin && (
          <AuditLogTab
            logs={auditLogs}
            isLoading={isLoading}
          />
        )}
        
        {/* UploadSimple Modal */}
        {showUploadModal && (
          <UploadPolicyModal
            onClose={() => setShowUploadModal(false)}
            onCreate={async (data, file) => {
              try {
                console.log('[UploadSimple Policy] Starting policy upload with staff store...');
                
                // Step 1: Create the policy
                const policy = await createStaffPolicy({
                  title: data.title,
                  category: data.category,
                });
                
                console.log('[UploadSimple Policy] Policy created:', policy.id);
                
                // Step 2: Create version with file upload
                await createPolicyVersion(policy.id, file, {
                  effective_date: data.effective_date,
                  expiry_date: data.expiry_date,
                });
                
                console.log('[UploadSimple Policy] Version created with document');
                
                toast.success('Policy uploaded successfully - now in Draft status');
                setShowUploadModal(false);
                
                // Refresh policies list
                fetchStaffPolicies();
                fetchOldPolicies();
              } catch (err: any) {
                console.error('[UploadSimple Policy] Error:', err);
                toast.error(err.message || 'Failed to upload policy');
              }
            }}
          />
        )}
        
        {/* Assign Modal */}
        {showAssignModal && selectedPolicy && (
          <AssignPolicyModal
            policy={selectedPolicy}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedPolicy(null);
            }}
            onAssign={async (data) => {
              try {
                console.log('[Assign Policy] Creating assignment via staff store...');
                
                // Find the latest version for this policy
                const latestVersionId = (selectedPolicy as any).latest_version?.id || 
                                        (selectedPolicy as any).versions?.[0]?.id ||
                                        selectedPolicy.id; // fallback
                
                // Use staff store's assignPolicy with enhanced features
                await assignPolicy({
                  policy_version_id: latestVersionId,
                  policy_id: selectedPolicy.id,
                  scope_type: data.assignment_type === 'organisation' ? 'role_location' : 'user',
                  targets: { user_ids: data.user_ids },
                  due_date: data.due_date,
                  acknowledgement_type: data.is_blocking ? 'blocking' : 'simple',
                  is_blocking: data.is_blocking,
                  reminder_schedule: data.reminder_schedule,
                  manager_note: data.manager_note,
                  repeat_cycle: data.repeat_cycle,
                  grace_period_days: data.grace_period_days,
                });
                
                const assignCount = data.user_ids?.length || 0;
                toast.success(`Policy assigned to ${assignCount} staff member${assignCount === 1 ? '' : 's'}`);
                setShowAssignModal(false);
                setSelectedPolicy(null);
                
                // Refresh data
                fetchAllAssignments();
                fetchAssignments();
                fetchComplianceStats();
              } catch (err: any) {
                console.error('[Assign Policy] Error:', err);
                toast.error(err.message || 'Failed to assign policy');
              }
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ComplianceDashboardTab({ stats, policyCompliance, isLoading }: any) {
  if (isLoading) {
    return <div className="text-center py-12">Loading compliance data...</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Total Policies</p>
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{stats.total_policies}</p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Completion Rate</p>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.completion_rate}%</p>
            <p className="text-xs text-slate-500 mt-1">
              {stats.acknowledged} of {stats.total_assignments} acknowledged
            </p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Overdue</p>
              <Warning className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
            <p className="text-xs text-slate-500 mt-1">Require immediate action</p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Due Soon</p>
              <CalendarBlank className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-amber-600">{stats.due_soon}</p>
            <p className="text-xs text-slate-500 mt-1">Within 7 days</p>
          </div>
        </div>
      )}
      
      {/* Policy Compliance Table */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Compliance by Policy</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Policy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Version</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase">Assignments</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase">Acknowledged</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase">Pending</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase">Overdue</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {policyCompliance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No policy compliance data available
                  </td>
                </tr>
              ) : (
                policyCompliance.map((pc: any) => (
                  <tr key={pc.policy_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">{pc.policy_title}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{pc.policy_version}</td>
                    <td className="px-6 py-4 text-sm text-center text-slate-900">{pc.total_assignments}</td>
                    <td className="px-6 py-4 text-sm text-center text-green-600 font-medium">{pc.acknowledged}</td>
                    <td className="px-6 py-4 text-sm text-center text-slate-600">{pc.pending}</td>
                    <td className="px-6 py-4 text-sm text-center text-red-600 font-medium">{pc.overdue}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${pc.completion_rate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{pc.completion_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PoliciesLibraryTab({ policies, searchQuery, setSearchQuery, onAssign, onPublish, onArchive, isLoading, isAdmin }: any) {
  const filteredPolicies = policies.filter((p: PolicyDocument) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="space-y-4">
      {/* MagnifyingGlass */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search policies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Policies List */}
      <div className="space-y-3">
        {isLoading && filteredPolicies.length === 0 ? (
          <div className="text-center py-12">Loading policies...</div>
        ) : filteredPolicies.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No policies found</p>
          </div>
        ) : (
          filteredPolicies.map((policy: PolicyDocument) => (
            <div key={policy.id} className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900">{policy.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      policy.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : policy.status === 'draft'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {policy.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span>Version {policy.version}</span>
                    {policy.category && (
                      <>
                        <span>•</span>
                        <span>{policy.category}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>Uploaded {new Date(policy.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                  
                  {policy.description && (
                    <p className="text-sm text-slate-600 mt-2">{policy.description}</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {policy.status === 'draft' && (
                    <button
                      onClick={() => onPublish(policy.id)}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Publish
                    </button>
                  )}
                  {policy.status === 'published' && (
                    <>
                      <button
                        onClick={() => onAssign(policy)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <UsersThree className="w-4 h-4" />
                        Assign
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => onArchive(policy.id)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                        >
                          <Archive className="w-4 h-4" />
                          Archive
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AssignmentsTab({ assignments, searchQuery, setSearchQuery, isLoading }: any) {
  const filteredAssignments = assignments.filter((a: PolicyAssignment) =>
    a.policy_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.assigned_to_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.assigned_to_email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'acknowledged':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Acknowledged</span>;
      case 'viewed':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Viewed</span>;
      case 'overdue':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Overdue</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-800">Pending</span>;
    }
  };
  
  return (
    <div className="space-y-4">
      {/* MagnifyingGlass */}
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search assignments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Assignments Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Policy</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Assigned By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading && filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Loading assignments...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No assignments found
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment: PolicyAssignment) => (
                  <tr key={assignment.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{assignment.policy_title}</p>
                        <p className="text-xs text-slate-500">v{assignment.policy_version}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-slate-900">{assignment.assigned_to_name}</p>
                        <p className="text-xs text-slate-500">{assignment.assigned_to_email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(assignment.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(assignment.due_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {assignment.assigned_by_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuditLogTab({ logs, isLoading }: any) {
  if (isLoading) {
    return <div className="text-center py-12">Loading audit logs...</div>;
  }
  
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No audit logs available
                </td>
              </tr>
            ) : (
              logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(log.timestamp).toLocaleString('en-GB')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-slate-900">{log.user_name}</p>
                      <p className="text-xs text-slate-500">{log.user_role}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Continue in next file due to length...