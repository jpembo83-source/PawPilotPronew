// Grooming Appointments - MDC Operations Centre
// List and manage grooming appointments

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useGroomingStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useAuth } from '../../../context/AuthContext';
import { useModuleRealtimeSync } from '../../../hooks/useModuleRealtimeSync';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { 
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { 
  APPOINTMENT_STATUSES, 
  SERVICE_TYPES, 
  type GroomingAppointment,
  type AppointmentStatus,
  type GroomingServiceType,
} from '../types';

export function GroomingAppointments() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { 
    appointments,
    isLoading,
    error,
    fetchAppointments,
    cancelAppointment,
    clearError,
  } = useGroomingStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<GroomingAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  useEffect(() => {
    loadAppointments();
  }, [selectedLocationId, selectedDate, statusFilter, serviceFilter]);
  
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);
  
  const loadAppointments = useCallback(async () => {
    const filters: any = {
      date: selectedDate,
    };
    
    if (selectedLocationId !== 'ALL') {
      filters.location_id = selectedLocationId;
    }
    
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    
    if (serviceFilter !== 'all') {
      filters.service_type = serviceFilter;
    }
    
    await fetchAppointments(filters);
  }, [selectedDate, selectedLocationId, statusFilter, serviceFilter]);

  const locationFilter = selectedLocationId && selectedLocationId !== 'ALL' ? [selectedLocationId] : undefined;
  useModuleRealtimeSync('grooming', loadAppointments, true, locationFilter);
  
  const filteredAppointments = appointments.filter(apt => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      apt.pet_name?.toLowerCase().includes(query) ||
      apt.household_name?.toLowerCase().includes(query)
    );
  });
  
  const handleCancelClick = (appointment: GroomingAppointment) => {
    setAppointmentToCancel(appointment);
    setCancelReason('');
    setShowCancelDialog(true);
  };
  
  const handleConfirmCancel = async () => {
    if (!appointmentToCancel || !cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    
    try {
      await cancelAppointment(appointmentToCancel.id, cancelReason);
      toast.success('Appointment cancelled');
      setShowCancelDialog(false);
      loadAppointments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  
  const handleDateChange = (direction: 'prev' | 'next') => {
    const current = parseISO(selectedDate);
    const newDate = direction === 'prev' ? subDays(current, 1) : addDays(current, 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };
  
  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager' || user?.role === 'staff';
  const canCancel = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager';
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Grooming Appointments</h1>
          <p className="text-slate-600 mt-1">Manage salon schedule</p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/grooming/appointments/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        )}
      </div>
      
      {/* Date Navigation */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            >
              Today
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search pet or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(APPOINTMENT_STATUSES).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {Object.entries(SERVICE_TYPES).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Appointments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Groomer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading appointments...
                  </TableCell>
                </TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    No appointments found for this date
                  </TableCell>
                </TableRow>
              ) : (
                filteredAppointments.map((apt) => {
                  const statusInfo = APPOINTMENT_STATUSES[apt.status];
                  const serviceInfo = SERVICE_TYPES[apt.service_type];
                  
                  return (
                    <TableRow 
                      key={apt.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/grooming/appointments/${apt.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">{apt.appointment_time}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {apt.estimated_duration_minutes} min
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {apt.pet_photo_url ? (
                            <img 
                              src={apt.pet_photo_url} 
                              alt={apt.pet_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                              🐕
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{apt.pet_name}</p>
                            {apt.pet_breed && (
                              <p className="text-xs text-slate-500">{apt.pet_breed}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{apt.household_name}</TableCell>
                      <TableCell>
                        <p className="font-medium">{apt.service_name || serviceInfo?.label}</p>
                      </TableCell>
                      <TableCell>
                        {apt.groomer_name || (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusInfo?.bgColor} ${statusInfo?.color}`}>
                          {statusInfo?.label || apt.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {apt.has_behaviour_flag && (
                            <Badge variant="destructive" className="text-xs">
                              Behaviour
                            </Badge>
                          )}
                          {apt.has_medical_flag && (
                            <Badge variant="secondary" className="text-xs">
                              Medical
                            </Badge>
                          )}
                          {apt.has_matting && (
                            <Badge variant="outline" className="text-xs">
                              Matting
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {apt.status === 'confirmed' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => navigate(`/grooming/check-in/${apt.id}`)}
                            >
                              Check In
                            </Button>
                          )}
                          {canCancel && ['requested', 'confirmed'].includes(apt.status) && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleCancelClick(apt)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the appointment for {appointmentToCancel?.pet_name}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">Cancellation Reason</label>
            <Input
              placeholder="Enter reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Appointment
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
