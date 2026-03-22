# Paw Pilot Pro: Single-Tenant SaaS Architecture

**Version:** 1.0  
**Date:** 2026-02-07  
**Status:** Proposal

---

## Executive Summary

This document proposes a **single-tenant-per-customer deployment model** for Paw Pilot Pro. Each customer receives fully isolated infrastructure while maintaining operational efficiency through automation.

**Key decisions:**
- Supabase project per customer (complete isolation)
- Single shared frontend with subdomain-based config loading
- Containerized backend per customer on Railway/Fly.io
- Wildcard DNS + automatic TLS via Cloudflare
- Terraform + CLI for provisioning automation
- Lightweight control plane in a dedicated "platform" Supabase project

---

## A) Recommended Architecture

### High-Level Architecture Diagram (Text)

```
                                    ┌─────────────────────────────────────────────────┐
                                    │            CLOUDFLARE (DNS + TLS + CDN)         │
                                    │  *.pawpilotpro.com → Wildcard Certificate       │
                                    └─────────────────┬───────────────────────────────┘
                                                      │
                              ┌───────────────────────┼───────────────────────┐
                              │                       │                       │
                              ▼                       ▼                       ▼
                    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                    │ mdc.pawpilot... │     │ acme.pawpilot...│     │ demo.pawpilot...│
                    └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                             │                       │                       │
                             ▼                       ▼                       ▼
              ┌──────────────────────────────────────────────────────────────────────────┐
              │                     SHARED FRONTEND (Vercel/Cloudflare Pages)            │
              │                                                                          │
              │   Static React app deployed once, reads subdomain at runtime             │
              │   Fetches customer config from Control Plane API                         │
              └──────────────────────────────────────────────────────────────────────────┘
                             │                       │                       │
                             │ API calls include     │                       │
                             │ X-Customer-Slug       │                       │
                             ▼                       ▼                       ▼
              ┌──────────────────────────────────────────────────────────────────────────┐
              │                        API GATEWAY / ROUTER                              │
              │              (Cloudflare Workers or simple path-based routing)           │
              │                                                                          │
              │   Routes requests to correct customer backend based on subdomain         │
              └──────────────────────────────────────────────────────────────────────────┘
                             │                       │                       │
                             ▼                       ▼                       ▼
                    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                    │  MDC Backend    │     │  ACME Backend   │     │  Demo Backend   │
                    │  (Supabase      │     │  (Supabase      │     │  (Supabase      │
                    │   Edge Func)    │     │   Edge Func)    │     │   Edge Func)    │
                    └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                             │                       │                       │
                             ▼                       ▼                       ▼
                    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                    │  MDC Supabase   │     │  ACME Supabase  │     │  Demo Supabase  │
                    │  Project        │     │  Project        │     │  Project        │
                    │  ─────────────  │     │  ─────────────  │     │  ─────────────  │
                    │  • Database     │     │  • Database     │     │  • Database     │
                    │  • Auth         │     │  • Auth         │     │  • Auth         │
                    │  • Storage      │     │  • Storage      │     │  • Storage      │
                    │  • Edge Funcs   │     │  • Edge Funcs   │     │  • Edge Funcs   │
                    └─────────────────┘     └─────────────────┘     └─────────────────┘

                                                  │
                                                  │ Platform operations only
                                                  ▼
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                    CONTROL PLANE                                │
                    │                (platform.pawpilotpro.com)                       │
                    │  ─────────────────────────────────────────────────────────────  │
                    │  • Customer Registry (slug, status, version, plan)              │
                    │  • Provisioning API (trigger new customer setup)                │
                    │  • Health Dashboard (status of all instances)                   │
                    │  • Billing Integration (Stripe metadata)                        │
                    │  • Audit Logs (provisioning, access)                            │
                    │                                                                 │
                    │  Hosted on: Separate Supabase project "paw-pilot-platform"      │
                    │  Access: Platform staff only (SSO + MFA required)               │
                    └─────────────────────────────────────────────────────────────────┘
```

