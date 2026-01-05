import { useState } from 'react';
import { ConversationList } from '../components/conversations/ConversationList';
import { ConversationView } from '../components/conversations/ConversationView';
import { PaymentPromise } from '../components/payments/PaymentPromise';
import { TrustSignals } from '../components/trust/TrustSignals';
import { FeedbackForm } from '../components/feedback/FeedbackForm';
import { AIAssistPanel } from '../components/aiAssist/AIAssistPanel';
import { Button } from '@/components/ui/button';
import { MessageSquare, DollarSign, Star, FileText, Wrench } from 'lucide-react';

interface SelectedConversation {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  owner_party_id?: string;
  contractor_party_id?: string;
  owner_name: string;
  contractor_name: string;
  state: string;
  my_role: 'owner' | 'contractor';
  intake_mode?: 'bid' | 'run' | 'direct_award';
  run_member_count?: number;
}

export default function ConversationsPage() {
  const [selected, setSelected] = useState<SelectedConversation | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'payment' | 'trust' | 'feedback'>('messages');
  const [showAIAssist, setShowAIAssist] = useState(false);

  const otherPartyId = selected 
    ? (selected.my_role === 'owner' ? selected.contractor_party_id : selected.owner_party_id)
    : null;

  function getIntakeModeLabel(mode?: string): string {
    switch (mode) {
      case 'run': return 'Service Run';
      case 'direct_award': return 'Direct Award';
      default: return 'Get Bids';
    }
  }

  const tabs = [
    { key: 'messages', label: 'Messages', icon: MessageSquare },
    { key: 'payment', label: 'Payment', icon: DollarSign },
    { key: 'trust', label: 'Trust', icon: Star },
    { key: 'feedback', label: 'Feedback', icon: FileText },
  ] as const;

  return (
    <div className="h-full flex">
      <div className="w-80 flex-shrink-0 border-r">
        <ConversationList 
          onSelect={(conv) => setSelected(conv as unknown as SelectedConversation)}
          selectedId={selected?.id}
        />
      </div>

      <div className="flex-1 flex flex-col bg-muted/30">
        {selected ? (
          <>
            <div className="bg-background border-b p-4">
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div>
                  <h2 className="font-semibold" data-testid="text-conversation-title">{selected.opportunity_title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.my_role === 'owner' 
                      ? `Contractor: ${selected.contractor_name}`
                      : `Owner: ${selected.owner_name}`
                    }
                    <span className="mx-2">-</span>
                    <span className="capitalize">{selected.state.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    selected.intake_mode === 'run' 
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' 
                      : selected.intake_mode === 'direct_award'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {getIntakeModeLabel(selected.intake_mode)}
                  </span>
                  
                  {selected.intake_mode === 'run' && selected.run_member_count && (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">
                      {selected.run_member_count} homes
                    </span>
                  )}
                </div>
              </div>
              
              {selected.my_role === 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAIAssist(true)}
                  className="mt-2"
                  data-testid="button-open-ai-assist"
                >
                  <Wrench className="h-4 w-4 mr-1" /> Refine estimate (optional)
                </Button>
              )}
            </div>

            <div className="bg-background border-b px-4">
              <div className="flex gap-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`py-3 px-3 border-b-2 text-sm font-medium transition flex items-center gap-1 ${
                        activeTab === tab.key
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`button-tab-${tab.key}`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {activeTab === 'messages' && (
                <ConversationView 
                  conversationId={selected.id}
                  myRole={selected.my_role}
                  intakeMode={selected.intake_mode}
                />
              )}
              
              {activeTab === 'payment' && (
                <div className="h-full overflow-y-auto">
                  <PaymentPromise 
                    conversationId={selected.id}
                    myRole={selected.my_role}
                  />
                </div>
              )}
              
              {activeTab === 'trust' && otherPartyId && (
                <div className="h-full overflow-y-auto p-4">
                  <TrustSignals partyId={otherPartyId} />
                </div>
              )}
              
              {activeTab === 'feedback' && selected.state === 'completed' && selected.my_role === 'owner' && (
                <div className="h-full overflow-y-auto p-4">
                  <FeedbackForm conversationId={selected.id} />
                </div>
              )}
              
              {activeTab === 'feedback' && selected.state !== 'completed' && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Feedback available after job completion
                </div>
              )}
              
              {activeTab === 'feedback' && selected.state === 'completed' && selected.my_role === 'contractor' && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Go to your Feedback Inbox to view received feedback
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a conversation to get started
          </div>
        )}
      </div>

      {showAIAssist && selected && (
        <AIAssistPanel 
          opportunityId={selected.opportunity_id}
          onClose={() => setShowAIAssist(false)}
        />
      )}
    </div>
  );
}
