// Seed data for message templates
// This would typically be called once during initial setup

import type { MessageTemplate } from './types';

export const DEFAULT_TEMPLATES: Omit<MessageTemplate, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>[] = [
  // Daycare templates
  {
    name: 'Check-in Confirmation',
    description: 'Sent when a dog is checked in for daycare',
    category: 'operations',
    module: 'daycare',
    subject: '{{petName}} checked in safely',
    body: 'Hi {{customerName}},\n\n{{petName}} has been checked in safely at {{locationName}}.\n\nCheck-in time: {{time}}\n\nWe\'ll take great care of them today!\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'locationName', 'time', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  {
    name: 'Check-out Notification',
    description: 'Sent when a dog is checked out from daycare',
    category: 'operations',
    module: 'daycare',
    subject: '{{petName}} ready for collection',
    body: 'Hi {{customerName}},\n\n{{petName}} has been checked out at {{time}}.\n\nThey had a wonderful day at {{locationName}}!\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'locationName', 'time', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  
  // Grooming templates
  {
    name: 'Grooming Complete',
    description: 'Sent when grooming service is completed',
    category: 'operations',
    module: 'grooming',
    subject: '{{petName}}\'s grooming is complete',
    body: 'Hi {{customerName}},\n\n{{petName}}\'s grooming appointment is now complete! They look absolutely fabulous.\n\nService completed: {{time}}\n{{petName}} is ready for collection at {{locationName}}.\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'locationName', 'time', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  
  // Transport templates
  {
    name: 'Pickup Completed',
    description: 'Sent when transport pickup is completed',
    category: 'operations',
    module: 'transport',
    subject: '{{petName}} picked up',
    body: 'Hi {{customerName}},\n\n{{petName}} has been picked up at {{time}}.\n\nThey\'re on their way to {{locationName}}.\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'locationName', 'time', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  {
    name: 'Drop-off Completed',
    description: 'Sent when transport drop-off is completed',
    category: 'operations',
    module: 'transport',
    subject: '{{petName}} dropped off',
    body: 'Hi {{customerName}},\n\n{{petName}} has been safely dropped off at {{time}}.\n\nThey arrived home safe and sound.\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'time', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  
  // Overnight templates
  {
    name: 'Overnight Check-in',
    description: 'Sent when a dog is checked in for overnight stay',
    category: 'operations',
    module: 'overnights',
    subject: '{{petName}} settled in for the night',
    body: 'Hi {{customerName}},\n\n{{petName}} has been checked in for their overnight stay at {{locationName}}.\n\nCheck-in time: {{time}}\n\nThey\'re settling in nicely and we\'ll take excellent care of them.\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'locationName', 'time', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  {
    name: 'Overnight Update',
    description: 'Evening update for overnight stays',
    category: 'communications',
    module: 'overnights',
    subject: '{{petName}} evening update',
    body: 'Hi {{customerName}},\n\nJust a quick update on {{petName}}.\n\nThey\'ve had their dinner, enjoyed some playtime, and are now settling down for the night at {{locationName}}.\n\nEverything is going great!\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'locationName', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: false,
    isMandatory: false,
    isActive: true
  },
  
  // Safety & Compliance templates
  {
    name: 'Vaccination Expiring Soon',
    description: 'Reminder when vaccination is about to expire',
    category: 'safety',
    subject: '{{petName}}\'s vaccination due for renewal',
    body: 'Hi {{customerName}},\n\nThis is a friendly reminder that {{petName}}\'s vaccination is due for renewal on {{date}}.\n\nPlease ensure their vaccination is up to date before their next visit.\n\nIf you have any questions, please don\'t hesitate to contact us.\n\nBest regards,\n{{locationName}} Team',
    variables: ['petName', 'customerName', 'date', 'locationName'],
    channels: ['email', 'sms'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  {
    name: 'Incident Notification',
    description: 'Sent when an incident occurs',
    category: 'safety',
    subject: 'Important: Incident report for {{petName}}',
    body: 'Hi {{customerName}},\n\nWe\'re writing to inform you of an incident involving {{petName}} today at {{locationName}}.\n\nPlease contact us at your earliest convenience to discuss the details.\n\nThe safety and wellbeing of all our guests is our top priority.\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'locationName', 'staffName'],
    channels: ['email', 'sms'],
    isAutomated: false,
    isMandatory: true,
    requiredPermission: { module: 'incidents', action: 'create' },
    isActive: true
  },
  
  // General communication templates
  {
    name: 'Booking Confirmation',
    description: 'Confirmation of a new booking',
    category: 'communications',
    subject: 'Booking confirmed for {{petName}}',
    body: 'Hi {{customerName}},\n\nYour booking for {{petName}} has been confirmed.\n\nDate: {{date}}\nLocation: {{locationName}}\nReference: {{bookingReference}}\n\nWe look forward to seeing you!\n\nBest regards,\n{{locationName}} Team',
    variables: ['petName', 'customerName', 'date', 'locationName', 'bookingReference'],
    channels: ['email', 'sms'],
    isAutomated: true,
    isMandatory: false,
    isActive: true
  },
  {
    name: 'General Update',
    description: 'General purpose update message',
    category: 'communications',
    subject: 'Update regarding {{petName}}',
    body: 'Hi {{customerName}},\n\nJust wanted to update you about {{petName}}.\n\n[Add your message here]\n\nBest regards,\n{{staffName}}',
    variables: ['petName', 'customerName', 'staffName'],
    channels: ['email', 'sms', 'whatsapp'],
    isAutomated: false,
    isMandatory: false,
    isActive: true
  }
];