---

### Component Decisions

#### 1. DNS + TLS + Routing

**Recommendation: Cloudflare**

| Component | Solution | Rationale |
|-----------|----------|-----------|
| DNS | Cloudflare | Wildcard DNS (`*.pawpilotpro.com`), API for automation |
| TLS | Cloudflare Universal SSL | Automatic wildcard cert, no per-customer cert management |
| CDN | Cloudflare | Cache static assets, DDoS protection |
| Routing | Cloudflare Workers (optional) | Subdomain → backend mapping |

**How it works:**
1. Single wildcard DNS record: `*.pawpilotpro.com → [Load Balancer/Vercel]`
2. Cloudflare provides automatic TLS for all subdomains
3. Frontend extracts subdomain, fetches customer config, routes API calls

**Vanity domains (future):**
- Customer adds CNAME: `portal.mydogcompany.com → mdc.pawpilotpro.com`
- Cloudflare for SaaS handles TLS for custom domains

---

#### 2. Frontend Deployment

**Recommendation: Single shared frontend on Vercel**

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND STRATEGY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Deploy: ONE static React build to Vercel                       │
│  Domain: *.pawpilotpro.com (wildcard)                          │
│                                                                 │
│  Runtime behavior:                                              │
│  1. Extract subdomain from window.location.hostname             │
│  2. Fetch /api/customer-config?slug={subdomain}                 │
│  3. Receive: { supabaseUrl, supabaseAnonKey, branding }        │
│  4. Initialize Supabase client with customer-specific creds     │
│  5. Render app with customer branding                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why single frontend:**
- One deployment to update all customers
- Consistent versions across all customers
- Simple CI/CD (deploy once)
- Customer config loaded at runtime

**Frontend code changes required:**

```typescript
// src/utils/customerConfig.ts
export interface CustomerConfig {
  slug: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  branding: {
    logoUrl: string;
    primaryColor: string;
    orgName: string;
  };
}

let cachedConfig: CustomerConfig | null = null;

export async function getCustomerConfig(): Promise<CustomerConfig> {
  if (cachedConfig) return cachedConfig;
  
  const hostname = window.location.hostname;
  const slug = hostname.split('.')[0]; // mdc.pawpilotpro.com → mdc
  
  // Fetch from control plane (public endpoint, rate-limited)
  const res = await fetch(`https://platform.pawpilotpro.com/api/customer-config/${slug}`);
  if (!res.ok) throw new Error('Invalid customer');
  
  cachedConfig = await res.json();
  return cachedConfig;
}
```

---

#### 3. Backend Deployment

**Recommendation: Supabase Edge Functions per customer (inside their Supabase project)**

Each customer's Supabase project contains:
- Their database
- Their Auth instance
- Their Storage buckets
- Their Edge Functions (the backend code)

**Why this approach:**
- Complete isolation (no shared compute)
- Edge Functions have direct access to that customer's database
- No routing complexity (each project has its own URL)
- Supabase handles scaling

**Backend URL pattern:**
```
https://{customer-project-ref}.supabase.co/functions/v1/api
```

The frontend knows which Supabase project to call from the customer config.

---

#### 4. Database Approach

**Recommendation: One Supabase project per customer**

| Aspect | Approach |
|--------|----------|
| Isolation | Complete - separate Postgres instance |
| RLS | Optional but recommended for defense-in-depth |
| Migrations | Applied per-project via CLI automation |
| Backups | Supabase automatic daily backups (Pro plan) |
| Storage | Dedicated buckets per project |
| Auth | Per-customer Auth instance (isolated user pools) |

**Why Supabase per customer (not shared Postgres with separate DBs):**
- Simpler isolation model
- Each customer gets their own Auth, Storage, Realtime
- Supabase CLI supports project-level operations
- No shared connection pool concerns
- Clear billing per customer

**Migration strategy:**
```bash
# migrations/ folder in repo (shared)
# Applied to each customer project on deploy

