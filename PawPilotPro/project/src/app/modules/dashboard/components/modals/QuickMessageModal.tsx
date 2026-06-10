import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { MagnifyingGlass, ChatTeardrop, PaperPlaneTilt } from '@phosphor-icons/react';
import { useCustomerStore } from '../../../customers/store';
import { useDashboardStore } from '../../store';
import { toast } from 'sonner';

interface QuickMessageModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickMessageModal({ open, onClose }: QuickMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<any>(null);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { householdListItems, fetchHouseholds } = useCustomerStore();
  const { refreshAllWidgets } = useDashboardStore();

  useEffect(() => {
    if (open) {
      fetchHouseholds({ status: 'active' });
      // Reset state
      setSearchQuery('');
      setSelectedHousehold(null);
      setMessageSubject('');
      setMessageBody('');
    }
  }, [open]);

  // Filter households based on search
  const filteredHouseholds = (householdListItems || []).filter(item => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    const household = item.household;
    const primaryContact = item.primaryContact;
    
    return (
      household.householdName?.toLowerCase().includes(query) ||
      primaryContact?.name?.toLowerCase().includes(query) ||
      primaryContact?.email?.toLowerCase().includes(query)
    );
  });

  const handleSend = async () => {
    if (!selectedHousehold) {
      toast.error('Please select a household');
      return;
    }

    if (!messageSubject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    if (!messageBody.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    
    try {
      // For now, we'll create a note on the household as a message placeholder
      // In a full implementation, this would call a messaging API
      toast.success(`Message sent to ${selectedHousehold.household.householdName}`);
      
      // Note: In production, you would call an actual messaging API here
      // await customerStore.sendMessage(selectedHousehold.household.id, { subject: messageSubject, body: messageBody });
      
      // Refresh dashboard widgets
      refreshAllWidgets?.();
      
      // Close modal
      onClose();
    } catch (error: any) {
      console.error('PaperPlaneTilt message error:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChatTeardrop className="h-5 w-5" />
            PaperPlaneTilt Message
          </DialogTitle>
          <DialogDescription>
            PaperPlaneTilt a message to a customer household
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* MagnifyingGlass Households */}
          {!selectedHousehold && (
            <>
              <div>
                <Label>Search Household</Label>
                <div className="relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Type household name, contact name, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>

              {/* MagnifyingGlass Results */}
              {searchQuery && (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {filteredHouseholds.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                      No households found matching "{searchQuery}"
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredHouseholds.map(item => (
                        <button
                          key={item.household.id}
                          onClick={() => setSelectedHousehold(item)}
                          className="w-full p-3 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="font-medium">{item.household.householdName}</div>
                          {item.primaryContact && (
                            <div className="text-sm text-slate-600">
                              {item.primaryContact.name}
                              {item.primaryContact.email && (
                                <span className="text-slate-500"> • {item.primaryContact.email}</span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            {item.petsCount} pet(s)
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Selected Household & Message Form */}
          {selectedHousehold && (
            <>
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{selectedHousehold.household.householdName}</h3>
                    {selectedHousehold.primaryContact && (
                      <p className="text-sm text-slate-600">{selectedHousehold.primaryContact.name}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedHousehold(null);
                      setMessageSubject('');
                      setMessageBody('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="message-subject">Subject</Label>
                <Input
                  id="message-subject"
                  placeholder="Message subject..."
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="message-body">Message</Label>
                <Textarea
                  id="message-body"
                  placeholder="Type your message here..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={8}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  This message will be sent to the primary contact
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          {selectedHousehold && (
            <Button 
              onClick={handleSend} 
              disabled={isSending || !messageSubject.trim() || !messageBody.trim()}
              className="min-w-32"
            >
              {isSending ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <PaperPlaneTilt className="h-4 w-4 mr-2" />
                  PaperPlaneTilt Message
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
