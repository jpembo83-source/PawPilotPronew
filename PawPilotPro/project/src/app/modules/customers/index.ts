// Customer Management Module - MDC Operations Centre
// Central exports for customer management

export { CustomersPage } from './pages/CustomersPage';
export { CreateHouseholdPage } from './pages/CreateHouseholdPage';
export { HouseholdDetailPage } from './pages/HouseholdDetailPage';
export { PetProfilePage } from './pages/PetProfilePage';
export { BulkImportPage } from './pages/BulkImportPage';
export { ExportPage } from './pages/ExportPage';
export { ClearDataPage } from './pages/ClearDataPage';
export { VaxReviewPage } from './pages/VaxReviewPage';
export { PendingRequestsPage } from './pages/PendingRequestsPage';

export { useCustomerStore } from './store';
export type {
  Household,
  HouseholdContact,
  Pet,
  PetDocument,
  ActivityEvent,
  CustomerFilters,
  DocumentAlert,
} from './types';