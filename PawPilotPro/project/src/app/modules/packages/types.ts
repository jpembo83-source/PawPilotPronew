// Packages & Memberships Types
// "10 daycare days for £X" or "unlimited monthly"

export interface Package {
  id: string;
  name: string;
  description?: string;
  type: 'credits' | 'unlimited' | 'subscription';
  service_type: 'daycare' | 'grooming' | 'overnight' | 'all';
  
  // For credit-based packages
  credits?: number;
  
  // Pricing
  price: number;
  currency: string;
  
  // Validity
  validity_days?: number; // How long credits last
  billing_period?: 'monthly' | 'quarterly' | 'yearly'; // For subscriptions
  
  // Restrictions
  location_ids?: string[]; // Specific locations only
  max_uses_per_day?: number;
  blackout_dates?: string[];
  
  // Status
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerPackage {
  id: string;
  customer_id: string;
  package_id: string;
  package_name: string;
  package_type: Package['type'];
  /** Session length the plan covered at assignment time (server snapshot).
   *  Older records may lack it; readers fall back to a catalogue lookup. */
  session_type?: 'full_day' | 'half_day';
  
  // Credits tracking
  credits_total?: number;
  credits_used?: number;
  credits_remaining?: number;
  
  // Validity
  purchase_date: string;
  expiry_date?: string;
  
  // Subscription details
  is_subscription?: boolean;
  subscription_status?: 'active' | 'paused' | 'cancelled' | 'expired';
  next_billing_date?: string;
  
  // Status
  status: 'active' | 'expired' | 'exhausted' | 'cancelled';
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface PackageUsage {
  id: string;
  customer_package_id: string;
  booking_id?: string;
  pet_id: string;
  pet_name: string;
  service_date: string;
  credits_used: number;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface PackageStats {
  total_packages: number;
  active_packages: number;
  credits_sold: number;
  credits_used: number;
  revenue_this_month: number;
  expiring_soon: number; // Within 7 days
}
