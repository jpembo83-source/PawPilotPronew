# Messaging Module

## Overview

The Messaging module is a production-grade, context-aware communications system for the MDC Operations Centre. It centralises all customer communications in one auditable, permission-gated interface.

## Key Features

### ✅ Implemented (Phase 1)

- **Multi-Channel Support**: Email, SMS, WhatsApp
- **Threaded Conversations**: All messages grouped by household/context
- **Context Linking**: Messages linked to households, pets, bookings, transport, incidents
- **Permission-Based Access**: Role-based visibility and send permissions
- **Consent Enforcement**: Channel-specific consent management
- **Message Templates**: Pre-defined templates with variable substitution
- **Manual & Automated Messages**: Support for both staff-initiated and system-triggered messages
- **Internal Notes**: Staff-only notes that never go to customers
- **Message Status Tracking**: Draft, Sending, Sent, Delivered, Failed
- **SLA Tracking**: Flag conversations breaching response SLAs
- **Dashboard Widget**: Unread count and recent messages widget
- **Search & Filters**: Filter by location, module, channel, unread, SLA status

### 🚧 To Be Implemented (Phase 2+)

- **Household Selector**: Searchable household picker in compose modal
- **Template Management UI**: Full CRUD interface for templates
- **Actual Email/SMS Integration**: Real integration with SendGrid, Twilio, etc.
- **Push Notifications**: Mobile app push notification support
- **Rich Text Editor**: Formatting options for messages
- **File Attachments**: Send images, PDFs, etc.
- **Message Scheduling**: Schedule messages for future delivery
- **Bulk Messaging**: Send to multiple households
- **Message Analytics**: Delivery rates, read rates, response times
- **Advanced SLA Rules**: Configurable SLA policies per module/priority
- **Message Export**: GDPR-compliant message exports

## Architecture

### Data Model

```
message_thread:{threadId}       - Thread metadata (household, context, status)
message:{messageId}             - Individual messages
thread_messages:{threadId}      - Array of message IDs per thread
household_threads:{householdId} - Array of thread IDs per household
pet_threads:{petId}             - Array of thread IDs per pet
message_template:{templateId}   - Message templates
contact_consent:{contactId}     - Consent records per contact
delivery_log:{messageId}        - Delivery status tracking
```

### API Endpoints

All routes prefixed with `/make-server-fc003b23/messaging`:

**Threads**
- `GET /threads` - List threads with filters
- `GET /threads/:threadId` - Get single thread
- `POST /threads` - Create new thread
- `PATCH /threads/:threadId` - Update thread

**Messages**
- `GET /threads/:threadId/messages` - Get messages in thread
- `POST /threads/:threadId/messages` - Send message

**Templates**
- `GET /templates` - List templates
- `POST /templates` - Create template
- `PATCH /templates/:templateId` - Update template

**Consent**
- `GET /consent/:contactId` - Get consent record
- `PUT /consent/:contactId` - Update consent

**Stats**
- `GET /stats` - Get messaging statistics

## Usage

### Accessing the Messaging Page

Navigate to `/messages` in the application. Requires `messaging.read` permission.

### Viewing Conversations

1. Use the inbox sidebar to view all conversations
2. Apply filters to narrow down results (location, module, channel, unread, etc.)
3. Click a conversation to view the full thread
4. Context panel shows related information (pets, bookings, etc.)

### Sending Messages

**Manual Message:**
1. Click "New Message" button
2. Select household (currently simplified - enter name)
3. Choose channel (email, SMS, WhatsApp)
4. Type your message
5. Send

**Reply to Existing Thread:**
1. Open a conversation
2. Type reply in the compose area at the bottom
3. Press Enter or click Send button

### Message Types

**Manual Messages** - Staff-initiated, appears in conversation
**Automated Messages** - System-triggered, logged automatically  
**Internal Notes** - Staff-only, never sent to customer (amber background)

### Using Templates

Templates can be used when composing messages. They support variables:

- `{{petName}}` - Pet's name
- `{{customerName}}` - Customer's name
- `{{staffName}}` - Staff member's name
- `{{locationName}}` - Location name
- `{{date}}`, `{{time}}` - Date/time
- `{{bookingReference}}` - Booking reference

Example template:
```
Hi {{customerName}},

{{petName}} has been checked in safely at {{locationName}}.

Best regards,
{{staffName}}
```

