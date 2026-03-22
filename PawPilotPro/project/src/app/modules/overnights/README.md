# Overnights Module

## Overview

The **Overnights** module is a first-class operational module for managing overnight boarding (dog boarding) with dedicated workflows, capacity controls, staff duties, client communications, and billing integration.

This module is distinct from Daycare and Grooming, with its own:
- Reservations and check-in/out workflows
- **Nightly Care Logs** (key differentiator)
- Shift handovers (day ↔ night)
- Capacity management
- Staff permission templates (Night Shift, Overnight Lead)

---

## Module Enablement

### Organisation Level
Admin can enable/disable Overnights at the organisation level via:
**Settings → Modules → Overnights**

### Location Level
Once enabled at org level, each location can individually enable/disable Overnights via:
**Settings → Locations → [Location] → Modules → Overnights**

### Navigation Behavior
- The **Overnights** nav item appears only if:
  - User has `overnights:view` permission
  - Module is enabled for the selected location
  - When "All locations" is selected, appears if enabled in at least one accessible location

---

## Staff Roles & Permission Templates

### Night Shift (Primary)
**Role**: `staff`  
**Module**: `overnights`

**Permissions**:
- `overnights:view`
- `overnights:update`
- `overnights:care_log` — Create and complete nightly care logs
- `customers:view` — Limited to boarding customers
- `pets:view` — Including medical/behavior flags
- `documents:view` — Vaccination status
- `incidents:view` — Overnight-related incidents
- `incidents:create`
- `messaging:view` — Limited
- `messaging:create` — Send updates if permitted
- **No billing access** unless explicitly added

**Use Case**: Night shift staff who complete nightly care logs, monitor boarders, and handle overnight operations.

### Overnight Lead (Senior)
**Role**: `staff`  
**Module**: `overnights`

**Permissions**:
- All Night Shift permissions, plus:
- `overnights:create` — Create reservations
- `overnights:approve` — Approve bookings
- `overnights:checkin` — Check in guests
- `overnights:checkout` — Check out guests
- `incidents:close` — Close overnight incidents

**Use Case**: Senior night shift supervisor with full operational control.

---

## Core Workflows

### 1. Overnight Reservation / Booking

**Create Reservation**:
- Start date (check-in date)
- End date (check-out date)
- Check-in window (e.g., 16:00-18:00)
- Check-out window (e.g., 08:00-10:00)
- Assigned location
- Optional: Assigned sleeping area/kennel
- Special instructions (feeding, medications, behavior)

**Reservation States**:
- `requested` — Initial booking request (optional workflow)
- `confirmed` — Reservation confirmed
- `checked_in` — Guest has checked in
- `in_stay` — Currently staying overnight
- `checked_out` — Completed stay
- `cancelled` — Booking cancelled
- `no_show` — Guest did not arrive

### 2. Check-In

**Enforcement Rules**:
- ✅ Vaccination must be valid (blocker)
- ✅ Waiver must be signed (blocker)
- ✅ Behavior warnings must be acknowledged (if applicable)
- ✅ Medical warnings must be acknowledged (if applicable)

**Process**:
1. Verify vaccination status
2. Verify waiver
3. Acknowledge behavior/medical flags
4. Record check-in notes
5. Update reservation status to `checked_in`
6. Optional: Send "Checked in for overnight stay" communication

### 3. Nightly Care Log (KEY DIFFERENTIATOR)

Each night, staff must complete a **Nightly Care Log** for each boarding dog.

**Log Fields**:
- **Feeding**:
  - Completed (yes/no)
  - Time
  - Notes
- **Medication**:
  - Administered (yes/no)
  - Time
  - Details
- **Toilet Break**:
  - Completed (yes/no)
  - Time
  - Notes
- **Observations**:
  - Behavior notes
  - Health observations
  - Sleep quality (excellent/good/restless/poor)
- **Incidents**:
  - Has incident (yes/no)
  - Creates incident record if flagged

**Purpose**: This log becomes part of the pet's timeline and provides:
- Operational accountability
- Client transparency
- Health/behavior tracking
- Audit trail

