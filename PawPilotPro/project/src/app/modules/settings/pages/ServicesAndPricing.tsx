import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { ServiceCatalogue } from '../components/pricing/ServiceCatalogue';
import { PriceBooks } from '../components/pricing/PriceBooks';
import { MembershipsAndPackages } from '../components/pricing/MembershipsAndPackages';
import { PricingAuditLog } from '../components/pricing/PricingAuditLog';
import { usePricingStore } from '../../pricing/store';
import { toast } from 'sonner';

export function ServicesAndPricing() {
  const [activeTab, setActiveTab] = useState('services');
  const { fetchServices, fetchPriceBooks, fetchMemberships, fetchPackages } = usePricingStore();

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      try {
        await Promise.all([
          fetchServices(),
          fetchPriceBooks(),
          fetchMemberships(),
          fetchPackages(),
        ]);
      } catch (e) {
        console.error('Failed to load pricing data:', e);
        toast.error('Failed to load pricing data');
      }
    };
    
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="mb-2">Services & Pricing</h1>
          <p className="text-muted-foreground">
            Manage service definitions, pricing, memberships, and packages across all modules.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services">Service Catalogue</TabsTrigger>
          <TabsTrigger value="pricing">Price Books</TabsTrigger>
          <TabsTrigger value="commercial">Memberships & Packages</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4 mt-6">
          <ServiceCatalogue />
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4 mt-6">
          <PriceBooks />
        </TabsContent>

        <TabsContent value="commercial" className="space-y-4 mt-6">
          <MembershipsAndPackages />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-6">
          <PricingAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}