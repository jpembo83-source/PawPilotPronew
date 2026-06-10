// Staff Member Detail Page
// Comprehensive staff member profile

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { useStaffStore } from '../store';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { ArrowLeft, EnvelopeSimple, Phone, MapPin, CalendarBlank, CheckCircle, Warning, XCircle, CircleNotch } from '@phosphor-icons/react';
import type { StaffMember } from '../types';

export function StaffMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { staff, isLoading, fetchStaff } = useStaffStore();
  const [member, setMember] = useState<StaffMember | null>(null);
  
  useEffect(() => {
    // Fetch staff if not already loaded
    if (staff.length === 0) {
      fetchStaff();
    }
  }, []);
  
  useEffect(() => {
    // Find the member from the staff list
    if (id && staff.length > 0) {
      const foundMember = staff.find((s: any) => s.id === id);
      setMember(foundMember || null);
    }
  }, [id, staff]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <CircleNotch className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  if (!member) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button
          variant="outline"
          onClick={() => navigate('/staff')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff
        </Button>
        
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Staff Member Not Found</h3>
            <p className="text-slate-600 mb-4">
              The staff member you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate('/staff')}>
              Return to Staff Directory
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const complianceRate = member.compliance_rate || 0;
  const overdueCount = member.overdue_policies_count || 0;
  const assignedCount = member.assigned_policies_count || 0;
  const acknowledgedCount = assignedCount - overdueCount;
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate('/staff')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff
        </Button>
        
        <div className="flex gap-2">
          <Button variant="outline">
            Edit Details
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            Assign Policy
          </Button>
        </div>
      </div>
      
      {/* Profile Card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl text-blue-700 font-semibold">
                {member.first_name?.[0]}{member.last_name?.[0]}
              </span>
            </div>
            
            {/* Details */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {member.first_name} {member.last_name}
                </h1>
                {member.status === 'active' ? (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                    Active
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                    {member.status}
                  </span>
                )}
              </div>
              
              <div className="text-lg text-slate-600 mb-4 capitalize">
                {member.role_key}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <EnvelopeSimple className="h-4 w-4" />
                  <span className="text-sm">{member.email}</span>
                </div>
                
                {member.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">{member.phone}</span>
                  </div>
                )}
                
                {member.location_ids && member.location_ids.length > 0 && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">
                      {member.location_ids.length} {member.location_ids.length === 1 ? 'location' : 'locations'}
                    </span>
                  </div>
                )}
                
                {member.created_at && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <CalendarBlank className="h-4 w-4" />
                    <span className="text-sm">
                      Joined {new Date(member.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Compliance Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-6 text-center">
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {complianceRate}%
            </div>
            <div className="text-sm text-slate-600">Compliance Rate</div>
            {complianceRate === 100 && (
              <CheckCircle className="h-5 w-5 text-green-500 mx-auto mt-2" />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {acknowledgedCount}
            </div>
            <div className="text-sm text-slate-600">Acknowledged</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-6 text-center">
            <div className="text-3xl font-bold text-amber-600 mb-1">
              {overdueCount}
            </div>
            <div className="text-sm text-slate-600">Overdue</div>
            {overdueCount > 0 && (
              <Warning className="h-5 w-5 text-amber-500 mx-auto mt-2" />
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Assigned Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Policies ({assignedCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {assignedCount === 0 ? (
            <div className="text-center py-8 text-slate-600">
              No policies assigned yet
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Policy details will be shown here. This is a placeholder for now.
              </p>
              <p className="text-xs text-slate-500">
                Future enhancement: List all policies assigned to this staff member with acknowledgement status and due dates.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Shift ClockCounterClockwise */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-600">
            No shift data available yet
          </div>
        </CardContent>
      </Card>
    </div>
  );
}