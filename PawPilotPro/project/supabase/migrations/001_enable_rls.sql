-- Enable Row Level Security on all public tables
-- The app uses Edge Functions with service_role key which bypasses RLS,
-- so this locks down direct PostgREST API access without affecting app functionality.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daycare_bookings ENABLE ROW LEVEL SECURITY;

-- Households: users can only access their own tenant's data
CREATE POLICY "tenant_isolation" ON public.households
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    OR tenant_id = auth.uid()::text
  );

-- Contacts: users can only access their own tenant's data
CREATE POLICY "tenant_isolation" ON public.contacts
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    OR tenant_id = auth.uid()::text
  );

-- Pets: users can only access their own tenant's data
CREATE POLICY "tenant_isolation" ON public.pets
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    OR tenant_id = auth.uid()::text
  );

-- Daycare bookings: users can only access their own tenant's data
CREATE POLICY "tenant_isolation" ON public.daycare_bookings
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    OR tenant_id = auth.uid()::text
  );

-- Users table: each user can only see their own record
CREATE POLICY "own_record_only" ON public.users
  FOR ALL
  TO authenticated
  USING (id = auth.uid());
