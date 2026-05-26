export interface Customer {
  id: string;
  tenantId: string;
  householdName: string;
  primaryContactName: string;
  primaryEmail: string;
  primaryPhone: string;
  petIds: string[];
}
