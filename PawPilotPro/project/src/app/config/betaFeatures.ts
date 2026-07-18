// Beta Features Configuration
// Controls which features are visible only to beta testers

// Beta tester emails - only these users can see beta features
export const BETA_TESTER_EMAILS = [
  'jason.pemberton@me.com',
  'jason@pawpilotpro.com',
  // Add more beta testers here
];

// Beta modules - these are hidden from non-beta users
// Staff Management and Policies are NOT beta: rotas and policy
// acknowledgements are live features, and access is governed by RBAC
// (staff roles have no staff-module permissions; managers do).
export const BETA_MODULES = [
  'billing',      // Billing module (in core navItems)
  'messaging',    // Messages module (in core navItems)
  'grooming',     // Grooming module
  'packages',     // Packages & Memberships module
];

// Beta nav paths - specific paths to hide for non-beta users
export const BETA_NAV_PATHS = [
  '/billing',
  '/messages',
  '/grooming',
  '/packages',
];

// Check if a user is a beta tester
export function isBetaTester(email: string | undefined | null): boolean {
  if (!email) return false;
  return BETA_TESTER_EMAILS.some(
    betaEmail => betaEmail.toLowerCase() === email.toLowerCase()
  );
}

// Check if a nav path is beta-only
export function isBetaPath(path: string): boolean {
  return BETA_NAV_PATHS.some(betaPath => 
    path === betaPath || path.startsWith(betaPath + '/')
  );
}

// Check if a module ID is beta-only
export function isBetaModule(moduleId: string): boolean {
  return BETA_MODULES.includes(moduleId);
}
