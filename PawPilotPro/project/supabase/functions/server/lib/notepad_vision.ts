// Vision extraction for the paper-notepad booking ingest: sends one photo of
// a handwritten daycare page to Claude and gets back a structured list of
// intended bookings. Isolated in its own module so the route logic tests with
// a mocked extractor and the API integration stays in one place.
//
// The API key comes EXCLUSIVELY from the ANTHROPIC_API_KEY Supabase secret
// (Deno.env) — never from the repo, the client, or the request. Missing key →
// typed error → the route answers 503; drafts are never fabricated.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { normalizeExtractedRows, type ExtractedRow } from './notepad_ingest.ts';

/** Raised when ANTHROPIC_API_KEY is not configured — routes map it to 503. */
export class VisionNotConfiguredError extends Error {
  constructor() {
    super('Vision extraction is not configured');
    this.name = 'VisionNotConfiguredError';
  }
}

/** Raised for problems the operator can fix (unsupported format, page too
 *  dense) — routes surface the message instead of the generic retry hint. */
export class VisionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisionInputError';
  }
}

const MODEL = 'claude-opus-4-8';

/** The image formats the vision API accepts. HEIC and friends must be
 *  converted client-side (the app does this) or re-taken as JPEG. */
const SUPPORTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Structured output schema: the model can only answer with rows in this
// shape, so the extraction is parseable by construction (no free-text JSON
// scraping). Keep in sync with ExtractedRow in notepad_ingest.ts.
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dog_name_as_written: {
            type: 'string',
            description: "The dog's name exactly as handwritten, including any surname initial",
          },
          date: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
            description: 'Explicit calendar date on the page for this row, as YYYY-MM-DD, else null',
          },
          weekday: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
            description: 'Weekday this row belongs to (column/heading), e.g. "Monday" or "Wed", else null',
          },
          session: {
            type: 'string',
            enum: ['full_day', 'half_day_am', 'half_day_pm'],
            description: 'Full day unless the page clearly marks a half day (AM/PM, ½, "morning", "afternoon")',
          },
          confidence: {
            type: 'number',
            description: 'How confidently this row was read, 0 to 1',
          },
          y_top: {
            anyOf: [{ type: 'number' }, { type: 'null' }],
            description: 'Approximate top of this handwritten row in the image, 0 (top) to 1 (bottom)',
          },
          y_bottom: {
            anyOf: [{ type: 'number' }, { type: 'null' }],
            description: 'Approximate bottom of this handwritten row in the image, 0 to 1',
          },
        },
        required: ['dog_name_as_written', 'date', 'weekday', 'session', 'confidence', 'y_top', 'y_bottom'],
        additionalProperties: false,
      },
    },
  },
  required: ['rows'],
  additionalProperties: false,
} as const;

const PROMPT = `This photo shows a handwritten page from a dog daycare owner's paper booking pad. Extract every intended daycare booking you can read.

Rules:
- One output row per dog per day. A dog listed under three day columns is three rows.
- dog_name_as_written must be the name EXACTLY as written (keep initials, spelling mistakes and all) — do not correct it to a name you think it should be.
- The page describes the week starting ${'{WEEK_START}'} (a Monday). If a row only has a weekday (column heading, "Mon", etc.), return that weekday and leave date null. Only set date when an explicit calendar date is written.
- session: full_day unless the writing clearly marks a half day — "AM", "morning", "½ AM" → half_day_am; "PM", "afternoon", "½ PM" → half_day_pm.
- confidence: how sure you are you read the row correctly (0..1). Use low values for scrawls you had to guess.
- y_top / y_bottom: the row's approximate vertical span in the image (0 = top edge, 1 = bottom edge), so a reviewer can find it.
- Ignore anything that is not a daycare booking (phone numbers, totals, doodles, crossed-out lines).`;

/**
 * Extract the structured booking rows from one page photo. Returns validated
 * rows only — anything the model produced that fails validation is dropped.
 */
export async function extractNotepadRows(args: {
  imageBase64: string;
  mediaType: string;
  weekStart: string;
}): Promise<ExtractedRow[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new VisionNotConfiguredError();
  if (!SUPPORTED_MEDIA_TYPES.has(args.mediaType)) {
    throw new VisionInputError(
      `Unsupported image format (${args.mediaType || 'unknown'}) — use a JPEG or PNG photo`,
    );
  }

  const client = new Anthropic({ apiKey });
  // Streamed (a dense two-page spread produces a lot of rows — a large
  // max_tokens needs streaming to dodge HTTP timeouts) with adaptive
  // thinking at medium effort: transcription doesn't need deep reasoning,
  // and lower effort keeps the call inside the edge gateway's clock.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: args.mediaType as 'image/jpeg',
              data: args.imageBase64,
            },
          },
          { type: 'text', text: PROMPT.replace('{WEEK_START}', args.weekStart) },
        ],
      },
    ],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === 'refusal') {
    throw new Error('Vision extraction was declined');
  }
  if (response.stop_reason === 'max_tokens') {
    // Truncated JSON would fail to parse anyway — fail with a reason the
    // operator can act on (split the page across two photos).
    throw new VisionInputError('The page is too dense to read in one go — photograph it in two halves');
  }

  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
  return normalizeExtractedRows(JSON.parse(text));
}
