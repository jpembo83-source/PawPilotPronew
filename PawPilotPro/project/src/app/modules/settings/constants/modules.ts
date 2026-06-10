import { Dog, Scissors, ShoppingBag, Gauge, UsersThree, ChatTeardrop, Receipt, Warning, CalendarCheck, Car, Moon, FileText, UserGear, Package, ChartBar, Tray } from '@phosphor-icons/react';

export interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: any;
  isCore?: boolean; // If true, cannot be disabled
  navItems: {
    label: string;
    path: string;
    icon: any;
  }[];
}

export const MODULES: ModuleDefinition[] = [
  // Core Platform Modules (Always Enabled)
  {
    id: 'core',
    label: 'Core Platform',
    description: 'Essential operating system functions.',
    icon: Gauge,
    isCore: true,
    navItems: [
      { label: 'Dashboard', path: '/', icon: Gauge },
      // Portal Inbox sits adjacent to Capacity in the sidebar so when staff
      // sees a pending booking they can flip straight to "what's the day's
      // capacity look like?" — and vice versa.
      { label: 'Portal Inbox', path: '/customers/pending-requests', icon: Tray },
      { label: 'Capacity', path: '/capacity', icon: Gauge },
      { label: 'Customers', path: '/customers', icon: UsersThree },
      { label: 'Messages', path: '/messages', icon: ChatTeardrop },
      { label: 'Billing', path: '/billing', icon: Receipt },
      { label: 'Policies', path: '/policies', icon: FileText },
      { label: 'Staff', path: '/staff', icon: UserGear },
      { label: 'Incidents', path: '/incidents', icon: Warning },
      { label: 'Reports', path: '/reports', icon: ChartBar },
    ]
  },
  // Optional Modules
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
    id: 'boutique',
    label: 'Boutique',
    description: 'Retail point-of-sale, inventory, and product management.',
    icon: ShoppingBag,
    navItems: [
      { label: 'Boutique', path: '/boutique', icon: ShoppingBag },
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
  },
  {
    id: 'packages',
    label: 'Packages & Memberships',
    description: 'Credit packs, unlimited plans, and subscription memberships.',
    icon: Package,
    navItems: [
      { label: 'Packages', path: '/packages', icon: Package },
    ]
  }
];