### 4. Shift Handover

**Day → Night Shift**:
- General notes for the evening
- Per-dog notes (priority flagged)
- Alerts count
- Actions required

**Night → Morning Shift**:
- Overnight events
- Care log completion status
- Issues/concerns to address

**Acknowledgement**: Incoming shift acknowledges handover to confirm receipt.

### 5. Check-Out

**Process**:
1. Confirm handover to owner/driver
2. Record check-out notes
3. Optional: Next visit notes (for future stays)
4. Update reservation status to `checked_out`
5. Send "Checked out" communication

---

## Capacity Management

### Overnights Capacity (Distinct from Daycare)
Each location has:
- **Max overnight capacity** (number of dogs)
- Optional: Buffer slots for emergencies
- Optional: Sleeping areas/kennels (room types for future extensibility)

### Capacity Enforcement
- Bookings are blocked when capacity is exceeded
- Capacity snapshot shows:
  - Current occupancy
  - Available slots
  - Reservations for a given date

---

## Client Communications

### Communication Templates
- **Checked in for overnight stay**: Sent at check-in
- **Night update**: Optional scheduled update (e.g., "Your dog is sleeping well")
- **Ready for pickup**: Sent when ready for check-out
- **Checked out**: Sent after handover

### Rules
- All communications are permission-based
- Messages logged under customer + pet

---

## Transportation Integration

If **Transport** module is enabled:

### Automatic Transport Requests
Overnights bookings can request:
- **Pickup** for check-in day
- **Drop-off** for check-out day

### Process
1. When creating reservation, check "Requires Pickup" or "Requires Drop-Off"
2. System generates transport requests with:
   - Required time window (based on check-in/out window)
   - "Overnight check-in" or "Overnight check-out" context
3. Driver view includes overnight context

---

## Billing & Pricing Integration

### Services & Pricing
Overnights integrates with the **Services & Pricing** module:

**Service**:
- **Overnight stay** — CHF 119 per night (seeded in baseline price book)

**Pricing Resolution**:
1. When creating reservation, call `/pricing/resolve` with:
   - Service ID: `svc-daycare-overnight`
   - Location ID
   - Quantity (number of nights)
   - Date (for effective price book)
2. Price is **locked to the reservation** at booking time
3. Invoice uses locked price (never recalculated)

**Optional Add-Ons**:
- Late pickup fees (if configured)
- Medication administration surcharge (if configured)

---

## Dashboard Widgets

### "Tonight's Boarders"
Shows for selected location:
- Count in stay vs capacity
- Alerts count (medication, behavior, allergies)
- List of boarders with:
  - Pet name
  - Special care flags
  - Care log completion status

### "Overnights Check-in/Check-out Today"
- Number of check-ins expected today
- Number of check-outs expected today

### "Nightly Logs Outstanding"
- Which dogs are missing care logs for the night shift
- Alerts to ensure completion

**All Locations View**: Aggregates and shows per-location breakdown.

---

## Operational Rules

### Rule Types (Overnights-Specific)

1. **Block check-in if vaccinations expired** (Blocker)
   - Severity: `blocker`
   - Prevents check-in without valid vaccinations

2. **Require nightly log completion** (Warning/Error)
   - Severity: `warning` or `error`
   - Alert if logs not completed by specified time

3. **Escalate high severity incidents** (Automatic)
   - Severity: `info`
   - Incidents of High/Critical severity auto-escalate to Manager/Admin

4. **Enforce quiet hours** (Informational)
   - Severity: `info`
   - Define quiet hours (e.g., 22:00-07:00)

5. **Enforce feeding cut-off** (Warning)
   - Severity: `warning`
   - Alert if feeding not completed by specified time

### Rule Enforcement
- Rules are enforced server-side
- Violations logged and reported

---

## Data Model Summary

### Core Entities

**OvernightReservation**:
- Customer, pet, location
- Start/end dates, check-in/out windows
- Status, pricing (locked)
- Special instructions, flags
- Transport integration

