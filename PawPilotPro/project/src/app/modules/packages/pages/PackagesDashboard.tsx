// Packages Dashboard - Overview of packages and memberships
// "10 daycare days for £X" or "unlimited monthly"

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePackagesStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { 
  Package, 
  Plus, 
  CreditCard, 
  Infinity,
  Calendar,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

export function PackagesDashboard() {
  const navigate = useNavigate();
  const { organisation } = useSettingsStore();
  const { 
    packages, 
    customerPackages,
    stats, 
    isLoading, 
    error, 
    fetchPackages, 
    fetchCustomerPackages,
    fetchStats, 
    clearError 
  } = usePackagesStore();
  
  // Use organisation currency, fallback to GBP
  const currency = organisation.currency || 'GBP';

  useEffect(() => {
    fetchPackages();
    fetchCustomerPackages();
    fetchStats();
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);

  const getPackageTypeIcon = (type: string) => {
    switch (type) {
      case 'credits':
        return <CreditCard className="h-4 w-4" />;
      case 'unlimited':
        return <Infinity className="h-4 w-4" />;
      case 'subscription':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getPackageTypeBadge = (type: string) => {
    switch (type) {
      case 'credits':
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Credits</Badge>;
      case 'unlimited':
        return <Badge variant="outline" className="text-purple-600 border-purple-300">Unlimited</Badge>;
      case 'subscription':
        return <Badge variant="outline" className="text-green-600 border-green-300">Subscription</Badge>;
      default:
        return <Badge variant="outline">Package</Badge>;
    }
  };

  const formatCurrency = (amount: number, currencyOverride?: string) => {
    const curr = currencyOverride || currency;
    // Use appropriate locale based on currency
    const locale = curr === 'GBP' ? 'en-GB' : curr === 'USD' ? 'en-US' : curr === 'EUR' ? 'de-DE' : 'en-GB';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: curr }).format(amount);
  };

  if (isLoading && packages.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Packages & Memberships</h1>
          <p className="text-slate-600 mt-1">Manage daycare packages and customer memberships</p>
        </div>
        <Button onClick={() => navigate('/packages/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Package
        </Button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Active Customer Packages
              </CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{stats.active_packages}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Credits Remaining
              </CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">
                {stats.credits_sold - stats.credits_used}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-slate-500">
                {stats.credits_used} used of {stats.credits_sold} sold
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Revenue This Month
              </CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">
                {formatCurrency(stats.revenue_this_month)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card className={stats.expiring_soon > 0 ? 'border-orange-200 bg-orange-50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className={`flex items-center gap-2 ${stats.expiring_soon > 0 ? 'text-orange-700' : ''}`}>
                <AlertTriangle className="h-4 w-4" />
                Expiring Soon
              </CardDescription>
              <CardTitle className={`text-2xl sm:text-3xl ${stats.expiring_soon > 0 ? 'text-orange-700' : ''}`}>
                {stats.expiring_soon}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-slate-500">Within 7 days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Package Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Package Templates
          </CardTitle>
          <CardDescription>Available packages customers can purchase</CardDescription>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-600">No packages yet</p>
              <p className="text-sm text-slate-500 mt-1">Create your first package template</p>
              <Button className="mt-4" onClick={() => navigate('/packages/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Package
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map(pkg => (
                <div
                  key={pkg.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/packages/${pkg.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getPackageTypeIcon(pkg.type)}
                      <h3 className="font-semibold">{pkg.name}</h3>
                    </div>
                    {getPackageTypeBadge(pkg.type)}
                  </div>
                  
                  {pkg.description && (
                    <p className="text-sm text-slate-600 mb-3">{pkg.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-slate-900">
                        {formatCurrency(pkg.price, pkg.currency)}
                      </span>
                      {pkg.type === 'credits' && (
                        <span className="text-sm text-slate-500 ml-1">
                          / {pkg.credits} credits
                        </span>
                      )}
                      {pkg.billing_period && (
                        <span className="text-sm text-slate-500 ml-1">
                          / {pkg.billing_period}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                  
                  {pkg.validity_days && (
                    <p className="text-xs text-slate-500 mt-2">
                      Valid for {pkg.validity_days} days
                    </p>
                  )}
                  
                  {!pkg.is_active && (
                    <Badge variant="secondary" className="mt-2">Inactive</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Customer Packages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Customer Packages
              </CardTitle>
              <CardDescription>Packages currently held by customers</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/packages/customers')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customerPackages.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-600">No active packages</p>
              <p className="text-sm text-slate-500 mt-1">Customer packages will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium text-slate-600">Package</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-600">Type</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-600">Credits</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-600">Expires</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPackages.slice(0, 5).map(cp => (
                    <tr key={cp.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{cp.package_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        {getPackageTypeBadge(cp.package_type)}
                      </td>
                      <td className="py-3 px-4">
                        {cp.credits_remaining !== undefined ? (
                          <span>
                            <strong>{cp.credits_remaining}</strong>
                            <span className="text-slate-500">/{cp.credits_total}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {cp.expiry_date ? (
                          <span className={
                            new Date(cp.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                              ? 'text-orange-600'
                              : ''
                          }>
                            {new Date(cp.expiry_date).toLocaleDateString('en-GB')}
                          </span>
                        ) : (
                          <span className="text-slate-500">No expiry</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={cp.status === 'active' ? 'default' : 'secondary'}
                          className={cp.status === 'active' ? 'bg-green-500' : ''}
                        >
                          {cp.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