supabase db push --project-ref {customer-project-ref}
```

---

#### 5. Secret Management

**Recommendation: Environment variables per deployment + Supabase Vault**

| Secret Type | Storage Location |
|-------------|------------------|
| Supabase project URLs | Control Plane registry |
| Supabase service keys | Supabase Vault (per project) |
| Third-party API keys | Supabase Vault (per project) |
| Platform secrets | Separate secure store (1Password/Vault) |

**Per-customer secrets (stored in their Supabase project):**
- `STRIPE_SECRET_KEY` (if they have their own Stripe account)
- `TWILIO_API_KEY` (if they have their own SMS)
- Any customer-specific integrations

**Shared secrets (platform level):**
- Cloudflare API token
- Supabase Management API token
- Platform database credentials

---

#### 6. Auth Model

**Recommendation: Per-customer Auth (isolated user pools)**

Each Supabase project has its own Auth instance:
- Users are scoped to that customer
- No risk of email collision across customers
- Customer controls their own auth settings
- SSO configuration per customer (future)

**Login flow:**
1. User visits `mdc.pawpilotpro.com/login`
2. Frontend fetches customer config (includes Supabase URL)
3. Frontend initializes Supabase client with that customer's project
4. Auth happens against that customer's Auth instance
5. JWT is scoped to that customer's project

---

## B) Deployment Strategy

### CI/CD Pipeline Design

```
┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER: Push to main branch                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. BUILD & TEST                                         │   │
│  │    • npm install && npm run build                       │   │
│  │    • npm run test                                       │   │
│  │    • npm run lint                                       │   │
│  │    • Build frontend bundle                              │   │
│  │    • Build Edge Function bundle                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2. DEPLOY FRONTEND (once)                               │   │
│  │    • Deploy to Vercel                                   │   │
│  │    • Invalidate CDN cache                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 3. DEPLOY BACKENDS (per customer)                       │   │
│  │    • Fetch customer list from Control Plane             │   │
│  │    • For each customer (parallelized):                  │   │
│  │      - supabase functions deploy --project-ref {ref}    │   │
│  │      - supabase db push --project-ref {ref}             │   │
│  │      - Update version in Control Plane                  │   │
│  │      - Run health check                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 4. VERIFY                                               │   │
│  │    • Health check all customer endpoints                │   │
│  │    • Notify on failure                                  │   │
│  │    • Update Control Plane status                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Staged Rollout Model

```yaml
# deploy-config.yaml
rollout:
  stages:
    - name: canary
      customers: [demo, internal-test]
      auto_promote_after: 1h
      
    - name: early-adopters
      customers: [mdc, acme]  # Pilot customers
      auto_promote_after: 24h
      
    - name: general
      customers: all
      
  rollback:
    automatic: true
    health_check_failures: 3
    window: 30m
```

**Deployment script:**
```bash
#!/bin/bash
# deploy.sh

STAGE=${1:-canary}
VERSION=$(git rev-parse --short HEAD)

# Get customers for this stage
CUSTOMERS=$(curl -s https://platform.pawpilotpro.com/api/customers?stage=$STAGE \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq -r '.[].project_ref')

for REF in $CUSTOMERS; do
  echo "Deploying to $REF..."
  
  # Deploy Edge Functions
  npx supabase functions deploy --project-ref $REF
  
  # Run migrations
  npx supabase db push --project-ref $REF
  
  # Update version in control plane
  curl -X PATCH "https://platform.pawpilotpro.com/api/customers/$REF" \
    -H "Authorization: Bearer $PLATFORM_TOKEN" \
    -d "{\"version\": \"$VERSION\", \"deployed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
  
  # Health check
  HEALTH=$(curl -s "https://$REF.supabase.co/functions/v1/api/health")
  if [[ "$HEALTH" != *"ok"* ]]; then
    echo "FAILED: $REF"
    exit 1
  fi
done

echo "Deployment complete: $VERSION"
```

---

## C) Provisioning Workflow

### New Customer Provisioning Process

