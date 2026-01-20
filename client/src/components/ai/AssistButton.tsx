import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistButtonProps {
  endpoint: 'work-request-draft' | 'job-posting-draft' | 'message-suggest';
  payload: Record<string, unknown>;
  onInsert: (content: string | Record<string, unknown>) => void;
  buttonText?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'icon';
  className?: string;
  disabled?: boolean;
}

interface AIDraft {
  title?: string;
  description?: string;
  scope?: string[];
  requirements?: string[];
  benefits?: string[];
  suggestions?: string[];
  [key: string]: unknown;
}

export function AssistButton({
  endpoint,
  payload,
  onInsert,
  buttonText = 'Assist',
  buttonVariant = 'outline',
  buttonSize = 'sm',
  className,
  disabled,
}: AssistButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AIDraft | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setDraft(null);
    setSelectedSuggestion(null);

    try {
      const response = await fetch(`/api/p2/ai/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error?.message || 'Failed to generate content');
        return;
      }

      if (endpoint === 'message-suggest') {
        setDraft({ suggestions: data.suggestions });
      } else {
        setDraft(data.draft);
      }
    } catch (e) {
      setError('Failed to connect to AI service');
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (!draft) return;

    if (endpoint === 'message-suggest' && draft.suggestions && selectedSuggestion !== null) {
      onInsert(draft.suggestions[selectedSuggestion]);
    } else {
      onInsert(draft);
    }
    setOpen(false);
    setDraft(null);
    setSelectedSuggestion(null);
  };

  const handleOpen = () => {
    setOpen(true);
    setDraft(null);
    setError(null);
    setSelectedSuggestion(null);
  };

  const renderDraftContent = () => {
    if (!draft) return null;

    if (endpoint === 'message-suggest' && draft.suggestions) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-3">Select a suggestion to insert:</p>
          {draft.suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setSelectedSuggestion(index)}
              className={cn(
                'w-full text-left p-3 rounded-md border transition-colors',
                selectedSuggestion === index
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover-elevate'
              )}
              data-testid={`suggestion-option-${index}`}
            >
              <div className="flex items-start gap-2">
                {selectedSuggestion === index && (
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                )}
                <span className="text-sm">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {draft.title && (
          <div>
            <h4 className="text-sm font-medium mb-1">Title</h4>
            <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
              {draft.title}
            </p>
          </div>
        )}
        {draft.description && (
          <div>
            <h4 className="text-sm font-medium mb-1">Description</h4>
            <p className="text-sm text-muted-foreground bg-muted p-2 rounded whitespace-pre-wrap">
              {draft.description}
            </p>
          </div>
        )}
        {draft.scope && draft.scope.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Scope</h4>
            <ul className="text-sm text-muted-foreground bg-muted p-2 rounded list-disc list-inside">
              {draft.scope.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {draft.requirements && draft.requirements.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Requirements</h4>
            <ul className="text-sm text-muted-foreground bg-muted p-2 rounded list-disc list-inside">
              {draft.requirements.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {draft.benefits && draft.benefits.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Benefits</h4>
            <ul className="text-sm text-muted-foreground bg-muted p-2 rounded list-disc list-inside">
              {draft.benefits.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const canInsert = draft && (
    endpoint !== 'message-suggest' || selectedSuggestion !== null
  );

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={handleOpen}
        disabled={disabled}
        className={cn('gap-1.5', className)}
        data-testid="button-ai-assist"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {buttonText}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Assistant
            </DialogTitle>
            <DialogDescription>
              {endpoint === 'work-request-draft' && 'Generate a professional work request description'}
              {endpoint === 'job-posting-draft' && 'Generate compelling job posting content'}
              {endpoint === 'message-suggest' && 'Get suggested replies for your conversation'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!draft && !loading && !error && (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click Generate to create AI-powered content
                </p>
                <Button onClick={handleGenerate} data-testid="button-generate-ai">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
            )}

            {loading && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Generating content...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
                <p className="text-sm text-destructive mb-4">{error}</p>
                <Button variant="outline" onClick={handleGenerate}>
                  Try Again
                </Button>
              </div>
            )}

            {draft && renderDraftContent()}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {draft && (
              <>
                <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button onClick={handleInsert} disabled={!canInsert} data-testid="button-insert-ai">
                  <Check className="h-4 w-4 mr-2" />
                  Insert
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
