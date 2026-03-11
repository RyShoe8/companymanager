/**
 * IntentParser: Rule-based intent extraction from voice transcript.
 * Maps natural language to structured intents for the VoiceExecutor.
 */

export type IntentType =
    | 'NAVIGATE'
    | 'SET_TIMEFRAME'
    | 'FILTER_PHASE'
    | 'SWITCH_LENS'
    | 'SWITCH_VIEW'
    | 'TOGGLE_FILTER'
    | 'OPEN_ENTITY'
    | 'CREATE_CONTENT'
    | 'COMPLETE_TASK'
    | 'PUBLISH_CONTENT'
    | 'EDIT_ENTITY'
    | 'DELETE_ENTITY'
    | 'MARK_COMPLETE' // Added new intent type
    | 'UNKNOWN';

export interface ParsedIntent {
    type: IntentType;
    confidence: number; // 0-1
    slots: Record<string, string>;
    rawTranscript: string;
}

interface PatternRule {
    type: IntentType;
    patterns: RegExp[];
    extractSlots: (match: RegExpMatchArray) => Record<string, string>;
}

const rules: PatternRule[] = [
    // Navigation
    {
        type: 'NAVIGATE',
        patterns: [
            /(?:go to|open|navigate to|show me)\s+(workspace|assets|employees|team|admin)/i,
        ],
        extractSlots: (m) => {
            let place = m[1].toLowerCase();
            if (place === 'team') place = 'employees';
            return { place };
        },
    },

    // Set timeframe
    {
        type: 'SET_TIMEFRAME',
        patterns: [
            /(?:show|switch to|view)\s+(today|this week|weekly|this month|monthly|this quarter|quarterly|this year|yearly)/i,
            /^(today|weekly|monthly|quarterly|yearly)$/i,
        ],
        extractSlots: (m) => {
            const raw = m[1].toLowerCase();
            const map: Record<string, string> = {
                'today': 'today',
                'this week': 'weekly',
                'weekly': 'weekly',
                'this month': 'monthly',
                'monthly': 'monthly',
                'this quarter': 'quarterly',
                'quarterly': 'quarterly',
                'this year': 'yearly',
                'yearly': 'yearly',
            };
            return { timeframe: map[raw] || raw };
        },
    },

    // Filter phase
    {
        type: 'FILTER_PHASE',
        patterns: [
            /(?:filter to|show|switch to)\s+(plan|build|run|all)/i,
            /^(plan|build|run|all)\s*(?:phase)?$/i,
        ],
        extractSlots: (m) => ({
            phase: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(),
        }),
    },

    // Switch lens
    {
        type: 'SWITCH_LENS',
        patterns: [
            /(?:show|switch to|view)\s+(schedule|projects|capacity)/i,
        ],
        extractSlots: (m) => ({ lens: m[1].toLowerCase() }),
    },

    // Switch calendar/agenda
    {
        type: 'SWITCH_VIEW',
        patterns: [
            /(?:switch to|show|view)\s+(calendar|agenda)/i,
        ],
        extractSlots: (m) => ({ mode: m[1].toLowerCase() }),
    },

    // Toggle filters
    {
        type: 'TOGGLE_FILTER',
        patterns: [
            /(?:show|hide)\s+(tasks|content|only my assignments)/i,
            /show only my (?:assignments|work)/i,
        ],
        extractSlots: (m) => {
            const raw = m[1]?.toLowerCase() || 'my assignments';
            if (raw.includes('my')) return { filter: 'myAssignments', action: 'show' };
            const action = m[0].toLowerCase().startsWith('hide') ? 'hide' : 'show';
            return { filter: raw, action };
        },
    },

    // Open entity
    {
        type: 'OPEN_ENTITY',
        patterns: [
            /(?:open|show|view)\s+project\s+(.+)/i,
            /(?:open|show|view)\s+content\s+(.+)/i,
            /(?:open|show|view)\s+asset\s+(.+)/i,
        ],
        extractSlots: (m) => {
            const fullMatch = m[0].toLowerCase();
            let entityType = 'project';
            if (fullMatch.includes('content')) entityType = 'content';
            if (fullMatch.includes('asset')) entityType = 'asset';
            return { entityType, name: m[1].trim() };
        },
    },

    // Create content
    {
        type: 'CREATE_CONTENT',
        patterns: [
            /(?:create|add|new|schedule)\s+(?:a\s+)?(?:content|post)\s*(?::?\s*(.+))?/i,
            /(?:create|add|schedule)\s+(?:a\s+)?(\w+)\s+post\s+(.+)/i,
        ],
        extractSlots: (m) => {
            const slots: Record<string, string> = {};
            if (m[2]) {
                // "create LinkedIn post Title"
                slots.channel = m[1];
                slots.title = m[2].trim();
            } else if (m[1]) {
                slots.title = m[1].trim();
            }
            return slots;
        },
    },

    // Delete entity
    {
        type: 'DELETE_ENTITY',
        patterns: [
            /(?:delete|remove)\s+(project|content|task)\s+(.+)/i,
        ],
        extractSlots: (m) => ({
            entityType: m[1].toLowerCase(),
            name: m[2].trim(),
        }),
    },

    // Complete Task
    {
        type: 'COMPLETE_TASK',
        patterns: [
            /(?:mark|set)\s+(?:the\s+)?(.+?)\s+(?:as\s+)?(?:complete|done|finished)/i,
            /(?:complete|finish)\s+(?:the\s+)?(.+)/i,
        ],
        extractSlots: (m) => ({
            name: m[1].trim(),
        }),
    },

    // Publish Content
    {
        type: 'PUBLISH_CONTENT',
        patterns: [
            /(?:publish|post|go live with)\s+(?:the\s+)?(.+)/i,
            /mark\s+(?:the\s+)?(.+?)\s+as\s+published/i,
        ],
        extractSlots: (m) => ({
            name: m[1].trim(),
        }),
    },
];

export function parseIntent(transcript: string): ParsedIntent {
    const normalize = (s: string) => s.toLowerCase()
        .replace(/\b(the|task|item|a|an|please|can|you|ready|mark)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const cleaned = normalize(transcript);
    console.log('[Voice] Parsing transcript:', { raw: transcript, cleaned });

    if (!cleaned) {
        return { type: 'UNKNOWN', confidence: 0, slots: {}, rawTranscript: transcript };
    }

    for (const rule of rules) {
        for (const pattern of rule.patterns) {
            const match = transcript.match(pattern) || cleaned.match(pattern);
            if (match) {
                const intent = {
                    type: rule.type,
                    confidence: 0.9,
                    slots: rule.extractSlots(match),
                    rawTranscript: transcript,
                };
                console.log('[Voice] Detected Intent:', intent);
                return intent;
            }
        }
    }

    console.log('[Voice] No intent matched');
    return { type: 'UNKNOWN', confidence: 0, slots: {}, rawTranscript: transcript };
}
