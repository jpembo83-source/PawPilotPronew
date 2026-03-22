// My Policies Page - Staff View
// Production-grade policy acknowledgement interface for employment compliance
// Staff can view assigned policies, download documents, and formally acknowledge them

import React, { useEffect, useState } from 'react';
import { useStaffStore } from '../../staff/store';
import { useAuth } from '../../../context/AuthContext';
import { 
  AlertCircle, CheckCircle, Eye, FileText, Calendar, AlertTriangle, 
  Filter, Download, Clock, RefreshCw, Shield, FileCheck, ChevronRight,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { supabase } from '@/utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { 
  POLICY_CATEGORY_LABELS, 
  REPEAT_CYCLE_LABELS,
  type AcknowledgementStatus,
  type PolicyCategory,
  type RepeatCycleType 
} from '../../staff/types';

type FilterType = 'all' | 'outstanding' | 'completed' | 'overdue';

// Type for policy assignment from staff store
interface MyPolicyAssignment {
  id: string;
  assignment_id?: string;
  policy_id: string;
  policy_title: string;
  policy_version: number;
  policy_category: PolicyCategory;
  policy_description?: string;
  version_id: string;
  assigned_at: string;
  due_date: string;
  assigned_by: string;
  assigned_by_name: string;
  manager_note?: string;
  status: AcknowledgementStatus;
  viewed_at: string | null;
  acknowledged_at: string | null;
  acknowledgement?: any;
  is_blocking: boolean;
  days_until_due: number;
  repeat_cycle?: RepeatCycleType;
  file_path?: string;
  file_name?: string;
}

