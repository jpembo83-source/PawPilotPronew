// Policies Tab - Policy library, upload, and assignment
// Enhanced with blocking policy management and repeat cycles

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  FileText, Upload, Users, Search, CheckCircle, AlertCircle, 
  Trash2, Edit, Loader2, Shield, Calendar, RefreshCw, ExternalLink,
  Download, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStaffStore } from '../store';
import type { Policy, PolicyCategory, POLICY_CATEGORY_LABELS } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { useComplianceStats } from '../../policies/hooks/usePolicyCompliance';

export function PoliciesTab() {
  const navigate = useNavigate();
  const { policies, assignments, staff, isLoading, fetchPolicies, fetchAssignments, fetchStaff, createPolicy, createPolicyVersion, deletePolicy, assignPolicy } = useStaffStore();
  const [searchInput, setSearchInput] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPolicyForAssign, setSelectedPolicyForAssign] = useState<Policy | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState<Policy | null>(null);
  
  // Upload form
  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: 'other' as PolicyCategory,
    file: null as File | null,
    effective_date: new Date().toISOString().split('T')[0],
  });
  
  // Edit form (new version)
  const [editForm, setEditForm] = useState({
    file: null as File | null,
    effective_date: new Date().toISOString().split('T')[0],
  });
  
  // Assign form
  const [assignForm, setAssignForm] = useState({
    selectedUserIds: [] as string[],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
    acknowledgementType: 'signature' as 'signature' | 'checkbox',
  });
  
  useEffect(() => {
    fetchPolicies();
    fetchAssignments();
    fetchStaff();
  }, []);
  
  const handleCreateAndUpload = async () => {
    if (!uploadForm.title || !uploadForm.file) {
      toast.error('Please provide title and select a file');
      return;
    }
    
    try {
      // Create policy
      const policy = await createPolicy({
        title: uploadForm.title,
        category: uploadForm.category,
        effective_date: uploadForm.effective_date,
      });
      
      // Upload first version
      await createPolicyVersion(policy.id, uploadForm.file, {
        effective_date: uploadForm.effective_date,
      });
      
      toast.success('Policy uploaded successfully');
      setUploadDialogOpen(false);
      setUploadForm({
        title: '',
        category: 'other',
        file: null,
        effective_date: new Date().toISOString().split('T')[0],
      });
      
      fetchPolicies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload policy');
    }
  };
  
  const openAssignDialog = (policy: Policy) => {
    setSelectedPolicyForAssign(policy);
    setAssignForm({
      selectedUserIds: [],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      acknowledgementType: 'signature',
    });
    setAssignDialogOpen(true);
  };
  
  const handleAssignPolicy = async () => {
    if (!selectedPolicyForAssign || assignForm.selectedUserIds.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }
    
    if (!selectedPolicyForAssign.latest_version?.id) {
      toast.error('Policy has no active version');
      return;
    }
    
    try {
      await assignPolicy({
        policy_id: selectedPolicyForAssign.id,
        policy_version_id: selectedPolicyForAssign.latest_version.id,
        scope_type: 'user',
        targets: {
          user_ids: assignForm.selectedUserIds,
        },
        due_date: assignForm.dueDate,
        acknowledgement_type: assignForm.acknowledgementType,
      });
      
      toast.success(`Policy assigned to ${assignForm.selectedUserIds.length} staff member${assignForm.selectedUserIds.length > 1 ? 's' : ''}`);
      setAssignDialogOpen(false);
      setSelectedPolicyForAssign(null);
      setAssignForm({
        selectedUserIds: [],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        acknowledgementType: 'signature',
      });
      
      fetchAssignments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign policy');
    }
  };
  
  const toggleStaffSelection = (userId: string) => {
    setAssignForm(prev => ({
      ...prev,
      selectedUserIds: prev.selectedUserIds.includes(userId)
        ? prev.selectedUserIds.filter(id => id !== userId)
        : [...prev.selectedUserIds, userId],
    }));
  };
  
  const selectAllStaff = () => {
    const activeStaffIds = staff.filter(s => s.status === 'active').map(s => s.id);
    setAssignForm(prev => ({ ...prev, selectedUserIds: activeStaffIds }));
  };
  
  const deselectAllStaff = () => {
    setAssignForm(prev => ({ ...prev, selectedUserIds: [] }));
  };
  
  const handleDeletePolicy = async (policy: Policy) => {
    if (!confirm(`Are you sure you want to delete "${policy.title}"? This will also delete all versions and assignments.`)) {
      return;
    }
    
    try {
      await deletePolicy(policy.id);
      toast.success('Policy deleted successfully');
      fetchPolicies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete policy');
    }
  };
  
  const openEditDialog = (policy: Policy) => {
    setSelectedPolicyForEdit(policy);
    setEditForm({
      file: null,
      effective_date: new Date().toISOString().split('T')[0],
    });
    setEditDialogOpen(true);
  };
  
  const handleUploadNewVersion = async () => {
    if (!selectedPolicyForEdit || !editForm.file) {
      toast.error('Please select a file');
      return;
    }
    
    try {
      await createPolicyVersion(selectedPolicyForEdit.id, editForm.file, {
        effective_date: editForm.effective_date,
      });
      
      toast.success('New version uploaded successfully');
      setEditDialogOpen(false);
      setSelectedPolicyForEdit(null);
      setEditForm({
        file: null,
        effective_date: new Date().toISOString().split('T')[0],
      });
      
      fetchPolicies();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload new version');
    }
  };
  
  const getAssignmentStats = (policyId: string) => {
    const policyAssignments = assignments.filter(a => a.policy_id === policyId);
    if (policyAssignments.length === 0) return null;
    
    const totalAssignees = policyAssignments.reduce((sum, a) => sum + (a.total_assignees || 0), 0);
    const totalAcknowledged = policyAssignments.reduce((sum, a) => sum + (a.acknowledged_count || 0), 0);
    const totalOverdue = policyAssignments.reduce((sum, a) => sum + (a.overdue_count || 0), 0);
    
    return { totalAssignees, totalAcknowledged, totalOverdue };
  };
  
  const getCategoryLabel = (category: PolicyCategory) => {
    const labels: Record<PolicyCategory, string> = {
      health_safety: 'Health & Safety',
      daycare_sop: 'Daycare SOP',
      grooming_sop: 'Grooming SOP',
      transport_sop: 'Transport SOP',
      overnight_sop: 'Overnight SOP',
      hr_policy: 'HR Policy',
      data_protection: 'Data Protection',
      other: 'Other',
    };
    return labels[category] || category;
  };
  
  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search policies..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Upload className="h-4 w-4 mr-2" />
                Upload Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload New Policy</DialogTitle>
                <DialogDescription>
                  Upload a new policy document to your library.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="title">Policy Title</Label>
                  <Input
                    id="title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="e.g. Health & Safety Policy 2026"
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={uploadForm.category}
                    onValueChange={(value) => setUploadForm({ ...uploadForm, category: value as PolicyCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="health_safety">Health & Safety</SelectItem>
                      <SelectItem value="daycare_sop">Daycare SOP</SelectItem>
                      <SelectItem value="grooming_sop">Grooming SOP</SelectItem>
                      <SelectItem value="transport_sop">Transport SOP</SelectItem>
                      <SelectItem value="overnight_sop">Overnight SOP</SelectItem>
                      <SelectItem value="hr_policy">HR Policy</SelectItem>
                      <SelectItem value="data_protection">Data Protection</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="file">Document (PDF or DOCX)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="effective_date">Effective Date</Label>
                  <Input
                    id="effective_date"
                    type="date"
                    value={uploadForm.effective_date}
                    onChange={(e) => setUploadForm({ ...uploadForm, effective_date: e.target.value })}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAndUpload} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-slate-900">{policies.length}</div>
            <div className="text-sm text-slate-600">Total Policies</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-blue-600">{assignments.length}</div>
            <div className="text-sm text-slate-600">Active Assignments</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-green-600">
              {assignments.reduce((sum, a) => sum + (a.acknowledged_count || 0), 0)}
            </div>
            <div className="text-sm text-slate-600">Acknowledged</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-amber-600">
              {assignments.reduce((sum, a) => sum + (a.overdue_count || 0), 0)}
            </div>
            <div className="text-sm text-slate-600">Overdue</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Policy List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">No policies yet</p>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload First Policy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => {
            const stats = getAssignmentStats(policy.id);
            
            return (
              <Card key={policy.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <h3 className="font-semibold text-slate-900">{policy.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {getCategoryLabel(policy.category)}
                            </span>
                            <span className="text-xs text-slate-500">
                              Version {policy.latest_version?.version_number || 1}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {stats && (
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-600">{stats.totalAssignees} assigned</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-slate-600">{stats.totalAcknowledged} acknowledged</span>
                          </div>
                          {stats.totalOverdue > 0 && (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                              <span className="text-amber-600">{stats.totalOverdue} overdue</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        key={`assign-${policy.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignDialog(policy)}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Assign
                      </Button>
                      
                      <Button
                        key={`delete-${policy.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePolicy(policy)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                      
                      <Button
                        key={`edit-${policy.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(policy)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Edit Policy Dialog (Upload New Version) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
            <DialogDescription>
              Upload a new version for "{selectedPolicyForEdit?.title}".
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-file">Document (PDF or DOCX)</Label>
              <Input
                id="edit-file"
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setEditForm({ ...editForm, file: e.target.files?.[0] || null })}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-effective-date">Effective Date</Label>
              <Input
                id="edit-effective-date"
                type="date"
                value={editForm.effective_date}
                onChange={(e) => setEditForm({ ...editForm, effective_date: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadNewVersion} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Assign Policy Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Policy</DialogTitle>
            <DialogDescription>
              Assign "{selectedPolicyForAssign?.title}" to staff members.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="assign-due-date">Due Date</Label>
              <Input
                id="assign-due-date"
                type="date"
                value={assignForm.dueDate}
                onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="assign-acknowledgement-type">Acknowledgement Type</Label>
              <Select
                value={assignForm.acknowledgementType}
                onValueChange={(value) => setAssignForm({ ...assignForm, acknowledgementType: value as 'signature' | 'checkbox' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signature">Signature</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Select Staff Members ({assignForm.selectedUserIds.length} selected)</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllStaff}
                  type="button"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAllStaff}
                  type="button"
                >
                  Deselect All
                </Button>
              </div>
            </div>
            
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              {staff.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  No staff members found
                </div>
              ) : (
                <div className="divide-y">
                  {staff.map(s => (
                    <label
                      key={s.id}
                      htmlFor={`assign-user-${s.id}`}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox
                        id={`assign-user-${s.id}`}
                        checked={assignForm.selectedUserIds.includes(s.id)}
                        onCheckedChange={() => toggleStaffSelection(s.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">
                          {s.first_name} {s.last_name}
                        </div>
                        <div className="text-sm text-slate-600 capitalize">
                          {s.role_key?.replace(/_/g, ' ')}
                        </div>
                      </div>
                      {s.status === 'active' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                          {s.status}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignPolicy} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}