// Incident Notes Tab - View and add notes/comments

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { ChatTeardrop } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useIncidentsStore } from '../store';
import type { Incident } from '../types';

interface IncidentNotesTabProps {
  incident: Incident;
  onUpdate: () => void;
}

export function IncidentNotesTab({ incident, onUpdate }: IncidentNotesTabProps) {
  const { addNote, isLoading } = useIncidentsStore();
  const [content, setContent] = useState('');

  const handleAddNote = async () => {
    if (!content.trim()) {
      toast.error('Please enter a note');
      return;
    }

    try {
      await addNote(incident.id, content.trim(), true);
      toast.success('Note added');
      setContent('');
      onUpdate();
    } catch (err) {
      // Error handled by store
    }
  };

  const notes = incident.notes || [];

  return (
    <div className="space-y-4">
      {incident.status !== 'closed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Add a note or comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
            <Button onClick={handleAddNote} disabled={isLoading}>
              <ChatTeardrop className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notes & Comments ({notes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No notes yet</p>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="border-l-4 border-primary pl-4 py-2">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-slate-900">{note.author_name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(note.created_at).toLocaleString('en-GB')}
                    </p>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
