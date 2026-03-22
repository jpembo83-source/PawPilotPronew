// Policy Upload and Assignment Modals
// Enhanced with repeat cycles, reminders, and compliance features

import React, { useState, useEffect } from 'react';
import { PolicyDocument } from '../store';
import { X, Upload, AlertCircle, RefreshCw, Bell, Calendar, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../utils/supabase/client';
import { publicAnonKey, projectId } from '../../../../../utils/supabase/info';

// ============================================================================
// TYPES
// ============================================================================

type RepeatCycleType = 'none' | 'annual' | 'biannual' | 'quarterly' | 'on_update' | 'on_role_change';

interface ReminderSchedule {
  days_before: number[];
  overdue_reminder: boolean;
  overdue_interval_days?: number;
}

// ============================================================================
// UPLOAD POLICY MODAL
// ============================================================================

interface UploadPolicyModalProps {
  onClose: () => void;
  onCreate: (data: any, file: File) => Promise<void>;
}

export function UploadPolicyModal({ onClose, onCreate }: UploadPolicyModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    version: '1.0',
    description: '',
    effective_date: '',
    expiry_date: '',
    requires_reacknowledgement: true,
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Invalid file type. Please upload PDF, DOC, or DOCX files only.');
      return;
    }
    
    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit');
      return;
    }
    
    setFile(selectedFile);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    
    if (!formData.title || !formData.version) {
      toast.error('Title and version are required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onCreate(formData, file);
    } catch (error) {
      // Error handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Upload Policy</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Document File <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={isSubmitting}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, DOC, or DOCX (max 10MB)</p>
                  </div>
                )}
              </label>
            </div>
          </div>
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Policy Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Health & Safety Policy"
              required
              disabled={isSubmitting}
            />
          </div>
          
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            >
              <option value="">Select category (optional)</option>
              <option value="Health & Safety">Health & Safety</option>
              <option value="Data Protection">Data Protection</option>
              <option value="Operations">Operations</option>
              <option value="HR">HR</option>
              <option value="Customer Service">Customer Service</option>
              <option value="Finance">Finance</option>
              <option value="Daycare">Daycare</option>
              <option value="Grooming">Grooming</option>
              <option value="Transport">Transport</option>
              <option value="Legal & Compliance">Legal & Compliance</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          {/* Version */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Version <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 1.0"
              required
              disabled={isSubmitting}
            />
          </div>
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Effective Date
              </label>
              <input
                type="date"
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Review/Expiry Date
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description / Summary
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of this policy..."
              disabled={isSubmitting}
            />
          </div>
          
          {/* Requires Re-acknowledgement */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="requires-reack"
              checked={formData.requires_reacknowledgement}
              onChange={(e) => setFormData({ ...formData, requires_reacknowledgement: e.target.checked })}
              className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              disabled={isSubmitting}
            />
            <label htmlFor="requires-reack" className="text-sm text-slate-700">
              <span className="font-medium">Requires re-acknowledgement on new version</span>
              <p className="text-slate-500 mt-0.5">
                When a new version is published, automatically reassign to users who acknowledged previous versions
              </p>
            </label>
          </div>
          
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Policy Upload Process</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Policy will be created in <strong>Draft</strong> status</li>
                <li>Review and publish when ready</li>
                <li>Published policies are immutable — updates create new versions</li>
                <li>All versions are retained for audit compliance</li>
              </ul>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !file}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Uploading...' : 'Upload Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// ASSIGN POLICY MODAL (Enhanced with Repeat Cycles)
// ============================================================================

interface AssignPolicyModalProps {
  policy: PolicyDocument;
  onClose: () => void;
  onAssign: (data: {
    user_ids: string[];
    due_date: string;
    is_blocking?: boolean;
    location_scope?: string[];
    role_scope?: string[];
    assignment_type: 'individual' | 'location' | 'role' | 'organisation';
    repeat_cycle?: RepeatCycleType;
    grace_period_days?: number;
    reminder_schedule?: ReminderSchedule;
    manager_note?: string;
  }) => Promise<void>;
}

export function AssignPolicyModal({ policy, onClose, onAssign }: AssignPolicyModalProps) {
  // Core state
  const [assignmentType, setAssignmentType] = useState<'individual' | 'location' | 'role' | 'organisation'>('individual');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  
  // Enhanced state for repeat cycles and reminders
  const [repeatCycle, setRepeatCycle] = useState<RepeatCycleType>('none');
  const [gracePeriodDays, setGracePeriodDays] = useState(14);
  const [reminderDays, setReminderDays] = useState<number[]>([7, 3, 1]);
  const [overdueReminder, setOverdueReminder] = useState(true);
  const [managerNote, setManagerNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  useEffect(() => {
    // Fetch users
    const fetchUsers = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const tenantId = session?.user?.user_metadata?.tenant_id || session?.user?.user_metadata?.tenantId;
        
        // Try the staff endpoint first
        const staffResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/staff`, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${token}`,
            'X-Tenant-Id': tenantId || '',
          },
        });
        
        if (staffResponse.ok) {
          const staffData = await staffResponse.json();
          setUsers(staffData.filter((u: any) => 
            u.status === 'active' && 
            !['admin', 'customer'].includes(u.role_key || u.role)
          ).map((u: any) => ({
            id: u.id || u.user_id,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
            email: u.email,
            role: u.role_key || u.role,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
        toast.error('Failed to load staff members');
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    fetchUsers();
    
    // Set default due date to 14 days from now
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 14);
    setDueDate(defaultDue.toISOString().split('T')[0]);
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (assignmentType === 'individual' && selectedUsers.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }
    
    if (!dueDate) {
      toast.error('Please select a due date');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onAssign({
        user_ids: assignmentType === 'organisation' ? users.map(u => u.id) : selectedUsers,
        due_date: new Date(dueDate).toISOString(),
        is_blocking: isBlocking,
        assignment_type: assignmentType,
        repeat_cycle: repeatCycle,
        grace_period_days: repeatCycle !== 'none' ? gracePeriodDays : undefined,
        reminder_schedule: {
          days_before: reminderDays,
          overdue_reminder: overdueReminder,
          overdue_interval_days: 3, // Send overdue reminders every 3 days
        },
        manager_note: managerNote || undefined,
      });
    } catch (error) {
      // Error handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };
  
  const selectAll = () => {
    setSelectedUsers(users.map(u => u.id));
  };
  
  const deselectAll = () => {
    setSelectedUsers([]);
  };
  
  const toggleReminderDay = (day: number) => {
    setReminderDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => b - a)
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Assign Policy</h2>
            <p className="text-sm text-slate-600 mt-1">{policy.title} (v{policy.version})</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Assignment Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assignment Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentType('individual')}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  assignmentType === 'individual'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                disabled={isSubmitting}
              >
                Individual Staff
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignmentType('organisation');
                  setSelectedUsers(users.map(u => u.id));
                }}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  assignmentType === 'organisation'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                disabled={isSubmitting}
              >
                All Staff
              </button>
            </div>
          </div>
          
          {/* User Selection (if individual) */}
          {assignmentType === 'individual' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Select Staff Members <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs text-blue-600 hover:text-blue-700"
                    disabled={isSubmitting}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-xs text-slate-600 hover:text-slate-700"
                    disabled={isSubmitting}
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              
              {isLoadingUsers ? (
                <div className="text-center py-8 text-slate-500">Loading staff...</div>
              ) : (
                <div className="border border-slate-300 rounded-lg max-h-48 overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No staff available</div>
                  ) : (
                    users.map(user => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-200 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                        <span className="text-xs text-slate-500 capitalize shrink-0">{user.role}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
              
              {selectedUsers.length > 0 && (
                <p className="text-sm text-slate-600 mt-2">
                  {selectedUsers.length} {selectedUsers.length === 1 ? 'staff member' : 'staff members'} selected
                </p>
              )}
            </div>
          )}
          
          {assignmentType === 'organisation' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                This policy will be assigned to <strong>all active staff members</strong> ({users.length} staff)
              </p>
            </div>
          )}
          
          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Acknowledgement Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isSubmitting}
            />
          </div>
          
          {/* Blocking */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <input
              type="checkbox"
              id="is-blocking"
              checked={isBlocking}
              onChange={(e) => setIsBlocking(e.target.checked)}
              className="mt-1 w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
              disabled={isSubmitting}
            />
            <label htmlFor="is-blocking" className="text-sm text-slate-700">
              <span className="font-medium text-amber-800">⚠️ Blocking assignment (Critical)</span>
              <p className="text-amber-700 mt-0.5">
                Overdue blocking policies may prevent staff from being scheduled on rotas and will show warnings in operational dashboards.
              </p>
            </label>
          </div>
          
          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            {showAdvanced ? 'Hide' : 'Show'} repeat cycles & reminders
          </button>
          
          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-5 p-4 bg-slate-50 rounded-lg border border-slate-200">
              {/* Repeat Cycle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  Repeat Acknowledgement Cycle
                </label>
                <select
                  value={repeatCycle}
                  onChange={(e) => setRepeatCycle(e.target.value as RepeatCycleType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                >
                  <option value="none">One-time acknowledgement only</option>
                  <option value="annual">Annual re-acknowledgement (every 12 months)</option>
                  <option value="biannual">Bi-annual (every 6 months)</option>
                  <option value="quarterly">Quarterly (every 3 months)</option>
                  <option value="on_update">On policy update (new version)</option>
                  <option value="on_role_change">When staff role or location changes</option>
                </select>
                
                {repeatCycle !== 'none' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Grace Period (days after expiry)
                    </label>
                    <input
                      type="number"
                      value={gracePeriodDays}
                      onChange={(e) => setGracePeriodDays(parseInt(e.target.value) || 0)}
                      min={0}
                      max={90}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Days allowed to re-acknowledge after previous acknowledgement expires
                    </p>
                  </div>
                )}
              </div>
              
              {/* Reminder Schedule */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-slate-500" />
                  Reminder Schedule
                </label>
                <div className="flex flex-wrap gap-2">
                  {[14, 7, 3, 1].map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleReminderDay(day)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        reminderDays.includes(day)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={isSubmitting}
                    >
                      {day} {day === 1 ? 'day' : 'days'} before
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    id="overdue-reminder"
                    checked={overdueReminder}
                    onChange={(e) => setOverdueReminder(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="overdue-reminder" className="text-sm text-slate-700">
                    Continue reminding after due date (every 3 days)
                  </label>
                </div>
              </div>
              
              {/* Manager Note */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-500" />
                  Manager Note (optional)
                </label>
                <textarea
                  value={managerNote}
                  onChange={(e) => setManagerNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add context or instructions for staff..."
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}
          
          {/* Legal Note */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">📋 Audit Trail</p>
            <p>
              All assignments and acknowledgements are immutably logged with timestamps, 
              user identity, and metadata for employment compliance and legal defensibility.
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (assignmentType === 'individual' && selectedUsers.length === 0)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Assigning...' : `Assign to ${
                assignmentType === 'organisation' ? users.length : selectedUsers.length
              } ${(assignmentType === 'organisation' ? users.length : selectedUsers.length) === 1 ? 'Staff' : 'Staff'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
