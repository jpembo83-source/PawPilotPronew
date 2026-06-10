import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Warning, CircleNotch } from '@phosphor-icons/react';
import { useAuth } from '../../../context/AuthContext';
import { useMessagingStore } from '../store';
import { createThread, sendMessage } from '../api';
import { toast } from 'sonner';

interface ComposeMessageModalProps {
  open: boolean;
  onClose: () => void;
  preSelectedHouseholdId?: string;
  preSelectedHouseholdName?: string;
}

export function ComposeMessageModal({ 
  open, 
  onClose,
  preSelectedHouseholdId,
  preSelectedHouseholdName 
}: ComposeMessageModalProps) {
  const { user } = useAuth();
  const { addThread, addMessage } = useMessagingStore();
  
  const [householdId, setHouseholdId] = useState(preSelectedHouseholdId || '');
  const [householdName, setHouseholdName] = useState(preSelectedHouseholdName || '');
  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!householdId || !householdName || !content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create thread
      const thread = await createThread({
        householdId,
        householdName,
        context: { householdId },
        subject,
        channel,
        priority: 'normal',
        locationId: 'default', // Should come from user context
        createdBy: user!.id
      });

      addThread(thread);

      // Send initial message
      const message = await sendMessage({
        threadId: thread.id,
        content,
        channel,
        type: 'manual',
        senderId: user!.id,
        senderName: user!.user_metadata?.name || user!.email || 'Unknown',
        senderType: 'staff',
        locationId: thread.locationId,
        context: thread.context
      });

      addMessage(thread.id, message);

      toast.success('Message sent successfully');
      handleClose();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setHouseholdId(preSelectedHouseholdId || '');
    setHouseholdName(preSelectedHouseholdName || '');
    setChannel('email');
    setSubject('');
    setContent('');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compose Message</DialogTitle>
          <DialogDescription>
            Send a message to a customer household
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Household selection - simplified for now */}
          <div className="space-y-2">
            <Label>Household *</Label>
            <Alert>
              <Warning className="h-4 w-4" />
              <AlertDescription className="text-xs">
                In production, this would be a searchable household selector
              </AlertDescription>
            </Alert>
            <input
              type="text"
              value={householdName}
              onChange={(e) => {
                setHouseholdName(e.target.value);
                setHouseholdId(e.target.value.toLowerCase().replace(/\s/g, '-'));
              }}
              placeholder="Enter household name"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label>Channel *</Label>
            <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div className="space-y-2">
              <Label>Subject</Label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message subject"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[150px]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Message'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
