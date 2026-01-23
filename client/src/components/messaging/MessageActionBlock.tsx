/**
 * V3.5 Message Action Blocks - BlockRenderer Component
 * 
 * Renders action blocks within message threads with MarketMode enforcement.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Loader2, Check, X, ExternalLink, MessageSquare, HelpCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import type { UseMarketActionsResult } from '@/policy/useMarketActions';
import {
  type ActionBlockV1,
  type ActionType,
  postMessageAction,
  generateIdempotencyKey,
  getAllowedActionsForBlockType,
  isLinkOutOnly,
  isTerminalStatus,
} from '@/api/messageActions';

interface MessageActionBlockProps {
  messageId: string;
  conversationId: string;
  actionBlock: ActionBlockV1;
  isPublicViewer: boolean;
  marketActions?: UseMarketActionsResult;
  onActionComplete?: (messageId: string, newActionBlock: ActionBlockV1) => void;
}

const STATUS_BADGES: Record<ActionBlockV1['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  accepted: { label: 'Accepted', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'outline' },
  informational: { label: 'Completed', variant: 'default' },
};

const BLOCK_TYPE_ICONS: Record<ActionBlockV1['blockType'], React.ReactNode> = {
  summary: <MessageSquare className="h-4 w-4" />,
  question: <HelpCircle className="h-4 w-4" />,
  multi_question: <HelpCircle className="h-4 w-4" />,
  offer: <Check className="h-4 w-4" />,
  availability: <Check className="h-4 w-4" />,
  capacity: <AlertTriangle className="h-4 w-4" />,
  deposit_request: <ExternalLink className="h-4 w-4" />,
  change_request: <AlertTriangle className="h-4 w-4" />,
  signature_request: <ExternalLink className="h-4 w-4" />,
  cancellation: <X className="h-4 w-4" />,
};

export function MessageActionBlock({
  messageId,
  conversationId,
  actionBlock,
  isPublicViewer,
  marketActions,
  onActionComplete,
}: MessageActionBlockProps) {
  const { toast } = useToast();
  const copy = useCopy({ entryPoint: 'service' });
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string>>({});
  const [counterInput, setCounterInput] = useState('');
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string | null>(null);

  const canDo = useCallback((actionId: string) => {
    if (!marketActions?.actions) return false;
    return marketActions.actions.some((a) => a.id === actionId || a.id === `${actionId}_request`);
  }, [marketActions]);

  const canAccept = canDo('accept');
  const canDecline = canDo('decline');
  const canAnswer = canDo('answer') || canDo('ack');
  const canAcknowledge = canDo('acknowledge') || canDo('ack');
  const canCounter = canDo('counter') || canDo('propose_change');
  const canDeposit = canDo('deposit') || canDo('pay');
  const canSign = canDo('sign') || canDo('signature');

  const allowedActions = getAllowedActionsForBlockType(actionBlock.blockType);
  const isResolved = isTerminalStatus(actionBlock.status) || actionBlock.status === 'informational';
  const isLinkOut = isLinkOutOnly(actionBlock.blockType);

  const executeAction = useCallback(async (action: ActionType, response?: unknown) => {
    const idempotencyKey = currentIdempotencyKey || generateIdempotencyKey(messageId, action, response);
    setCurrentIdempotencyKey(idempotencyKey);
    setIsLoading(true);
    setActiveAction(action);

    try {
      const result = await postMessageAction(messageId, {
        action,
        response,
        idempotencyKey,
      });

      const successKey = `message.action_block.${
        action === 'accept' ? 'accepted' :
        action === 'decline' ? 'declined' :
        action === 'answer' ? 'answered' :
        action === 'acknowledge' ? 'acknowledged' :
        'countered'
      }`;

      toast({
        title: copy.resolve(successKey) || 'Action completed',
        variant: 'default',
      });

      onActionComplete?.(messageId, result.action_block);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const errorCode = err.code || 'error.internal';
      
      toast({
        title: copy.resolve(errorCode) || err.message || 'Action failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
      setCurrentIdempotencyKey(null);
    }
  }, [messageId, currentIdempotencyKey, onActionComplete, toast, copy]);

  const handleAccept = () => executeAction('accept');
  const handleDecline = () => executeAction('decline');
  const handleAcknowledge = () => executeAction('acknowledge');
  
  const handleAnswer = () => {
    if (!answerInput.trim()) return;
    executeAction('answer', answerInput.trim());
    setAnswerInput('');
  };
  
  const handleMultiAnswer = () => {
    const questions = (actionBlock.payload as { questions?: Array<{ id: string; text: string }> }).questions || [];
    const allAnswered = questions.every(q => multiAnswers[q.id]?.trim());
    if (!allAnswered) return;
    executeAction('answer', multiAnswers);
    setMultiAnswers({});
  };
  
  const handleCounter = () => {
    if (!counterInput.trim()) return;
    executeAction('counter', counterInput.trim());
    setCounterInput('');
  };

  const statusBadge = STATUS_BADGES[actionBlock.status];
  const blockIcon = BLOCK_TYPE_ICONS[actionBlock.blockType];

  const renderBlockContent = () => {
    const { payload, blockType } = actionBlock;
    
    switch (blockType) {
      case 'summary':
        return (
          <div className="text-sm text-muted-foreground">
            {(payload as { summary?: string }).summary || 'Summary information'}
          </div>
        );
      
      case 'question':
        return (
          <div className="space-y-2">
            <p className="text-sm">
              {(payload as { question?: string }).question || 'Question pending response'}
            </p>
            {(payload as { response?: string }).response && (
              <div className="bg-muted rounded p-2 text-sm">
                <span className="font-medium">Response: </span>
                {String((payload as { response?: string }).response)}
              </div>
            )}
          </div>
        );
      
      case 'multi_question': {
        const questions = (payload as { questions?: Array<{ id: string; text: string }> }).questions || [];
        const responses = (payload as { response?: Record<string, string> }).response || {};
        return (
          <div className="space-y-3">
            {questions.length > 0 ? (
              questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-1">
                  <p className="text-sm font-medium">{q.text}</p>
                  {responses[q.id] && (
                    <div className="bg-muted rounded p-2 text-sm ml-2">
                      <span className="text-muted-foreground">Answer: </span>
                      {responses[q.id]}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Multiple questions pending response</p>
            )}
          </div>
        );
      }
      
      case 'offer':
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {(payload as { title?: string }).title || 'Offer'}
            </p>
            {(payload as { price?: number }).price && (
              <p className="text-sm text-muted-foreground">
                Amount: ${(payload as { price?: number }).price}
              </p>
            )}
            {(payload as { description?: string }).description && (
              <p className="text-sm text-muted-foreground">
                {(payload as { description?: string }).description}
              </p>
            )}
          </div>
        );
      
      case 'availability':
        return (
          <div className="space-y-1">
            <p className="text-sm">
              {(payload as { message?: string }).message || 'Availability check'}
            </p>
            {(payload as { counter?: string }).counter && (
              <div className="bg-muted rounded p-2 text-sm mt-2">
                <span className="font-medium">Counter proposal: </span>
                {(payload as { counter?: string }).counter}
              </div>
            )}
          </div>
        );
      
      case 'change_request':
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium">Change Request</p>
            <p className="text-sm text-muted-foreground">
              {(payload as { description?: string }).description || 'Review the proposed changes'}
            </p>
          </div>
        );
      
      case 'capacity':
      case 'cancellation':
        return (
          <div className="space-y-1">
            <p className="text-sm">
              {(payload as { message?: string }).message || 
               (blockType === 'cancellation' ? 'Cancellation notice' : 'Capacity update')}
            </p>
          </div>
        );
      
      case 'deposit_request':
      case 'signature_request':
        return (
          <div className="space-y-1">
            <p className="text-sm">
              {(payload as { message?: string }).message || 
               (blockType === 'deposit_request' ? 'Deposit required' : 'Signature required')}
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderActions = () => {
    if (isPublicViewer || isResolved) return null;
    if (isLinkOut && actionBlock.ctaUrl) {
      const canLinkOut = actionBlock.blockType === 'deposit_request' ? canDeposit :
                         actionBlock.blockType === 'signature_request' ? canSign : true;
      if (!canLinkOut) return null;
      
      return (
        <Button
          variant="outline"
          size="sm"
          asChild
          data-testid={`button-cta-${messageId}`}
        >
          <a 
            href={actionBlock.ctaUrl} 
            target="_blank" 
            rel="noreferrer noopener"
          >
            Continue <ExternalLink className="ml-2 h-3 w-3" />
          </a>
        </Button>
      );
    }

    const { blockType } = actionBlock;

    if (blockType === 'question') {
      if (!allowedActions.includes('answer') || !canAnswer) return null;
      
      return (
        <div className="flex gap-2 w-full">
          <Textarea
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            placeholder="Type your response..."
            disabled={isLoading}
            className="flex-1 min-h-[60px]"
            data-testid={`input-answer-${messageId}`}
          />
          <Button
            onClick={handleAnswer}
            disabled={isLoading || !answerInput.trim()}
            size="sm"
            data-testid={`button-answer-${messageId}`}
          >
            {isLoading && activeAction === 'answer' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      );
    }

    if (blockType === 'multi_question') {
      if (!allowedActions.includes('answer') || !canAnswer) return null;
      
      const questions = (actionBlock.payload as { questions?: Array<{ id: string; text: string }> }).questions || [];
      const allAnswered = questions.every(q => multiAnswers[q.id]?.trim());
      
      return (
        <div className="space-y-3 w-full">
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="space-y-1">
              <label className="text-xs text-muted-foreground">{q.text}</label>
              <Input
                value={multiAnswers[q.id] || ''}
                onChange={(e) => setMultiAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Your answer..."
                disabled={isLoading}
                data-testid={`input-answer-${messageId}-${q.id}`}
              />
            </div>
          ))}
          <Button
            onClick={handleMultiAnswer}
            disabled={isLoading || !allAnswered}
            size="sm"
            data-testid={`button-answer-${messageId}`}
          >
            {isLoading && activeAction === 'answer' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Submit All'
            )}
          </Button>
        </div>
      );
    }

    if (blockType === 'offer') {
      return (
        <div className="flex gap-2">
          {allowedActions.includes('accept') && canAccept && (
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              size="sm"
              data-testid={`button-accept-${messageId}`}
            >
              {isLoading && activeAction === 'accept' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1 h-3 w-3" /> Accept
                </>
              )}
            </Button>
          )}
          {allowedActions.includes('decline') && canDecline && (
            <Button
              onClick={handleDecline}
              disabled={isLoading}
              variant="outline"
              size="sm"
              data-testid={`button-decline-${messageId}`}
            >
              {isLoading && activeAction === 'decline' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="mr-1 h-3 w-3" /> Decline
                </>
              )}
            </Button>
          )}
        </div>
      );
    }

    if (blockType === 'availability' || blockType === 'change_request') {
      return (
        <div className="space-y-2 w-full">
          <div className="flex gap-2">
            {allowedActions.includes('accept') && canAccept && (
              <Button
                onClick={handleAccept}
                disabled={isLoading}
                size="sm"
                data-testid={`button-accept-${messageId}`}
              >
                {isLoading && activeAction === 'accept' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-1 h-3 w-3" /> Accept
                  </>
                )}
              </Button>
            )}
            {allowedActions.includes('decline') && canDecline && blockType === 'change_request' && (
              <Button
                onClick={handleDecline}
                disabled={isLoading}
                variant="outline"
                size="sm"
                data-testid={`button-decline-${messageId}`}
              >
                {isLoading && activeAction === 'decline' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="mr-1 h-3 w-3" /> Decline
                  </>
                )}
              </Button>
            )}
          </div>
          {allowedActions.includes('counter') && canCounter && (
            <div className="flex gap-2 w-full">
              <Input
                value={counterInput}
                onChange={(e) => setCounterInput(e.target.value)}
                placeholder="Propose alternative..."
                disabled={isLoading}
                className="flex-1"
                data-testid={`input-counter-${messageId}`}
              />
              <Button
                onClick={handleCounter}
                disabled={isLoading || !counterInput.trim()}
                variant="secondary"
                size="sm"
                data-testid={`button-counter-${messageId}`}
              >
                {isLoading && activeAction === 'counter' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Counter'
                )}
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (blockType === 'capacity' || blockType === 'cancellation') {
      if (!allowedActions.includes('acknowledge') || !canAcknowledge) return null;
      
      return (
        <Button
          onClick={handleAcknowledge}
          disabled={isLoading}
          variant="outline"
          size="sm"
          data-testid={`button-acknowledge-${messageId}`}
        >
          {isLoading && activeAction === 'acknowledge' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Acknowledge'
          )}
        </Button>
      );
    }

    return null;
  };

  return (
    <Card 
      className="mt-2 border-l-4 border-l-primary/50"
      data-testid={`action-block-${messageId}`}
    >
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {blockIcon}
          <span className="text-sm font-medium capitalize">
            {actionBlock.blockType.replace(/_/g, ' ')}
          </span>
        </div>
        <Badge variant={statusBadge.variant} className="text-xs">
          {statusBadge.label}
        </Badge>
      </CardHeader>
      <CardContent className="py-2 px-3">
        {renderBlockContent()}
      </CardContent>
      {!isPublicViewer && !isResolved && (allowedActions.length > 0 || isLinkOut) && (
        <CardFooter className="py-2 px-3 border-t">
          {renderActions()}
        </CardFooter>
      )}
    </Card>
  );
}

export default MessageActionBlock;
