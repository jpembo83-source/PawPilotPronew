import { Dog, Scissors, LayoutDashboard, Users, MessageSquare, Receipt, AlertTriangle, Car, Moon, BarChart3, CalendarDays } from 'lucide-react';

export interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: any;
  isCore?: boolean;
  navItems: {
    label: string;
    path: string;
    icon: any;
  }[];
}

export const MODULES: ModuleDefinition[] = [
  {
    id: 'core',
    label: 'Core Platform',
    description: 'Essential operating system functions.',
    icon: LayoutDashboard,
    isCore: true,
    navItems: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Calendar', path: '/calendar', icon: CalendarDays },
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Messages', path: '/messages', icon: MessageSquare },
      { label: 'Billing', path: '/billing', icon: Receipt },
      { label: 'Reports', path: '/reports', icon: BarChart3 },
      { label: 'Incidents', path: '/incidents', icon: AlertTriangle },
    ]
  },
  {
    id: 'daycare',
    label: 'Daycare',
    description: 'Daycare booking, capacity management, and attendance tracking.',
    icon: Dog,
    navItems: [
      { label: 'Daycare', path: '/daycare', icon: Dog },
    ]
  },
  {
    id: 'grooming',
    label: 'Grooming',
    description: 'Salon appointments, groomer calendars, and service menus.',
    icon: Scissors,
    navItems: [
      { label: 'Grooming', path: '/grooming', icon: Scissors },
    ]
  },
  {
    id: 'transport',
    label: 'Transportation',
    description: 'Vehicle management, route planning, and driver assignments.',
    icon: Car,
    navItems: [
      { label: 'Transport', path: '/transport', icon: Car },
    ]
  },
  {
    id: 'overnights',
    label: 'Overnights',
    description: 'Overnight boarding, care logs, capacity management, and shift handovers.',
    icon: Moon,
    navItems: [
      { label: 'Overnights', path: '/overnights', icon: Moon },
    ]
  }
];
