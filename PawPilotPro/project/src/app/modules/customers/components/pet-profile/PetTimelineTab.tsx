import React, { useEffect, useState } from 'react';
import { Pet, TimelineItem, NoteCategory, FlagKey, FlagSeverity } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { 
  CalendarBlank,
  FileText,
  Dog,
  User,
  Flag as FlagIcon,
  Heart,
  MapPin,
  CalendarBlank as CalendarIcon,
  Scissors,
  House,
  Truck,
  Warning,
  PencilSimple,
  Plus,
  CheckCircle,
  XCircle,
  CircleNotch,
  Note,
  PushPin,
  Eye,
  EyeSlash,
  Info,
  ShieldWarning,
  ArrowClockwise
} from '@phosphor-icons/react';
import { useCustomerStore } from '../../store';

interface PetTimelineTabProps {
  pet: Pet;
}

// Helper to get icon for activity type
const getActivityIcon = (activityType: string) => {
  switch (activityType) {
    case 'pet_created':
    case 'pet_added':
      return Dog;
    case 'pet_updated':
    case 'pet_modified':
      return PencilSimple;
    case 'medical_note':
      return FileText;
    case 'document_added':
    case 'document_uploaded':
      return FileText;
    case 'flag_added':
    case 'flag_updated':
    case 'flag_removed':
      return FlagIcon;
    case 'contact_added':
    case 'contact_updated':
      return User;
    case 'daycare_booking':
    case 'daycare_checkin':
    case 'daycare_checkout':
      return Heart;
    case 'grooming_booking':
    case 'grooming_appointment':
      return Scissors;
    case 'overnight_booking':
    case 'overnight_checkin':
    case 'overnight_checkout':
      return House;
    case 'transport_booking':
    case 'transport_pickup':
    case 'transport_dropoff':
      return Truck;
    case 'incident_created':
    case 'incident_reported':
      return Warning;
    case 'household_created':
    case 'household_updated':
      return MapPin;
    default:
      return CalendarIcon;
  }
};

// Helper to get color class for activity type
const getActivityColor = (activityType: string) => {
  if (activityType.includes('incident') || activityType.includes('flag')) {
    return 'text-red-600';
  } else if (activityType.includes('medical')) {
    return 'text-blue-600';
  } else if (activityType.includes('booking') || activityType.includes('checkin')) {
    return 'text-green-600';
  } else if (activityType.includes('document') || activityType.includes('updated')) {
    return 'text-purple-600';
  } else if (activityType.includes('created') || activityType.includes('added')) {
    return 'text-teal-600';
  } else {
    return 'text-slate-600';
  }
};

