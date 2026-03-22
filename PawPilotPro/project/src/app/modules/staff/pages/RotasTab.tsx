// Rotas Tab
// Shift planning and staff rotas management

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Calendar, Plus, Loader2, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useStaffStore } from '../store';

export function RotasTab() {
  const navigate = useNavigate();
  const { rotas, isLoading, fetchRotas, createRota } = useStaffStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    location_id: 'loc_main',
    start_date: '',
    end_date: '',
  });
  
  useEffect(() => {
    fetchRotas();
  }, []);
  
  // Set default dates (current week)
  useEffect(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1); // Next Monday
    if (monday < today) {
      monday.setDate(monday.getDate() + 7);
    }
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    setCreateForm({
      location_id: 'loc_main',
      start_date: monday.toISOString().split('T')[0],
      end_date: sunday.toISOString().split('T')[0],
    });
  }, []);
  
  const handleCreateRota = async () => {
    if (!createForm.start_date || !createForm.end_date) {
      toast.error('Please select start and end dates');
      return;
    }
    
    try {
      const rota = await createRota(createForm);
      toast.success('Rota created successfully');
      setCreateDialogOpen(false);
      navigate(`/staff/rota/${rota.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create rota');
    }
  };
  
  const getDateRange = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`;
    } catch {
      return `${startDate} - ${endDate}`;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Rotas</h2>
          <p className="text-sm text-slate-600 mt-1">
            Create and manage staff schedules
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Rota
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Rota</DialogTitle>
              <DialogDescription>
                Create a new rota for your staff.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <select
                  id="location"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={createForm.location_id}
                  onChange={(e) => setCreateForm({ ...createForm, location_id: e.target.value })}
                >
                  <option value="loc_main">Main Facility</option>
                  <option value="loc_north">North Branch</option>
                  <option value="loc_south">South Branch</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={createForm.start_date}
                  onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={createForm.end_date}
                  onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> Rotas are typically created for one week at a time.
                  You can add shifts after creation.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRota} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Rota'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-slate-900">{rotas.length}</div>
            <div className="text-sm text-slate-600">Total Rotas</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-green-600">
              {rotas.filter(r => r.status === 'published').length}
            </div>
            <div className="text-sm text-slate-600">Published</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-amber-600">
              {rotas.filter(r => r.status === 'draft').length}
            </div>
            <div className="text-sm text-slate-600">Drafts</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Rota List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : rotas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">No rotas yet</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Rota
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rotas.map((rota) => (
            <Card
              key={rota.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/staff/rota/${rota.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Calendar className="h-8 w-8 text-blue-600" />
                    
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {getDateRange(rota.start_date, rota.end_date)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-600">
                          {rota.location_id === 'loc_main' ? 'Main Facility' :
                           rota.location_id === 'loc_north' ? 'North Branch' :
                           rota.location_id === 'loc_south' ? 'South Branch' :
                           rota.location_id}
                        </span>
                        {rota.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="h-3 w-3" />
                            Draft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900">
                      {rota.shifts_count || 0} shifts
                    </div>
                    <div className="text-xs text-slate-500">
                      {rota.staff_count || 0} staff
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