### Consent Management

Before sending messages, the system checks:
- Email: `emailConsent === true`
- SMS: `smsConsent === true`
- WhatsApp: `whatsappConsent === true`

If consent is not granted, the message will be blocked with an error message.

## Permissions

| Permission | Allows |
|------------|--------|
| `messaging.read` | View conversations and messages |
| `messaging.create` | Send messages and create threads |
| `messaging.update` | Edit message properties (status, etc.) |
| `messaging.delete` | Delete messages (admin only) |

## Integration Points

### Customers Module
- Messages appear in household timelines
- Click household to view related messages

### Daycare/Grooming/Overnights
- Auto-messages on check-in/check-out
- Messages linked to bookings

### Transport
- Pickup/drop-off notifications
- Messages linked to transport requests

### Dashboard
- Messaging widget shows unread count and recent threads
- Click widget to navigate to full messaging page

## Default Templates

The system includes 11 default templates:

**Daycare:**
- Check-in Confirmation
- Check-out Notification

**Grooming:**
- Grooming Complete

**Transport:**
- Pickup Completed
- Drop-off Completed

**Overnights:**
- Overnight Check-in
- Overnight Update

**Safety:**
- Vaccination Expiring Soon
- Incident Notification

**General:**
- Booking Confirmation
- General Update

## Development

### Adding New Templates

```typescript
import { createTemplate } from './api';

await createTemplate({
  name: 'My Template',
  description: 'Description of when to use this',
  category: 'operations',
  module: 'daycare',
  body: 'Hi {{customerName}}, {{petName}} says hello!',
  variables: ['customerName', 'petName'],
  channels: ['email', 'sms', 'whatsapp'],
  isAutomated: false,
  createdBy: userId
});
```

### Triggering Automated Messages

```typescript
// In your booking/check-in logic:
import { createThread, sendMessage } from '@/modules/messaging/api';

const thread = await createThread({
  householdId: household.id,
  householdName: household.name,
  context: {
    householdId: household.id,
    petId: pet.id,
    bookingId: booking.id,
    module: 'daycare'
  },
  locationId: booking.locationId,
  module: 'daycare',
  createdBy: 'system'
});

await sendMessage({
  threadId: thread.id,
  content: renderedTemplateContent,
  channel: 'email',
  type: 'automated',
  senderId: 'system',
  senderName: 'MDC Operations',
  senderType: 'system',
  recipientContactId: contact.id,
  recipientName: contact.name,
  templateId: template.id,
  locationId: booking.locationId,
  context: thread.context
});
```

### Store Usage

```typescript
import { useMessagingStore } from '@/modules/messaging';

const {
  threads,
  selectedThread,
  filters,
  setFilters,
  selectThread
} = useMessagingStore();

// Filter unread only
setFilters({ unreadOnly: true });

// Select a thread
selectThread(thread);
```

## Security & Compliance

1. **Consent Enforcement**: All customer messages require explicit channel consent
2. **Permission Gating**: UI and API enforce role-based permissions
3. **Audit Trail**: All messages immutable and logged with timestamps
4. **GDPR Ready**: Message exports available on request
5. **Server-Side Validation**: Never trust client - all checks enforced server-side

## Troubleshooting

**Messages not sending:**
- Check contact has consent for the channel
- Verify user has `messaging.create` permission
- Check server logs for delivery errors

**Can't see conversations:**
- Verify user has `messaging.read` permission
- Check location filter matches conversations
- Verify module filter includes relevant threads

**SLA alerts not showing:**
- SLA rules need to be configured (Phase 2 feature)
- Check thread `slaBreached` property in data

## Future Enhancements

1. **WhatsApp Business API** integration
2. **Scheduled messages** (e.g., birthday greetings)
3. **Automated reminders** (booking reminders, pickup alerts)
4. **SMS shortcodes** for quick replies
5. **Message templates per location** (customisation)
6. **Multi-language support** for templates
7. **Customer portal integration** (two-way messaging)
8. **AI-powered sentiment analysis** on incoming messages
9. **Message approval workflow** for sensitive communications
10. **Integration with booking system** for automatic confirmations

---

**Status**: ✅ Phase 1 Complete - Core functionality operational  
**Next Phase**: Template Management UI + Real channel integrations  
**Owner**: MDC Operations Platform Team  
**Last Updated**: December 2024