**NightlyCareLog**:
- Reservation, pet, location
- Log date (which night)
- Feeding, medication, toilet break
- Behavior/health observations
- Incident flag

**SleepingArea**:
- Location, name, type
- Capacity, attributes (indoor, heating, etc.)
- Active status

**ShiftHandover**:
- Location, handover date
- From/to shift
- General notes, per-dog notes
- Acknowledgement

**OvernightsCapacity**:
- Location
- Max capacity, buffer slots

---

## API Endpoints

### Reservations
- `GET /overnights/reservations?locationId={id}&startDate={date}&endDate={date}`
- `POST /overnights/reservations`
- `PUT /overnights/reservations/:id`

### Check-In / Check-Out
- `POST /overnights/check-in` — Validates rules, updates status
- `POST /overnights/check-out` — Records handover, updates status

### Nightly Care Logs
- `GET /overnights/care-logs?reservationId={id}&date={date}`
- `POST /overnights/care-logs`
- `PUT /overnights/care-logs/:id`

### Sleeping Areas
- `GET /overnights/sleeping-areas?locationId={id}`
- `POST /overnights/sleeping-areas`
- `PUT /overnights/sleeping-areas/:id`

### Shift Handovers
- `GET /overnights/handovers?locationId={id}&date={date}`
- `POST /overnights/handovers`
- `POST /overnights/handovers/:id/acknowledge`

### Capacity
- `GET /overnights/capacity?locationId={id}`
- `POST /overnights/capacity`
- `GET /overnights/capacity/snapshot?locationId={id}&date={date}`

### Tonight's Boarders
- `GET /overnights/tonights-boarders?locationId={id}&date={date}`

---

## Integration Points

### Customers & Pets
- Reservations link to customer and pet records
- Customer contact info for communications
- Pet medical/behavior flags displayed in UI

### Documents & Vaccination Rules
- Vaccination status checked at check-in
- Vaccination expiry enforced (blocker)
- Waiver documents verified

### Messaging
- Automated communications at check-in, during stay, and check-out
- Permission-based messaging for night shift staff

### Billing
- Pricing resolved from Services & Pricing module
- Invoices use locked reservation pricing
- Add-ons and fees applied as separate line items

### Incidents
- Care logs can flag incidents
- Incident records created automatically
- High severity incidents escalate to management

### Dashboard
- Widgets show tonight's boarders, check-ins/outs, and outstanding logs
- Location-aware (respects selected location)

### Role-Based Access Control (RBAC)
- Night Shift and Overnight Lead permission templates
- Module-specific permissions enforced
- Navigation adapts based on permissions

---

## Acceptance Criteria

✅ Overnights appears as a first-class module (org-wide and per-location enablement)  
✅ Night Shift and Overnight Lead permission templates exist and function  
✅ Overnight reservations, check-in/out, capacity, and nightly care logs work end-to-end  
✅ Transportation requests can be generated from overnights bookings  
✅ Pricing sourced from Services & Pricing and locks correctly to bookings/invoices  
✅ All actions are permission-gated and audited  
✅ Navigation shows Overnights only when enabled for selected location  
✅ Dashboard widgets display overnight metrics correctly  

---

## Future Enhancements

1. **Kennel/Room Assignment UI**: Visual grid for assigning dogs to specific kennels
2. **Automated Night Update Scheduling**: Send scheduled updates to customers
3. **Care Log Templates**: Pre-fill common feeding/medication schedules
4. **Multi-Night Discount Rules**: Apply discounts for extended stays
5. **Waitlist Management**: Queue customers when capacity is full
6. **Pet Compatibility Matrix**: Flag incompatible pets that shouldn't be in adjacent kennels
7. **Incident Escalation Workflow**: Automated escalation paths for critical incidents
8. **Quiet Hours Enforcement**: Alert staff if loud activity during quiet hours
9. **Medication Reminder System**: Push notifications to staff for medication administration
10. **Check-Out Report**: Automated summary of stay for customer (care logs, observations, photos)
