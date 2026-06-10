import React, { useState } from 'react';
import { PaperPlaneTilt, CircleNotch, User, Robot } from '@phosphor-icons/react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Badge } from '../../../components/ui/badge';
import { useAuth } from '../../../context/AuthContext';
import { useMessagingStore } from '../store';
import { sendMessage } from '../api';
import { toast } from 'sonner';
import type { MessageThread, Message } from '../types';

interface ConversationViewProps {
  thread: MessageThread;
}

export function ConversationView({ thread }: ConversationViewProps) {
  const { user, hasPermission } = useAuth();
  const { threadMessages, addMessage, isSendingMessage, setSendingMessage, updateThread } = useMessagingStore();
  const [messageText, setMessageText] = useState('');

  const messages = threadMessages[thread.id] || [];
  const canSend = hasPermission('messaging', 'create');

  const handleSend = async () => {
    if (!messageText.trim() || !canSend) return;

    try {
      setSendingMessage(true);
      
      const newMessage = await sendMessage({
        threadId: thread.id,
        content: messageText,
        channel: 'email', // Default, could be selected
        type: 'manual',
        senderId: user!.id,
        senderName: user!.user_metadata?.name || user!.email || 'Unknown',
        senderType: 'staff',
        locationId: thread.locationId,
        context: thread.context
      });

      addMessage(thread.id, newMessage);
      updateThread(thread.id, {
        lastMessageAt: newMessage.createdAt,
        lastMessagePreview: messageText.substring(0, 100),
        awaitingResponse: false
      });
      
      setMessageText('');
      toast.success('Message sent');
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return '✓';
      case 'read':
        return '✓✓';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-6 py-4 border-b bg-white">
        <h2 className="font-semibold">{thread.householdName}</h2>
        <div className="flex items-center gap-2 mt-1">
          {thread.subject && (
            <p className="text-sm text-slate-600">{thread.subject}</p>
          )}
          {thread.module && (
            <Badge variant="secondary" className="text-xs">
              {thread.module}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">
              No messages yet
            </div>
          ) : (
            messages.map((message) => {
              const isStaff = message.senderType === 'staff';
              const isSystem = message.senderType === 'system';
              const isInternal = message.type === 'internal_note';

              return (
                <div
                  key={message.id}
                  className={`flex ${isStaff || isSystem ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[70%] rounded-lg p-4
                    ${isInternal ? 'bg-amber-50 border border-amber-200' :
                      isStaff ? 'bg-blue-500 text-white' :
                      isSystem ? 'bg-slate-100 text-slate-700' :
                      'bg-white border border-slate-200'}
                  `}>
                    {/* Sender info */}
                    <div className="flex items-center gap-2 mb-2">
                      {isSystem ? (
                        <Robot className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      <span className="text-xs font-medium">
                        {message.senderName}
                      </span>
                      {isInternal && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          Internal Note
                        </Badge>
                      )}
                    </div>

                    {/* Message content */}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    {/* Message footer */}
                    <div className={`flex items-center justify-between mt-2 text-xs ${isStaff && !isInternal ? 'text-blue-100' : 'text-slate-500'}`}>
                      <span>
                        {new Date(message.createdAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {message.status && !isInternal && (
                        <span className="ml-2">{getStatusIcon(message.status)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Compose area */}
      {canSend && (
        <div className="p-4 border-t bg-white">
          <div className="flex gap-3">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!messageText.trim() || isSendingMessage}
              className="self-end"
            >
              {isSendingMessage ? (
                <CircleNotch className="h-4 w-4 animate-spin" />
              ) : (
                <PaperPlaneTilt className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  );
}