```
┌─────────────────────────────────────────────────────────────────┐
│              NEW CUSTOMER PROVISIONING (10-15 min)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT:                                                         │
│    • Customer name: "My Dog Company"                            │
│    • Slug: "mdc"                                                │
│    • Admin email: "admin@mydogcompany.com"                      │
│    • Plan: "pro"                                                │
│    • Branding: { logo, colors }                                 │
│                                                                 │
│  STEPS:                                                         │
│                                                                 │
│  1. VALIDATE (5s)                                      [AUTO]   │
│     □ Check slug is available                                   │
│     □ Check email not already registered                        │
│     □ Validate plan exists                                      │
│                                                                 │
│  2. CREATE SUPABASE PROJECT (2-3 min)                  [AUTO]   │
│     □ supabase projects create "paw-pilot-{slug}"               │
│     □ Wait for project ready                                    │
│     □ Store project_ref in Control Plane                        │
│                                                                 │
│  3. CONFIGURE DATABASE (1 min)                         [AUTO]   │
│     □ Apply schema migrations                                   │
│     □ Seed initial data (roles, permissions, defaults)          │
│     □ Create storage buckets (avatars, documents)               │
│     □ Apply storage policies                                    │
│                                                                 │
│  4. DEPLOY EDGE FUNCTIONS (1 min)                      [AUTO]   │
│     □ Deploy backend functions                                  │
│     □ Set function secrets                                      │
│                                                                 │
│  5. CONFIGURE AUTH (30s)                               [AUTO]   │
│     □ Set allowed redirect URLs                                 │
│     □ Configure email templates                                 │
│     □ Set site URL to {slug}.pawpilotpro.com                   │
│                                                                 │
│  6. CREATE ADMIN USER (30s)                            [AUTO]   │
│     □ Create auth user with provided email                      │
│     □ Assign admin role in database                             │
│     □ Send welcome email with password reset link               │
│                                                                 │
│  7. SET BRANDING (10s)                                 [AUTO]   │
│     □ Upload logo to storage                                    │
│     □ Set organisation settings                                 │
│     □ Configure theme colors                                    │
│                                                                 │
│  8. REGISTER IN CONTROL PLANE (10s)                    [AUTO]   │
│     □ Add customer record                                       │
│     □ Store Supabase credentials (encrypted)                    │
│     □ Set status = 'active'                                     │
│                                                                 │
│  9. DNS (already configured - wildcard)                [N/A]    │
│     □ *.pawpilotpro.com already routes to frontend              │
│     □ No per-customer DNS needed                                │
│                                                                 │
│  10. HEALTH CHECK & NOTIFY (30s)                       [AUTO]   │
│      □ Verify {slug}.pawpilotpro.com loads                      │
│      □ Verify API health endpoint                               │
│      □ Verify admin can log in                                  │
│      □ Send confirmation to platform team                       │
│      □ Send welcome email to customer                           │
│                                                                 │
│  OUTPUT:                                                        │
│    • URL: https://mdc.pawpilotpro.com                          │
│    • Admin: admin@mydogcompany.com (password reset sent)        │
│    • Status: Active                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Provisioning CLI Tool

```bash
#!/bin/bash
# provision-customer.sh

set -e

# Parse arguments
SLUG=$1
NAME=$2
ADMIN_EMAIL=$3
PLAN=${4:-pro}

echo "🐾 Provisioning Paw Pilot Pro customer: $NAME ($SLUG)"

# 1. Validate
echo "1/10 Validating..."
EXISTING=$(curl -s "https://platform.pawpilotpro.com/api/customers/$SLUG" \
  -H "Authorization: Bearer $PLATFORM_TOKEN")
if [[ "$EXISTING" != "null" ]]; then
  echo "ERROR: Slug '$SLUG' already exists"
  exit 1
fi

# 2. Create Supabase project
echo "2/10 Creating Supabase project..."
PROJECT_REF=$(npx supabase projects create "paw-pilot-$SLUG" \
  --org-id $SUPABASE_ORG_ID \
  --db-password "$(openssl rand -base64 32)" \
  --region eu-west-2 \
  --format json | jq -r '.id')

