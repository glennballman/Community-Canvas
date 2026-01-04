const TIER1_PATTERNS = [
  { name: 'phone_dashed', regex: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g },
  { name: 'phone_parens', regex: /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g },
  { name: 'phone_intl', regex: /\+1\s*\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { name: 'phone_10digit', regex: /\b\d{10}\b/g },
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { name: 'email_obfuscated', regex: /\b[A-Za-z0-9._%+-]+\s*(at|@)\s*[A-Za-z0-9.-]+\s*(dot|\.)\s*(com|ca|net|org|io)\b/gi },
  { name: 'url_http', regex: /https?:\/\/[^\s]+/g },
  { name: 'url_www', regex: /www\.[^\s]+/g },
];

const TIER2_PATTERNS = [
  { name: 'phone_spelled', regex: /\b(two|three|four|five|six|seven|eight|nine)\s*(five|zero|one|two|three|four|five|six|seven|eight|nine)\s*(zero|one|two|three|four|five|six|seven|eight|nine)/gi },
];

const SOCIAL_KEYWORDS = /\b(instagram|ig|facebook|fb|whatsapp|telegram|signal|messenger|snapchat|tiktok|twitter|x\.com)\b/i;
const CONTACT_INTENT = /\b(text|call|phone|email|message|reach|contact)\s*(me|us)\b/gi;

export interface RedactionResult {
  wasRedacted: boolean;
  cleanContent: string;
  originalContent: string;
  detectedItems: Array<{
    tier: 1 | 2;
    type: string;
    value: string;
  }>;
  hasContactIntent: boolean;
}

export function redactContactInfo(content: string): RedactionResult {
  let cleanContent = content;
  const detectedItems: RedactionResult['detectedItems'] = [];
  let tier1Triggered = false;

  const hasSocialKeywords = SOCIAL_KEYWORDS.test(content);
  const hasContactIntent = CONTACT_INTENT.test(content);

  for (const pattern of TIER1_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      tier1Triggered = true;
      for (const match of matches) {
        if (!detectedItems.find(d => d.value === match)) {
          detectedItems.push({
            tier: 1,
            type: pattern.name,
            value: match
          });
        }
        cleanContent = cleanContent.replace(
          new RegExp(escapeRegex(match), 'g'), 
          '[contact info protected]'
        );
      }
    }
  }

  if (tier1Triggered || hasSocialKeywords) {
    for (const pattern of TIER2_PATTERNS) {
      const matches = content.match(pattern.regex);
      if (matches) {
        for (const match of matches) {
          if (!detectedItems.find(d => d.value === match)) {
            detectedItems.push({
              tier: 2,
              type: pattern.name,
              value: match
            });
          }
          cleanContent = cleanContent.replace(
            new RegExp(escapeRegex(match), 'g'),
            '[contact info protected]'
          );
        }
      }
    }
  }

  return {
    wasRedacted: detectedItems.length > 0,
    cleanContent,
    originalContent: content,
    detectedItems,
    hasContactIntent
  };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function shouldBlockMessage(
  conversation_id: string,
  recent_redaction_count: number
): { blocked: boolean; reason?: string } {
  if (recent_redaction_count >= 3) {
    return {
      blocked: false,
      reason: 'Multiple contact sharing attempts detected. Please wait for deposit confirmation to share contact details.'
    };
  }
  return { blocked: false };
}
