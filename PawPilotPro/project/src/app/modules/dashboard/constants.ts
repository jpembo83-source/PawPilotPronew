import { 
  Users, 
  AlertTriangle, 
  FileText, 
  Truck,
  Dog,
  BarChart3,
  Scissors,
  Moon,
  Syringe,
  Gauge,
  TrendingUp
} from 'lucide-react';

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  icon: any;
  defaultSize: 'small' | 'medium' | 'large';
  colSpan: 1 | 2;
  rowSpan: 1 | 2;
  category: 'operational' | 'financial' | 'risk' | 'staff';
  isBeta?: boolean;
}

export const WIDGETS: WidgetDefinition[] = [
  {
    id: 'todays_dogs',
    title: 'Today\'s Dogs',
    description: 'Dogs currently on site with quick checkout',
    icon: Dog,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 1,
    category: 'operational'
  },
  {
    id: 'weekly_activity',
    title: 'Weekly Activity',
    description: 'Booking activity across the week',
    icon: BarChart3,
    defaultSize: 'medium',
    colSpan: 2,
    rowSpan: 1,
    category: 'operational'
  },
  {
    id: 'todays_daycare_dogs',
    title: 'Today\'s Daycare Dogs',
    description: 'Full check-in/out management with search and filters',
    icon: Dog,
    defaultSize: 'large',
    colSpan: 2,
    rowSpan: 2,
    category: 'operational'
  },
  {
    id: 'occupancy',
    title: 'Live Occupancy',
    description: 'Real-time capacity and check-ins',
    icon: Users,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 2,
    category: 'operational'
  },
  {
    id: 'documents',
    title: 'Alerts & Flags',
    description: 'Vaccination, waiver, and behaviour alerts',
    icon: FileText,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 1,
    category: 'risk'
  },
  {
    id: 'driver_status',
    title: 'Transport',
    description: 'Today\'s transport jobs and assignments',
    icon: Truck,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 1,
    category: 'operational'
  },
  {
    id: 'grooming_today',
    title: 'Today\'s Grooming',
    description: 'Grooming appointments scheduled today',
    icon: Scissors,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 1,
    category: 'operational'
  },
  {
    id: 'overnights_today',
    title: 'Overnight Guests',
    description: 'Current and expected overnight boarders',
    icon: Moon,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 2,
    category: 'operational'
  },
  {
    id: 'vaccination_alerts',
    title: 'Vaccination Alerts',
    description: 'Dogs with vaccines expiring or expired',
    icon: Syringe,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 1,
    category: 'risk'
  },
  {
    id: 'capacity',
    title: 'Daily Capacity',
    description: 'Available spots and overbooking protection',
    icon: Gauge,
    defaultSize: 'small',
    colSpan: 1,
    rowSpan: 1,
    category: 'operational'
  },
  {
    id: 'reporting',
    title: 'Quick Stats',
    description: 'Daily revenue, trends, and busiest days',
    icon: TrendingUp,
    defaultSize: 'medium',
    colSpan: 1,
    rowSpan: 1,
    category: 'financial'
  }
];

export const DEFAULT_WIDGETS_BY_ROLE: Record<string, string[]> = {
  admin: WIDGETS.map(w => w.id),
  manager: ['todays_dogs', 'weekly_activity', 'todays_daycare_dogs', 'occupancy', 'documents', 'driver_status', 'grooming_today', 'overnights_today', 'vaccination_alerts', 'capacity', 'reporting'],
  staff: ['todays_dogs', 'weekly_activity', 'occupancy', 'documents', 'driver_status', 'grooming_today', 'overnights_today', 'capacity']
};
