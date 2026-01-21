/**
 * Coordination Intent Card
 * 
 * Opt-in toggle for coordination readiness.
 * Privacy-safe: shares no personal details, only signals readiness.
 * 
 * Visible to resident/admin/owner contexts only.
 * Not visible in contractor preview or public routes.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { HandshakeIcon, Save, Loader2 } from 'lucide-react';
import { useWorkRequestCoordinationIntent } from '@/hooks/useCoordination';
import { useToast } from '@/hooks/use-toast';

interface CoordinationIntentCardProps {
  workRequestId: string;
  portalId: string | null;
  currentIntent: boolean;
  currentNote: string | null;
  intentSetAt: string | null;
}

export function CoordinationIntentCard({ 
  workRequestId, 
  portalId,
  currentIntent,
  currentNote,
  intentSetAt
}: CoordinationIntentCardProps) {
  const [intent, setIntent] = useState(currentIntent);
  const [note, setNote] = useState(currentNote || '');
  const [noteEdited, setNoteEdited] = useState(false);
  const { toast } = useToast();

  const mutation = useWorkRequestCoordinationIntent(workRequestId);

  useEffect(() => {
    setIntent(currentIntent);
    setNote(currentNote || '');
    setNoteEdited(false);
  }, [currentIntent, currentNote]);

  const handleToggle = async (checked: boolean) => {
    setIntent(checked);
    
    try {
      const result = await mutation.mutateAsync({
        coordination_intent: checked,
        note: checked ? note : null,
      });

      if (result.portal_required_for_matching) {
        toast({
          title: 'Intent saved',
          description: 'Assign a portal for better coordination matching.',
        });
      } else {
        toast({
          title: checked ? 'Coordination opt-in saved' : 'Coordination opt-out saved',
        });
      }
    } catch (error) {
      setIntent(!checked);
      toast({
        title: 'Failed to update coordination intent',
        variant: 'destructive',
      });
    }
  };

  const handleSaveNote = async () => {
    try {
      await mutation.mutateAsync({
        coordination_intent: intent,
        note: note.trim() || null,
      });
      setNoteEdited(false);
      toast({ title: 'Note saved' });
    } catch (error) {
      toast({
        title: 'Failed to save note',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card data-testid="card-coordination-intent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <HandshakeIcon className="h-4 w-4 text-muted-foreground" />
            Coordination Intent
          </CardTitle>
          <Badge variant="outline" className="text-xs">opt-in</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label 
            htmlFor="coordination-intent-toggle" 
            className="text-sm cursor-pointer flex-1"
          >
            I'm open to coordinating this with similar requests
          </Label>
          <Switch
            id="coordination-intent-toggle"
            checked={intent}
            onCheckedChange={handleToggle}
            disabled={mutation.isPending}
            data-testid="switch-coordination-intent"
          />
        </div>

        {intent && (
          <div className="space-y-2">
            <Label htmlFor="coordination-note" className="text-sm text-muted-foreground">
              Optional note (e.g., "flexible timing")
            </Label>
            <Textarea
              id="coordination-note"
              placeholder="e.g., flexible timing, morning preferred"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteEdited(true);
              }}
              maxLength={280}
              className="resize-none text-sm"
              rows={2}
              data-testid="input-coordination-note"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {note.length}/280
              </span>
              {noteEdited && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveNote}
                  disabled={mutation.isPending}
                  data-testid="button-save-coordination-note"
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save note
                </Button>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This shares no personal details. It only signals coordination readiness.
        </p>

        {intentSetAt && (
          <p className="text-xs text-muted-foreground">
            Opted in: {new Date(intentSetAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
