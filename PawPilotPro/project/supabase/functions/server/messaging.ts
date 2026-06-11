import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

const app = new Hono();

// Prefix for all routes
const PREFIX = '/make-server-fc003b23/messaging';

// Every route in this module requires a validated user. Scoped to this
// module's prefix — this app is mounted at "/", so a bare '*' here would
// also intercept portal/* and service-to-service routes that use their
// own auth (requirePortalUser / service-key checks).
app.use(`${PREFIX}/*`, requireAuth);
app.use(PREFIX, requireAuth);

// Helper: Generate ID
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// MESSAGE THREADS
// ============================================================================

// GET /messaging/threads - List threads with filters
app.get(`${PREFIX}/threads`, async (c) => {
  try {
    const {
      locationId,
      module,
      channel,
      unreadOnly,
      awaitingResponseOnly,
      slaBreachedOnly,
      householdId,
      search,
      limit = 50,
      offset = 0
    } = c.req.query();

    // Get all threads
    const threadKeys = await kv.getByPrefix('message_thread:');
    let threads = threadKeys.map(item => item.value);

    // Apply filters
    if (locationId && locationId !== 'ALL') {
      threads = threads.filter(t => t.locationId === locationId);
    }
    if (module) {
      threads = threads.filter(t => t.module === module);
    }
    if (channel) {
      threads = threads.filter(t => t.lastMessageChannel === channel);
    }
    if (unreadOnly === 'true') {
      threads = threads.filter(t => t.isUnread);
    }
    if (awaitingResponseOnly === 'true') {
      threads = threads.filter(t => t.awaitingResponse);
    }
    if (slaBreachedOnly === 'true') {
      threads = threads.filter(t => t.slaBreached);
    }
    if (householdId) {
      threads = threads.filter(t => t.householdId === householdId);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      threads = threads.filter(t => 
        t.householdName?.toLowerCase().includes(searchLower) ||
        t.lastMessagePreview?.toLowerCase().includes(searchLower) ||
        t.subject?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last message (most recent first)
    threads.sort((a, b) => {
      // Pinned threads first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // Then by last message time
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    // Filter archived (unless specifically requested)
    threads = threads.filter(t => !t.isArchived);

    // Pagination
    const total = threads.length;
    const paginatedThreads = threads.slice(Number(offset), Number(offset) + Number(limit));

    return c.json({
      threads: paginatedThreads,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Error fetching message threads:', error);
    return internalError(c, 'messaging.getPREFIXThreads', error);
  }
});

// GET /messaging/threads/:threadId - Get single thread
app.get(`${PREFIX}/threads/:threadId`, async (c) => {
  try {
    const { threadId } = c.req.param();
    const thread = await kv.get(`message_thread:${threadId}`);
    
    if (!thread) {
      return c.json({ error: 'Thread not found' }, 404);
    }
    
    return c.json(thread);
  } catch (error) {
    console.error('Error fetching message thread:', error);
    return internalError(c, 'messaging.getPREFIXThreadsThreadId', error);
  }
});

// POST /messaging/threads - Create new thread
app.post(`${PREFIX}/threads`, async (c) => {
  try {
    const body = await c.req.json();
    const threadId = generateId('thread');
    const now = new Date().toISOString();
    
    const thread = {
      id: threadId,
      householdId: body.householdId,
      householdName: body.householdName,
      context: body.context || { householdId: body.householdId },
      customerContactIds: body.customerContactIds || [],
      staffUserIds: [body.createdBy],
      subject: body.subject,
      lastMessageAt: now,
      lastMessagePreview: '',
      lastMessageChannel: body.channel || 'email',
      isUnread: false,
      awaitingResponse: false,
      slaBreached: false,
      isPinned: false,
      isArchived: false,
      priority: body.priority || 'normal',
      locationId: body.locationId,
      module: body.module,
      createdAt: now,
      createdBy: body.createdBy,
      updatedAt: now
    };
    
    await kv.set(`message_thread:${threadId}`, thread);
    
    // Link to household
    const householdThreadsKey = `household_threads:${body.householdId}`;
    const householdThreads = await kv.get(householdThreadsKey) || [];
    householdThreads.push(threadId);
    await kv.set(householdThreadsKey, householdThreads);
    
    // Link to pet if specified
    if (body.context?.petId) {
      const petThreadsKey = `pet_threads:${body.context.petId}`;
      const petThreads = await kv.get(petThreadsKey) || [];
      petThreads.push(threadId);
      await kv.set(petThreadsKey, petThreads);
    }
    
    return c.json(thread, 201);
  } catch (error) {
    console.error('Error creating message thread:', error);
    return internalError(c, 'messaging.postPREFIXThreads', error);
  }
});

// PATCH /messaging/threads/:threadId - Update thread
app.patch(`${PREFIX}/threads/:threadId`, async (c) => {
  try {
    const { threadId } = c.req.param();
    const updates = await c.req.json();
    
    const thread = await kv.get(`message_thread:${threadId}`);
    if (!thread) {
      return c.json({ error: 'Thread not found' }, 404);
    }
    
    const updatedThread = {
      ...thread,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`message_thread:${threadId}`, updatedThread);
    
    return c.json(updatedThread);
  } catch (error) {
    console.error('Error updating message thread:', error);
    return internalError(c, 'messaging.patchPREFIXThreadsThreadId', error);
  }
});

// ============================================================================
// MESSAGES
// ============================================================================

// GET /messaging/threads/:threadId/messages - Get messages in thread
app.get(`${PREFIX}/threads/:threadId/messages`, async (c) => {
  try {
    const { threadId } = c.req.param();
    
    // Get message IDs for this thread
    const messageIds = await kv.get(`thread_messages:${threadId}`) || [];
    
    // Get all messages
    const messages = await Promise.all(
      messageIds.map(async (msgId: string) => {
        return await kv.get(`message:${msgId}`);
      })
    );
    
    // Filter out nulls and sort by created date
    const validMessages = messages.filter(Boolean).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    return c.json({ messages: validMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return internalError(c, 'messaging.getPREFIXThreadsThreadIdMessages', error);
  }
});

// POST /messaging/threads/:threadId/messages - Send message
app.post(`${PREFIX}/threads/:threadId/messages`, async (c) => {
  try {
    const { threadId } = c.req.param();
    const body = await c.req.json();
    
    const thread = await kv.get(`message_thread:${threadId}`);
    if (!thread) {
      return c.json({ error: 'Thread not found' }, 404);
    }
    
    // Check consent if sending to customer
    if (body.recipientContactId && body.channel !== 'in_app') {
      const consent = await kv.get(`contact_consent:${body.recipientContactId}`);
      if (!consent) {
        return c.json({ error: 'No consent record found for contact' }, 403);
      }
      
      const channelConsentKey = `${body.channel}Consent`;
      if (!consent[channelConsentKey]) {
        return c.json({ error: `Contact has not consented to ${body.channel} messages` }, 403);
      }
    }
    
    const messageId = generateId('msg');
    const now = new Date().toISOString();
    
    const message = {
      id: messageId,
      threadId,
      content: body.content,
      channel: body.channel,
      type: body.type || 'manual',
      senderId: body.senderId,
      senderName: body.senderName,
      senderType: body.senderType || 'staff',
      recipientContactId: body.recipientContactId,
      recipientName: body.recipientName,
      status: body.type === 'internal_note' ? 'sent' : 'sending',
      templateId: body.templateId,
      context: body.context || thread.context,
      locationId: body.locationId,
      createdAt: now,
      createdBy: body.senderId,
      metadata: body.metadata || {}
    };
    
    // Save message
    await kv.set(`message:${messageId}`, message);
    
    // Add to thread messages
    const threadMessages = await kv.get(`thread_messages:${threadId}`) || [];
    threadMessages.push(messageId);
    await kv.set(`thread_messages:${threadId}`, threadMessages);
    
    // Update thread
    const updatedThread = {
      ...thread,
      lastMessageAt: now,
      lastMessagePreview: body.content.substring(0, 100),
      lastMessageChannel: body.channel,
      updatedAt: now
    };
    
    if (body.senderType === 'customer') {
      updatedThread.isUnread = true;
      updatedThread.awaitingResponse = true;
    }
    
    await kv.set(`message_thread:${threadId}`, updatedThread);
    
    // Create delivery log for customer messages
    if (body.recipientContactId && body.type !== 'internal_note') {
      // Immediate, honest completion — no fake background send. Real
      // email/SMS delivery is not integrated yet, so the message is marked
      // sent at record time rather than pretending a provider delivered it.
      // TODO: real delivery status when a provider integration is implemented.
      const deliveryLog = {
        messageId,
        channel: body.channel,
        status: 'sent',
        attempts: 1,
        lastAttemptAt: now,
        deliveredAt: now,
        metadata: {}
      };
      await kv.set(`delivery_log:${messageId}`, deliveryLog);

      message.status = 'sent';
      message.sentAt = now;
      await kv.set(`message:${messageId}`, message);
    }
    
    return c.json(message, 201);
  } catch (error) {
    console.error('Error sending message:', error);
    return internalError(c, 'messaging.postPREFIXThreadsThreadIdMessages', error);
  }
});

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

// GET /messaging/templates - List templates
app.get(`${PREFIX}/templates`, async (c) => {
  try {
    const { module, category, channel, activeOnly } = c.req.query();
    
    const templateKeys = await kv.getByPrefix('message_template:');
    let templates = templateKeys.map(item => item.value);
    
    // Apply filters
    if (module) {
      templates = templates.filter(t => t.module === module || !t.module);
    }
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    if (channel) {
      templates = templates.filter(t => t.channels.includes(channel));
    }
    if (activeOnly === 'true') {
      templates = templates.filter(t => t.isActive);
    }
    
    // Sort by name
    templates.sort((a, b) => a.name.localeCompare(b.name));
    
    return c.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return internalError(c, 'messaging.getPREFIXTemplates', error);
  }
});

// POST /messaging/templates - Create template
app.post(`${PREFIX}/templates`, async (c) => {
  try {
    const body = await c.req.json();
    const templateId = generateId('tmpl');
    const now = new Date().toISOString();
    
    const template = {
      id: templateId,
      name: body.name,
      description: body.description,
      category: body.category,
      module: body.module,
      subject: body.subject,
      body: body.body,
      variables: body.variables || [],
      channels: body.channels,
      isAutomated: body.isAutomated || false,
      isMandatory: body.isMandatory || false,
      requiredPermission: body.requiredPermission,
      allowedRoles: body.allowedRoles,
      createdAt: now,
      createdBy: body.createdBy,
      updatedAt: now,
      updatedBy: body.createdBy,
      isActive: true
    };
    
    await kv.set(`message_template:${templateId}`, template);
    
    return c.json(template, 201);
  } catch (error) {
    console.error('Error creating template:', error);
    return internalError(c, 'messaging.postPREFIXTemplates', error);
  }
});

// PATCH /messaging/templates/:templateId - Update template
app.patch(`${PREFIX}/templates/:templateId`, async (c) => {
  try {
    const { templateId } = c.req.param();
    const updates = await c.req.json();
    
    const template = await kv.get(`message_template:${templateId}`);
    if (!template) {
      return c.json({ error: 'Template not found' }, 404);
    }
    
    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: updates.updatedBy
    };
    
    await kv.set(`message_template:${templateId}`, updatedTemplate);
    
    return c.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    return internalError(c, 'messaging.patchPREFIXTemplatesTemplateId', error);
  }
});

// ============================================================================
// CONSENT MANAGEMENT
// ============================================================================

// GET /messaging/consent/:contactId - Get consent record
app.get(`${PREFIX}/consent/:contactId`, async (c) => {
  try {
    const { contactId } = c.req.param();
    const consent = await kv.get(`contact_consent:${contactId}`);
    
    if (!consent) {
      return c.json({ error: 'Consent record not found' }, 404);
    }
    
    return c.json(consent);
  } catch (error) {
    console.error('Error fetching consent:', error);
    return internalError(c, 'messaging.getPREFIXConsentContactId', error);
  }
});

// PUT /messaging/consent/:contactId - Update consent
app.put(`${PREFIX}/consent/:contactId`, async (c) => {
  try {
    const { contactId } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();
    
    const existingConsent = await kv.get(`contact_consent:${contactId}`) || {
      contactId,
      householdId: body.householdId,
      emailConsent: false,
      smsConsent: false,
      whatsappConsent: false,
      pushConsent: false,
      consentHistory: []
    };
    
    const updatedConsent = {
      ...existingConsent,
      emailConsent: body.emailConsent ?? existingConsent.emailConsent,
      smsConsent: body.smsConsent ?? existingConsent.smsConsent,
      whatsappConsent: body.whatsappConsent ?? existingConsent.whatsappConsent,
      pushConsent: body.pushConsent ?? existingConsent.pushConsent,
      emailAddress: body.emailAddress || existingConsent.emailAddress,
      phoneNumber: body.phoneNumber || existingConsent.phoneNumber,
      whatsappNumber: body.whatsappNumber || existingConsent.whatsappNumber,
      lastUpdated: now,
      updatedBy: body.updatedBy
    };
    
    // Track consent changes
    const channels: Array<{ key: string; channel: 'email' | 'sms' | 'whatsapp' | 'push' }> = [
      { key: 'emailConsent', channel: 'email' },
      { key: 'smsConsent', channel: 'sms' },
      { key: 'whatsappConsent', channel: 'whatsapp' },
      { key: 'pushConsent', channel: 'push' }
    ];
    
    channels.forEach(({ key, channel }) => {
      if (body[key] !== undefined && body[key] !== existingConsent[key]) {
        updatedConsent.consentHistory.push({
          timestamp: now,
          channel,
          consented: body[key],
          updatedBy: body.updatedBy
        });
      }
    });
    
    await kv.set(`contact_consent:${contactId}`, updatedConsent);
    
    return c.json(updatedConsent);
  } catch (error) {
    console.error('Error updating consent:', error);
    return internalError(c, 'messaging.putPREFIXConsentContactId', error);
  }
});

// ============================================================================
// STATISTICS & METRICS
// ============================================================================

// GET /messaging/stats - Get messaging statistics
app.get(`${PREFIX}/stats`, async (c) => {
  try {
    const { locationId } = c.req.query();
    
    const threadKeys = await kv.getByPrefix('message_thread:');
    let threads = threadKeys.map(item => item.value);
    
    if (locationId && locationId !== 'ALL') {
      threads = threads.filter(t => t.locationId === locationId);
    }
    
    const stats = {
      total: threads.length,
      unread: threads.filter(t => t.isUnread).length,
      awaitingResponse: threads.filter(t => t.awaitingResponse).length,
      slaBreached: threads.filter(t => t.slaBreached).length,
      byChannel: {
        email: threads.filter(t => t.lastMessageChannel === 'email').length,
        sms: threads.filter(t => t.lastMessageChannel === 'sms').length,
        whatsapp: threads.filter(t => t.lastMessageChannel === 'whatsapp').length
      },
      byPriority: {
        urgent: threads.filter(t => t.priority === 'urgent').length,
        high: threads.filter(t => t.priority === 'high').length,
        normal: threads.filter(t => t.priority === 'normal').length,
        low: threads.filter(t => t.priority === 'low').length
      }
    };
    
    return c.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return internalError(c, 'messaging.getPREFIXStats', error);
  }
});

export default app;
