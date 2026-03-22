// Team Directory Tab
// Comprehensive staff roster with inline editing and filtering

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { useStaffStore } from '../store';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Search, UserPlus, AlertTriangle, CheckCircle2, Loader2, Users } from 'lucide-react';
import type { StaffMember } from '../types';

export function TeamDirectoryTab() {
  const navigate = useNavigate();
  const { staff, staffFilters, isLoading, fetchStaff, setStaffFilters } = useStaffStore();
  const [searchInput, setSearchInput] = useState(staffFilters.search || '');
  
  useEffect(() => {
    fetchStaff();
  }, []);
  
  const handleSearch = () => {
    setStaffFilters({ ...staffFilters, search: searchInput });
    fetchStaff({ ...staffFilters, search: searchInput });
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
        </div>
        
        <Button
          onClick={() => navigate('/staff/new')}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add Staff Member
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-slate-900">{staff.length}</div>
            <div className="text-sm text-slate-600">Total Staff</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-green-600">
              {staff.filter((s: any) => s.compliance_rate === 100).length}
            </div>
            <div className="text-sm text-slate-600">Fully Compliant</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-amber-600">
              {staff.filter((s: any) => s.overdue_policies_count > 0).length}
            </div>
            <div className="text-sm text-slate-600">With Overdue Policies</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Staff List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : staff.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Staff Members Found</h3>
            <p className="text-slate-600 mb-4">
              Staff members are automatically pulled from Settings → Users & Access.
            </p>
            <p className="text-sm text-slate-500">
              To add staff, go to <strong>Settings → Users & Access</strong> and create users with staff-type roles
              (Manager, Assistant Manager, Staff, Driver, Groomer, etc.).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {staff.map((member: any) => (
            <Card
              key={member.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/staff/member/${member.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-700 font-semibold">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </span>
                    </div>
                    
                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {member.first_name} {member.last_name}
                        </h3>
                        {member.status === 'active' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {member.status}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {member.role_key} • {member.email}
                      </div>
                    </div>
                    
                    {/* Compliance */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-900">
                          {member.compliance_rate}% Compliant
                        </div>
                        <div className="text-xs text-slate-500">
                          {member.assigned_policies_count} policies
                        </div>
                      </div>
                      
                      {member.overdue_policies_count > 0 ? (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      ) : member.compliance_rate === 100 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}