// Helper to get note category colors
const getNoteCategoryColor = (category: NoteCategory) => {
  switch (category) {
    case 'behaviour':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medical':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'billing':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'transport':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'grooming':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'overnight':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

// Helper to get flag colors based on severity
const getFlagSeverityColor = (severity: FlagSeverity) => {
  switch (severity) {
    case 'block':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'warn':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'info':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

// Helper to get flag severity icon
const getFlagSeverityIcon = (severity: FlagSeverity) => {
  switch (severity) {
    case 'block':
      return ShieldWarning;
    case 'warn':
      return Warning;
    case 'info':
      return Info;
    default:
      return FlagIcon;
  }
};

// Helper to format flag key as readable text
const formatFlagKey = (flagKey: FlagKey) => {
  return flagKey.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Helper to format date as "Today", "Yesterday", or formatted date
const formatDateHeader = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Group events by date
const groupEventsByDate = (items: TimelineItem[]) => {
  const grouped: Record<string, TimelineItem[]> = {};
  
  items.forEach(item => {
    const date = new Date(item.timeline_date).toDateString();
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(item);
  });
  
  return grouped;
};

export function PetTimelineTab({ pet }: PetTimelineTabProps) {
  const { fetchPetTimeline } = useCustomerStore();
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadTimeline = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const timeline = await fetchPetTimeline(pet.id);
      setTimelineItems(timeline);
    } catch (err: any) {
      console.error('Failed to load pet timeline:', err);
      setError(err.message || 'Failed to load timeline');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTimeline();
  };
  
  useEffect(() => {
    loadTimeline();
  }, [pet.id, fetchPetTimeline]);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pulse Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CircleNotch className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500">Loading timeline...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pulse Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-red-500">
            <XCircle className="h-12 w-12 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const groupedByDate = groupEventsByDate(timelineItems);
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pulse Timeline</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <ArrowClockwise className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {timelineItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CalendarBlank className="h-12 w-12 mx-auto mb-2 text-slate-300" />
            <p>No activity recorded yet</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedDates.map(date => {
              const dateItems = groupedByDate[date];
              const firstItem = dateItems[0];
              
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-slate-200" />
                    <p className="text-sm font-medium text-slate-600">
                      {formatDateHeader(firstItem.timeline_date)}
                    </p>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  
                  <div className="space-y-4">
                    {dateItems.map((item) => {
                      // Render based on timeline type
                      if (item.timeline_type === 'activity') {
                        const Icon = getActivityIcon(item.activity_type);
                        const colorClass = getActivityColor(item.activity_type);
                        
                        return (
                          <div
                            key={item.id}
                            className="flex gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <div className={`mt-1 ${colorClass}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-1">
                                <div>
                                  <h4 className="font-medium">{item.title}</h4>
                                  <p className="text-sm text-slate-600">
                                    {new Date(item.occurred_at).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="capitalize">
                                  {item.activity_type.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              
                              {item.description && (
                                <p className="text-sm text-slate-700 mt-2">{item.description}</p>
                              )}
                              
                              {item.metadata && Object.keys(item.metadata).length > 0 && (
                                <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-600">
                                  {Object.entries(item.metadata).map(([key, value]) => (
                                    <div key={key} className="flex gap-2">
                                      <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                                      <span>{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {item.created_by_name && (
                                <p className="text-xs text-slate-400 mt-2">
                                  Recorded by {item.created_by_name}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      } else if (item.timeline_type === 'note') {
                        return (
                          <div
                            key={item.id}
                            className="flex gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <div className="mt-1 text-slate-600">
                              <Note className="h-5 w-5" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {item.title && <h4 className="font-medium">{item.title}</h4>}
                                  {item.is_pinned && (
                                    <PushPin className="h-4 w-4 text-amber-600" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getNoteCategoryColor(item.category)}>
                                    {item.category}
                                  </Badge>
                                  {item.visibility === 'customer' ? (
                                    <Eye className="h-4 w-4 text-slate-400" title="Visible to customer" />
                                  ) : (
                                    <EyeSlash className="h-4 w-4 text-slate-400" title="Internal only" />
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.content}</p>
                              
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                <span>
                                  {new Date(item.created_at).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {item.created_by_name && (
                                  <span>by {item.created_by_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      } else if (item.timeline_type === 'flag') {
                        const SeverityIcon = getFlagSeverityIcon(item.severity);
                        const colorClass = getFlagSeverityColor(item.severity);
                        
                        return (
                          <div
                            key={item.id}
                            className={`flex gap-4 p-4 border rounded-lg ${colorClass} transition-colors`}
                          >
                            <div className="mt-1">
                              <SeverityIcon className="h-5 w-5" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-1">
                                <div>
                                  <h4 className="font-medium">{formatFlagKey(item.flag_key)}</h4>
                                  <p className="text-sm opacity-75">
                                    {new Date(item.created_at).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.is_active ? 'default' : 'secondary'}>
                                    {item.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                  <Badge variant="outline" className="capitalize">
                                    {item.severity}
                                  </Badge>
                                </div>
                              </div>
                              
                              {item.reason && (
                                <p className="text-sm mt-2 opacity-90">{item.reason}</p>
                              )}
                              
                              {item.created_by_name && (
                                <p className="text-xs opacity-60 mt-2">
                                  Added by {item.created_by_name}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}