echo "    Project created: $PROJECT_REF"

# Wait for project to be ready
echo "    Waiting for project to be ready..."
sleep 60

# 3. Link and apply migrations
echo "3/10 Applying database schema..."
npx supabase link --project-ref $PROJECT_REF
npx supabase db push --project-ref $PROJECT_REF

# 4. Create storage buckets
echo "4/10 Creating storage buckets..."
npx supabase storage create avatars --project-ref $PROJECT_REF --public
npx supabase storage create documents --project-ref $PROJECT_REF

# 5. Deploy Edge Functions
echo "5/10 Deploying backend..."
npx supabase functions deploy --project-ref $PROJECT_REF

# 6. Get project credentials
echo "6/10 Fetching credentials..."
SUPABASE_URL="https://$PROJECT_REF.supabase.co"
ANON_KEY=$(npx supabase projects api-keys --project-ref $PROJECT_REF --format json \
  | jq -r '.[] | select(.name=="anon") | .api_key')
SERVICE_KEY=$(npx supabase projects api-keys --project-ref $PROJECT_REF --format json \
  | jq -r '.[] | select(.name=="service_role") | .api_key')

# 7. Create admin user
echo "7/10 Creating admin user..."
ADMIN_ID=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"email_confirm\": true,
    \"user_metadata\": {\"role\": \"admin\", \"name\": \"Admin\"}
  }" | jq -r '.id')

# Insert admin into staff table
curl -s -X POST "$SUPABASE_URL/rest/v1/staff" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"auth_user_id\": \"$ADMIN_ID\",
    \"email\": \"$ADMIN_EMAIL\",
    \"role\": \"admin\",
    \"status\": \"active\"
  }"

# Send password reset
curl -s -X POST "$SUPABASE_URL/auth/v1/recover" \
  -H "apikey: $ANON_KEY" \
  -d "{\"email\": \"$ADMIN_EMAIL\"}"

# 8. Set initial branding
echo "8/10 Setting branding..."
curl -s -X POST "$SUPABASE_URL/rest/v1/organisation_settings" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$NAME\",
    \"slug\": \"$SLUG\"
  }"

# 9. Register in Control Plane
echo "9/10 Registering in Control Plane..."
curl -s -X POST "https://platform.pawpilotpro.com/api/customers" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"slug\": \"$SLUG\",
    \"name\": \"$NAME\",
    \"project_ref\": \"$PROJECT_REF\",
    \"supabase_url\": \"$SUPABASE_URL\",
    \"anon_key\": \"$ANON_KEY\",
    \"admin_email\": \"$ADMIN_EMAIL\",
    \"plan\": \"$PLAN\",
    \"status\": \"active\",
    \"version\": \"$(git rev-parse --short HEAD)\",
    \"created_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }"

# 10. Health check
echo "10/10 Running health checks..."
sleep 5
HEALTH=$(curl -s "$SUPABASE_URL/functions/v1/api/health")
if [[ "$HEALTH" == *"ok"* ]]; then
  echo ""
  echo "✅ Customer provisioned successfully!"
  echo ""
  echo "   URL:   https://$SLUG.pawpilotpro.com"
  echo "   Admin: $ADMIN_EMAIL (password reset email sent)"
  echo ""
else
  echo "⚠️  Health check failed, please investigate"
  exit 1
fi
```

### Deprovisioning Process

```bash
#!/bin/bash
# deprovision-customer.sh

SLUG=$1
EXPORT_PATH=${2:-./exports}

echo "⚠️  Deprovisioning customer: $SLUG"
echo "    This will:"
echo "    - Export all data"
echo "    - Delete the Supabase project"
echo "    - Remove from Control Plane"
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then exit 1; fi

# Get project ref
PROJECT_REF=$(curl -s "https://platform.pawpilotpro.com/api/customers/$SLUG" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq -r '.project_ref')