export function MyPoliciesPage() {
  const { user } = useAuth();
  const {
    myPolicies,
    isLoading,
    error,
    fetchMyPolicies,
    acknowledgePolicy,
  } = useStaffStore();
  
  const [filter, setFilter] = useState<FilterType>('outstanding');
  const [selectedAssignment, setSelectedAssignment] = useState<MyPolicyAssignment | null>(null);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [documentViewed, setDocumentViewed] = useState(false);
  
  useEffect(() => {
    fetchMyPolicies().catch((err) => {
      if (err.message?.includes('Authentication required') || err.message?.includes('Unauthorised')) {
        setAuthError(true);
      }
    });
  }, []);
  
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);
  
  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchMyPolicies();
      toast.success('Policies refreshed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh policies');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleViewPolicy = async (assignment: MyPolicyAssignment) => {
    setSelectedAssignment(assignment);
    setShowAcknowledgeModal(true);
    setTypedName('');
    setConfirmationChecked(false);
    setDocumentViewed(false);
    
    // Fetch the document URL and open in new tab
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/${assignment.policy_id}/versions/${assignment.version_id}/download`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (response.ok) {
        const { download_url, file_name, file_available } = await response.json();
        if (file_available && download_url) {
          window.open(download_url, '_blank');
          setDocumentViewed(true);
          toast.success(`Opening ${file_name}`);
        } else {
          toast.info('Document preview unavailable - please read the policy summary below');
        }
      } else {
        toast.info('Document preview unavailable - please read the policy summary below');
      }
    } catch (err) {
      console.error('Failed to fetch document:', err);
      toast.info('Document preview unavailable - please read the policy summary below');
    }
  };
  
  const handleDownload = async (assignment: MyPolicyAssignment) => {
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff/policies/${assignment.policy_id}/versions/${assignment.version_id}/download`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Document not available');
      }
      
      const { download_url, file_name } = await response.json();
      
      const link = document.createElement('a');
      link.href = download_url;
      link.download = file_name;
      link.click();
      
      toast.success(`Downloading ${file_name}`);
    } catch (err: any) {
      toast.error(err.message || 'Document not available for download');
    }
  };
  
  const handleAcknowledge = async () => {
    if (!selectedAssignment) return;
    
    if (!confirmationChecked) {
      toast.error('Please confirm you have read and understood the policy');
      return;
    }
    
    // Require typed name for blocking policies
    if (selectedAssignment.is_blocking && !typedName.trim()) {
      toast.error('Please type your full name to confirm acknowledgement');
      return;
    }
    
    setAcknowledging(true);
    try {
      await acknowledgePolicy({
        assignment_id: selectedAssignment.id,
        policy_id: selectedAssignment.policy_id,
        policy_version_id: selectedAssignment.version_id,
        typed_name: typedName || user?.name || user?.email || '',
      });
      toast.success('Policy acknowledged successfully');
      setShowAcknowledgeModal(false);
      setSelectedAssignment(null);
      setTypedName('');
      setConfirmationChecked(false);
      await fetchMyPolicies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to acknowledge policy');
    } finally {
      setAcknowledging(false);
    }
  };
  
  // Filter assignments
  const filteredAssignments = myPolicies.filter((a: MyPolicyAssignment) => {
    if (filter === 'outstanding') {
      return a.status !== 'acknowledged';
    } else if (filter === 'completed') {
      return a.status === 'acknowledged';
    } else if (filter === 'overdue') {
      return a.status === 'overdue';
    }
    return true;
  });
  
  // Sort: blocking first, then overdue, then by due date
  const sortedAssignments = [...filteredAssignments].sort((a: MyPolicyAssignment, b: MyPolicyAssignment) => {
    // Blocking overdue first
    if (a.is_blocking && a.status === 'overdue' && !(b.is_blocking && b.status === 'overdue')) return -1;
    if (b.is_blocking && b.status === 'overdue' && !(a.is_blocking && a.status === 'overdue')) return 1;
    // Then other overdue
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    // Then by due date
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
  
  // Calculate stats
  const stats = {
    total: myPolicies.length,
    outstanding: myPolicies.filter((a: MyPolicyAssignment) => a.status !== 'acknowledged').length,
    overdue: myPolicies.filter((a: MyPolicyAssignment) => a.status === 'overdue').length,
    blocking: myPolicies.filter((a: MyPolicyAssignment) => a.is_blocking && a.status === 'overdue').length,
    completed: myPolicies.filter((a: MyPolicyAssignment) => a.status === 'acknowledged').length,
  };
  
  const getStatusBadge = (status: string, isBlocking: boolean) => {
    switch (status) {
      case 'acknowledged':
        return (
          <span className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center gap-1.5 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            Acknowledged
          </span>
        );
      case 'viewed':
        return (
          <span className="px-2.5 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center gap-1.5 font-medium">
            <Eye className="w-3.5 h-3.5" />
            Viewed
          </span>
        );
      case 'overdue':
        return (
          <span className={`px-2.5 py-1 text-xs rounded-full flex items-center gap-1.5 font-medium ${
            isBlocking 
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-red-100 text-red-800'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {isBlocking ? 'BLOCKING - Overdue' : 'Overdue'}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const getDaysUntilDue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  const getCategoryLabel = (category: PolicyCategory) => {
    return POLICY_CATEGORY_LABELS[category] || category || 'General';
  };
  
  if (isLoading && myPolicies.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your policies...</p>
        </div>
      </div>
    );
  }
  
  if (authError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Authentication Required</h2>
          <p className="text-slate-600 mb-4">
            Please log in to view your assigned policies.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">My Policies</h1>
            <p className="text-slate-600">
              Review and acknowledge company policies assigned to you
            </p>
          </div>
          <button
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
        {/* Critical Blocking Alert */}
        {stats.blocking > 0 && (
          <div className="bg-red-600 text-white rounded-lg p-4 shadow-lg animate-pulse">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-lg">⚠️ Critical: Blocking Policies Require Immediate Action</h3>
                <p className="text-red-100 mt-1">
                  You have {stats.blocking} blocking {stats.blocking === 1 ? 'policy' : 'policies'} that are overdue.
                  These policies must be acknowledged immediately as they may affect your work access.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Overdue Alert (non-blocking) */}
        {stats.overdue > 0 && stats.blocking === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Overdue Policies</h3>
              <p className="text-sm text-amber-700">
                You have {stats.overdue} overdue {stats.overdue === 1 ? 'policy' : 'policies'} that require acknowledgement.
              </p>
            </div>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Assigned</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Outstanding</p>
                <p className="text-2xl font-bold text-amber-600">{stats.outstanding}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Blocking</p>
                <p className="text-2xl font-bold text-red-700">{stats.blocking}</p>
              </div>
              <Shield className="w-8 h-8 text-red-500" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-600" />
          <span className="text-sm text-slate-600 mr-2">Filter:</span>
          {[
            { key: 'outstanding', label: 'Outstanding', count: stats.outstanding },
            { key: 'overdue', label: 'Overdue', count: stats.overdue },
            { key: 'completed', label: 'Completed', count: stats.completed },
            { key: 'all', label: 'All', count: stats.total },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as FilterType)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
        
        {/* Policies List */}
        <div className="space-y-3">
          {sortedAssignments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
              <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 text-lg">
                {filter === 'all' 
                  ? 'No policies assigned to you yet'
                  : filter === 'outstanding'
                  ? '🎉 All policies acknowledged!'
                  : `No ${filter} policies`}
              </p>
              {filter === 'outstanding' && stats.total > 0 && (
                <p className="text-green-600 mt-2">You're fully compliant with all assigned policies.</p>
              )}
            </div>
          ) : (
            sortedAssignments.map((assignment: MyPolicyAssignment) => {
              const daysUntilDue = getDaysUntilDue(assignment.due_date);
              const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3 && assignment.status !== 'acknowledged';
              const isBlockingOverdue = assignment.is_blocking && assignment.status === 'overdue';
              
              return (
                <div
                  key={assignment.id}
                  className={`bg-white border rounded-lg p-5 transition-all hover:shadow-md ${
                    isBlockingOverdue
                      ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                      : assignment.status === 'overdue'
                      ? 'border-red-200 bg-red-50'
                      : isDueSoon
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isBlockingOverdue ? 'bg-red-200' :
                          assignment.status === 'overdue' ? 'bg-red-100' :
                          assignment.status === 'acknowledged' ? 'bg-green-100' :
                          'bg-blue-100'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            isBlockingOverdue ? 'text-red-700' :
                            assignment.status === 'overdue' ? 'text-red-600' :
                            assignment.status === 'acknowledged' ? 'text-green-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 text-lg mb-1">
                            {assignment.policy_title}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                              {getCategoryLabel(assignment.policy_category)}
                            </span>
                            <span>Version {assignment.policy_version}</span>
                            {assignment.repeat_cycle && assignment.repeat_cycle !== 'none' && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600">
                                  {REPEAT_CYCLE_LABELS[assignment.repeat_cycle]}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600 mt-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Due: {formatDate(assignment.due_date)}
                              {daysUntilDue >= 0 && assignment.status !== 'acknowledged' && (
                                <span className={`ml-1 ${
                                  isDueSoon ? 'text-amber-700 font-medium' : 'text-slate-500'
                                }`}>
                                  ({daysUntilDue} {daysUntilDue === 1 ? 'day' : 'days'} left)
                                </span>
                              )}
                              {daysUntilDue < 0 && assignment.status !== 'acknowledged' && (
                                <span className="ml-1 text-red-700 font-medium">
                                  ({Math.abs(daysUntilDue)} {Math.abs(daysUntilDue) === 1 ? 'day' : 'days'} overdue)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            {getStatusBadge(assignment.status, assignment.is_blocking)}
                            {assignment.is_blocking && assignment.status !== 'acknowledged' && (
                              <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 font-medium">
                                Blocking Policy
                              </span>
                            )}
                          </div>
                          {assignment.manager_note && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-900">
                                <strong>Manager Note:</strong> {assignment.manager_note}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {assignment.status !== 'acknowledged' && (
                        <button
                          onClick={() => handleViewPolicy(assignment)}
                          className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 font-medium ${
                            isBlockingOverdue
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          View & Acknowledge
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(assignment)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      {assignment.status === 'acknowledged' && assignment.acknowledged_at && (
                        <p className="text-xs text-green-600 text-center mt-1">
                          Acknowledged {formatDate(assignment.acknowledged_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Acknowledge Modal */}
        {showAcknowledgeModal && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Acknowledge Policy
                </h2>
              </div>
              
              <div className="p-6 space-y-5">
                {/* Policy Info */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 text-lg">
                    {selectedAssignment.policy_title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-slate-600 mt-2">
                    <span>{getCategoryLabel(selectedAssignment.policy_category)}</span>
                    <span>•</span>
                    <span>Version {selectedAssignment.policy_version}</span>
                  </div>
                  {selectedAssignment.policy_description && (
                    <p className="text-sm text-slate-600 mt-3">
                      {selectedAssignment.policy_description}
                    </p>
                  )}
                </div>
                
                {/* Document Access */}
                {documentViewed ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">Document Opened</p>
                      <p className="text-sm text-green-700">
                        The policy document has been opened in a new tab for your review.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <ExternalLink className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">Review the Policy Document</p>
                        <p className="text-sm text-blue-700 mt-1">
                          The policy document should have opened in a new tab. If it didn't, 
                          please click the button below to view it.
                        </p>
                        <button
                          onClick={() => handleViewPolicy(selectedAssignment)}
                          className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1"
                        >
                          Open Document
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Legal Acknowledgement */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-medium text-amber-900 mb-3">
                    By acknowledging this policy, you confirm that:
                  </p>
                  <ul className="space-y-2 text-sm text-amber-800">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>You have read and understood this policy in its entirety</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>You agree to comply with all requirements set out in this policy</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>You understand that failure to comply may result in disciplinary action</span>
                    </li>
                  </ul>
                </div>
                
                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={confirmationChecked}
                    onChange={(e) => setConfirmationChecked(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    <strong>I confirm</strong> that I have read, understood, and agree to comply with this policy 
                    as part of my employment obligations.
                  </span>
                </label>
                
                {/* Typed Name (required for blocking policies) */}
                {selectedAssignment.is_blocking && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Type your full name to confirm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder={user?.name || 'Your full name'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      This acts as your electronic signature for audit purposes.
                    </p>
                  </div>
                )}
                
                {/* Acknowledgement Details */}
                <div className="bg-slate-100 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Your Name:</span>
                    <span className="font-medium text-slate-900">{user?.name || user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date & Time:</span>
                    <span className="font-medium text-slate-900">
                      {new Date().toLocaleString('en-GB', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Policy Version:</span>
                    <span className="font-medium text-slate-900">{selectedAssignment.policy_version}</span>
                  </div>
                </div>
                
                {/* Audit Notice */}
                <p className="text-xs text-slate-500 text-center">
                  Your acknowledgement will be permanently recorded with timestamp and cannot be modified.
                  This record may be used for compliance audits and legal purposes.
                </p>
              </div>
              
              {/* Actions */}
              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
                <button
                  onClick={() => {
                    setShowAcknowledgeModal(false);
                    setSelectedAssignment(null);
                    setTypedName('');
                    setConfirmationChecked(false);
                    setDocumentViewed(false);
                  }}
                  disabled={acknowledging}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcknowledge}
                  disabled={acknowledging || !confirmationChecked || (selectedAssignment.is_blocking && !typedName.trim())}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {acknowledging ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      I Acknowledge This Policy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default MyPoliciesPage;
