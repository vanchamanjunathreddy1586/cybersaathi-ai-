import { z } from 'zod';

export const scanTypes = ['url', 'sms', 'email', 'qr'] as const;
export type ScanType = (typeof scanTypes)[number];

const emailMetadataSchema = z.object({
  sender: z.string().trim().max(320).optional(),
  replyTo: z.string().trim().max(320).optional(),
  subject: z.string().trim().max(500).optional(),
  headers: z.string().max(8_000).optional(),
}).strict();

export const scanRequestSchema = z.object({
  type: z.enum(scanTypes),
  content: z.string().trim().min(1).max(8_000),
  metadata: emailMetadataSchema.optional(),
  allowExternalChecks: z.boolean().default(false),
}).strict().superRefine((request, context) => {
  if (request.type === 'email' && request.metadata === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['metadata'],
      message: 'Email scans require email fields.',
    });
  }
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

export const historyQuerySchema = z.object({
  type: z.enum(scanTypes).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
}).strict();

export const scanFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  source: z.string().min(1),
  verified: z.boolean(),
  points: z.number().int().min(0).max(100),
});

export type ScanFinding = z.infer<typeof scanFindingSchema>;