# 1. Export data
echo "1/4 Exporting data..."
mkdir -p "$EXPORT_PATH/$SLUG"
pg_dump "$DATABASE_URL" > "$EXPORT_PATH/$SLUG/database.sql"
# Export storage (using supabase CLI or API)
npx supabase storage download --project-ref $PROJECT_REF --output "$EXPORT_PATH/$SLUG/storage"

# 2. Create encrypted archive
echo "2/4 Creating encrypted archive..."
tar -czf "$EXPORT_PATH/$SLUG.tar.gz" -C "$EXPORT_PATH" "$SLUG"
gpg --symmetric --cipher-algo AES256 "$EXPORT_PATH/$SLUG.tar.gz"
rm -rf "$EXPORT_PATH/$SLUG" "$EXPORT_PATH/$SLUG.tar.gz"
echo "    Archive: $EXPORT_PATH/$SLUG.tar.gz.gpg"

# 3. Update Control Plane (mark as archived)
echo "3/4 Updating Control Plane..."
curl -s -X PATCH "https://platform.pawpilotpro.com/api/customers/$SLUG" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -d "{\"status\": \"archived\", \"archived_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

# 4. Delete Supabase project (after retention period)
echo "4/4 Scheduling project deletion..."
echo "    Project $PROJECT_REF will be deleted after 30-day retention period"
# npx supabase projects delete $PROJECT_REF  # Uncomment after retention

