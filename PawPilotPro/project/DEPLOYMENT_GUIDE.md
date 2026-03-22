# Backend Deployment Guide - MDC Operations Centre

## Overview

Your MDC Operations Centre uses Supabase Edge Functions for the backend API. The backend handles:
- View As sessions and permissions
- Messaging (Email, SMS, WhatsApp)
- Customer & Household management
- Services & Pricing approvals
- Operational Rules Engine
- Settings (Communications, Billing, Data Compliance, Integrations, System)

## Deployment Method for Figma Make

### Option 1: Automatic Deployment (Recommended for Figma Make)

**In Figma Make, backend deployment is typically automatic.** Your backend code is already written and configured. The deployment should happen automatically when you:

1. Click the **"Deploy"** or **"Publish"** button in the Figma Make interface
2. The system will deploy both your frontend and backend together
3. Wait for the deployment to complete (usually 1-2 minutes)

**After deployment:**
- Your backend will be available at: `https://{projectId}.supabase.co/functions/v1/make-server-fc003b23/`
- All features (View As, Messaging, etc.) will work automatically
- You may need to click "Seed Data" buttons in various sections to initialize sample data

---

### Option 2: Manual Deployment (If using Supabase CLI directly)

If you're working outside of Figma Make or need to deploy manually:

#### Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login
```

#### Link Your Project
```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_ID
```

#### Deploy the Edge Function
```bash
# Deploy the edge function
supabase functions deploy make-server-fc003b23

# Set environment variables (if needed)
supabase secrets set SUPABASE_URL=your-url-here
supabase secrets set SUPABASE_ANON_KEY=your-key-here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key-here
```

---

## Backend Structure

Your backend is located in `/supabase/functions/server/` with these modules:

```
/supabase/functions/
├── make-server-fc003b23/
│   └── index.ts              # Edge function entry point
└── server/
    ├── index.tsx             # Main Hono server with all routes
    ├── kv_store.tsx          # Key-value database utilities
    ├── view_as.ts            # View As sessions API
    ├── messaging.ts          # Messaging API
    ├── customers_routes.tsx  # Customers & Households API
    ├── pricing_routes.tsx    # Services & Pricing API
    ├── pricing_approvals_routes.tsx
    ├── overnights_routes.tsx
    ├── operational_rules.ts  # Rules Engine API
    ├── communications_settings.ts
    ├── billing_finance_settings.ts
    ├── data_compliance.ts
    ├── integrations_settings.ts
    ├── system.ts
    └── app_routes.tsx        # General app routes
```

---

## Verifying Deployment

After deployment, verify your backend is working:

### 1. Health Check
Visit in your browser:
```
https://{projectId}.supabase.co/functions/v1/make-server-fc003b23/health
```

You should see:
```json
{"status": "ok"}
```

### 2. Test in the App

1. **Open the MDC Operations Centre**
2. **Navigate to Settings → System → View As Management**
3. **Click "Seed Data"** - This should succeed without errors
4. **Check the Session History tab** - You should see "No session history available"
5. **Try the "Start View As" button** in the user menu - It should show the dialog with users

### 3. Check Browser Console

Open DevTools (F12) → Console. You should NOT see:
- ❌ "Failed to fetch"
- ❌ "Backend server is not available"

---

## Troubleshooting

### Error: "Backend server is not available"

**Cause:** Edge function not deployed or URL is incorrect

**Solution:**
1. Check that deployment completed successfully
2. Verify the `projectId` in `/utils/supabase/info.tsx` matches your Supabase project
3. Try redeploying the edge function
4. Check Supabase Dashboard → Edge Functions for deployment logs

### Error: "Failed to seed data"

**Cause:** Environment variables not set or function not found

**Solution:**
1. Ensure edge function is deployed
2. Check that environment variables are set in Supabase Dashboard
3. Review function logs in Supabase Dashboard

### Error: "CORS policy" 

**Cause:** CORS not configured properly

**Solution:**
- The backend already has CORS configured in `/supabase/functions/server/index.tsx`
- If issue persists, check Supabase Dashboard → Edge Functions → Settings

### Function Logs

View logs in Supabase Dashboard:
1. Go to **Edge Functions** section
2. Click on **make-server-fc003b23**
3. View **Logs** tab for errors

---

## Environment Variables

The backend uses these environment variables (automatically set by Supabase):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin access)
- `SUPABASE_DB_URL` - Database connection string

**Note:** These are automatically available in Edge Functions. You don't need to set them manually unless deploying outside of Supabase.

---

## API Endpoints

Once deployed, your backend provides these endpoints:

### View As
- `POST /make-server-fc003b23/view-as/start` - Start viewing as another user
- `POST /make-server-fc003b23/view-as/end` - End view-as session
- `GET /make-server-fc003b23/view-as/active/:userId` - Get active session
- `GET /make-server-fc003b23/view-as/sessions` - List all sessions
- `GET /make-server-fc003b23/view-as/audit-logs` - Get audit logs
- `POST /make-server-fc003b23/view-as/seed` - Seed sample data

### Messaging
- `GET /make-server-fc003b23/messages` - List messages
- `POST /make-server-fc003b23/messages` - Send message
- And more...

### Customers
- `GET /make-server-fc003b23/customers/households` - List households
- `POST /make-server-fc003b23/customers/households` - Create household
- And more...

*(Full API documentation available in each module's comments)*

---

## Next Steps After Deployment

1. ✅ Verify health check endpoint
2. ✅ Test View As feature by clicking "Seed Data"
3. ✅ Test Messaging by navigating to Messages section
4. ✅ Initialize other modules (Customers, Services, etc.) as needed
5. ✅ Check browser console for any remaining errors

---

## Support

If you encounter issues:

1. **Check Supabase Dashboard Logs** - Most detailed error information
2. **Check Browser Console** - Frontend errors and API responses
3. **Verify Environment Variables** - Ensure all secrets are set
4. **Review Function Code** - Check `/supabase/functions/server/index.tsx`

---

**Your backend is production-ready!** All the code is written and configured. You just need to deploy it using one of the methods above.
