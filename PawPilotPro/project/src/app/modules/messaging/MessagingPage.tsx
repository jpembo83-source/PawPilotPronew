import React, { useEffect, useState } from 'react';
import { 
  MessageSquare, 
  Search, 
  Filter,
  Mail,
  Phone,
  Send,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { ScrollArea } from '../../components/ui/scroll-area';
import { useAuth } from '../../context/AuthContext';
import { useMessagingStore } from './store';
import { fetchThreads, fetchMessages, fetchStats } from './api';
import { toast } from 'sonner';
import { InboxFilters } from './components/InboxFilters';
import { ConversationView } from './components/ConversationView';
import { ComposeMessageModal } from './components/ComposeMessageModal';
import { ContextPanel } from './components/ContextPanel';
import type { MessageThread } from './types';

export function MessagingPage() {
  const { user, hasPermission } = useAuth();
  const {
    threads,
    selectedThread,
    filters,
    stats,
    isLoading,
    setThreads,
    selectThread,
    setLoading,
    setStats,
    setThreadMessages,
    showComposeModal,
    setShowComposeModal
  } = useMessagingStore();

  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Check permissions
  const canViewMessaging = hasPermission('messaging', 'read');
  const canSendMessages = hasPermission('messaging', 'create');

  useEffect(() => {
    if (canViewMessaging) {
      loadThreads();
      loadStats();
    }
  }, [filters, canViewMessaging]);

  const loadThreads = async () => {
    try {
      setLoading(true);
      const data = await fetchThreads(filters);
      setThreads(data.threads);
    } catch (error: any) {
      console.error('Failed to load threads:', error);
      toast.error('Failed to load message threads');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await fetchStats(filters.locationId);
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleSelectThread = async (thread: MessageThread) => {
    selectThread(thread);
    
    // Load messages for this thread
    try {
      const messages = await fetchMessages(thread.id);
      setThreadMessages(thread.id, messages);
      
      // Mark as read
      if (thread.isUnread) {
        // Would update thread status here
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load conversation');
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Implement debounced search
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <Phone className="h-4 w-4" />;
      case 'whatsapp':
        return <Send className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'normal':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (!canViewMessaging) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Access</h3>
              <p className="text-slate-600">
                You don't have permission to view messaging.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-slate-600" />
              Messaging
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Centralised customer communications
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Stats badges */}
            {stats.unread > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {stats.unread} unread
              </Badge>
            )}
            {stats.awaitingResponse > 0 && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                {stats.awaitingResponse} awaiting response
              </Badge>
            )}
            {stats.slaBreached > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                {stats.slaBreached} SLA breached
              </Badge>
            )}
            
            {canSendMessages && (
              <Button onClick={() => setShowComposeModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Inbox sidebar */}
        <div className="w-96 border-r bg-slate-50 flex flex-col">
          {/* Search and filters */}
          <div className="p-4 space-y-3 bg-white border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={handleSearch}
                className="pl-9"
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {Object.keys(filters).length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {Object.keys(filters).length}
                </Badge>
              )}
            </Button>
            
            {showFilters && <InboxFilters />}
          </div>

          {/* Thread list */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-slate-600">
                Loading conversations...
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600">No conversations found</p>
              </div>
            ) : (
              <div className="divide-y">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectThread(thread)}
                    className={`
                      w-full p-4 text-left hover:bg-white transition-colors
                      ${selectedThread?.id === thread.id ? 'bg-white border-l-4 border-l-blue-500' : ''}
                      ${thread.isUnread ? 'bg-blue-50' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${thread.isUnread ? 'font-semibold' : ''}`}>
                          {thread.householdName}
                        </h3>
                        {thread.isPinned && (
                          <Badge variant="outline" className="text-xs">Pinned</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {getChannelIcon(thread.lastMessageChannel)}
                        {thread.slaBreached && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                      {thread.lastMessagePreview}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {new Date(thread.lastMessageAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {thread.priority !== 'normal' && (
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(thread.priority)}`}>
                            {thread.priority}
                          </Badge>
                        )}
                        {thread.awaitingResponse && (
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                            Awaiting response
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Conversation view */}
        <div className="flex-1 flex">
          {selectedThread ? (
            <>
              <div className="flex-1">
                <ConversationView thread={selectedThread} />
              </div>
              <div className="w-80 border-l bg-slate-50">
                <ContextPanel thread={selectedThread} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                <p className="text-sm text-slate-600">
                  Choose a conversation from the list to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      <ComposeMessageModal 
        open={showComposeModal}
        onClose={() => setShowComposeModal(false)}
      />
    </div>
  );
}