echo "✅ Customer archived: $SLUG"
```

---

## D) Risk & Cost Considerations

### Operational Overhead

| Task | Frequency | Time | Automation |
|------|-----------|------|------------|
| Provision new customer | Per signup | 15 min | 95% automated |
| Deploy updates | Weekly | 30 min | Fully automated |
| Monitor health | Continuous | - | Automated alerts |
| Handle incidents | As needed | Varies | Manual |
| Deprovision customer | Rare | 30 min | 90% automated |

**Team size:** 1-2 engineers can manage 50+ customers with this automation level.

### Per-Customer Cost Estimate

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Supabase Pro | $25 | Per project (required for production) |
| Supabase Compute | $10-50 | Depends on Edge Function usage |
| Supabase Storage | $0.021/GB | Usually minimal |
| Vercel (shared) | ~$0.40 | $20/mo ÷ 50 customers |
| Cloudflare (shared) | ~$0.40 | $20/mo ÷ 50 customers |
| **Total per customer** | **~$40-80/mo** | |

**Break-even pricing:** Minimum ~$100/mo per customer to be profitable.

### Scaling Limits

| Aspect | Limit | Mitigation |
|--------|-------|------------|
| Supabase projects per org | 100 (soft limit) | Request increase, or multiple orgs |
| Deployment time | Linear with customers | Parallelize (currently ~30s per customer) |
| Control Plane DB | Standard Postgres limits | Sufficient for 10,000+ customers |
| Cloudflare Workers | 100,000 req/day free | Upgrade to paid if needed |

### Trade-offs vs Multi-Tenant RLS Model

| Aspect | Single-Tenant (this) | Multi-Tenant RLS |
|--------|---------------------|------------------|
| **Isolation** | ✅ Complete | ⚠️ Logical only |
| **Security risk** | ✅ Lower (no cross-tenant bugs) | ⚠️ RLS misconfiguration risk |
| **Cost per customer** | ⚠️ Higher ($40-80) | ✅ Lower ($5-10) |
| **Deployment complexity** | ⚠️ More moving parts | ✅ Single deployment |
| **Data migration** | ✅ Easy (export whole DB) | ⚠️ Complex (filter by tenant) |
| **Custom features per customer** | ✅ Possible | ⚠️ Harder |
| **Compliance (SOC2, HIPAA)** | ✅ Easier to certify | ⚠️ More scrutiny |
| **Break-glass debugging** | ✅ Safe (isolated) | ⚠️ Risk of seeing other data |

**Verdict:** Single-tenant is better for:
- Enterprise customers who demand isolation
- Regulated industries
- Small number of high-value customers
- Teams that want simplicity over cost optimization

---

## E) Minimum Viable Approach (First 3 Customers)

### Phase 1: Manual-ish (Customers 1-3)

**Goal:** Get paying customers live with minimal upfront investment.

#### What to build now:

1. **Wildcard DNS on Cloudflare** (1 hour)
   - Add `*.pawpilotpro.com` → Vercel
   - Enable Universal SSL

2. **Frontend subdomain detection** (2 hours)
   - Extract slug from hostname
   - Fetch config from simple JSON file (no Control Plane yet)
   - Initialize Supabase client dynamically

3. **Config file per customer** (for now)
   ```json
   // public/customers/mdc.json
   {
     "slug": "mdc",
     "name": "My Dog Company",
     "supabaseUrl": "https://xxx.supabase.co",
     "supabaseAnonKey": "eyJ...",
     "branding": {
       "logoUrl": "https://xxx.supabase.co/storage/v1/object/public/avatars/logo.png",
       "primaryColor": "#BA7E74"
     }
   }
   ```

4. **Manual provisioning script** (keep the CLI above)
   - Run manually for each new customer
   - Takes 15-20 minutes with babysitting

5. **Simple customer spreadsheet** (Google Sheets)
   - Track: slug, name, project_ref, status, version
   - Replace with Control Plane later

#### What to defer:

- ❌ Full Control Plane UI
- ❌ Automated CI/CD per-customer deploys
- ❌ Billing integration
- ❌ Vanity domains
- ❌ Staged rollouts

### Phase 2: Light Automation (Customers 4-10)

- Build Control Plane as Supabase project
- Automate provisioning CLI
- Add GitHub Actions for deployment
- Basic health monitoring

### Phase 3: Full Platform (Customers 10+)

- Control Plane UI for provisioning
- Automated staged rollouts
- Billing integration
- Vanity domain support
- Customer self-service portal

---

## Implementation Checklist

### Immediate (This Week)

- [ ] Set up Cloudflare for pawpilotpro.com
- [ ] Configure wildcard DNS
- [ ] Update frontend to detect subdomain and load config
- [ ] Create first customer Supabase project manually
- [ ] Test end-to-end flow

### Short Term (Next 2 Weeks)

- [ ] Create provisioning CLI script
- [ ] Create deprovisioning script
- [ ] Set up GitHub Actions for deployment
- [ ] Create Control Plane Supabase project
- [ ] Build minimal customer registry API

### Medium Term (Next Month)

- [ ] Build Control Plane UI
- [ ] Implement staged rollouts
- [ ] Add health monitoring dashboard
- [ ] Document runbooks for incidents

---

## Appendix: Control Plane Schema

```sql
-- Control Plane database schema (platform.pawpilotpro.com)

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  
  -- Supabase project info
  project_ref TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  anon_key TEXT NOT NULL,  -- Encrypted at rest
  
  -- Status
  status TEXT NOT NULL DEFAULT 'provisioning',  -- provisioning, active, suspended, archived
  plan TEXT NOT NULL DEFAULT 'pro',
  
  -- Deployment
  version TEXT,
  deployed_at TIMESTAMPTZ,
  rollout_stage TEXT DEFAULT 'general',
  
  -- Metadata
  admin_email TEXT,
  support_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- RLS: Only platform staff can access
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff only" ON customers
  FOR ALL USING (auth.jwt() ->> 'role' = 'platform_admin');
```

---

## Questions for Decision

1. **Supabase plan:** Pro ($25/mo per project) or Team ($599/mo for org)? Team may be better if >24 customers.

2. **Billing model:** Should customers be billed directly from Stripe, or through Supabase billing?

3. **Auth provider:** Stick with Supabase Auth, or consider Auth0/Clerk for enterprise features?

4. **Vanity domains:** Priority for launch, or defer?

5. **Support access:** Build break-glass tooling now, or handle manually?

---

*Document maintained by Platform Team. Last updated: 2026-02-07*
