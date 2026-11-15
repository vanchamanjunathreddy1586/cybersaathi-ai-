import { z } from 'zod';
import { getUserSupabaseClient } from '../../config/supabase.js';

export const evidenceBucket = 'investigation-evidence';
export const evidenceMaxBytes = 10 * 1024 * 1024;
export const evidenceMimeTypes = [
  'application/json',
  'application/pdf',
  'message/rfc822',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const investigationStatusSchema = z.enum(['open', 'in_progress', 'resolved']);
const investigationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(2_000),
  status: investigationStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
const eventSchema = z.object({
  id: z.string().uuid(),
  investigation_id: z.string().uuid(),
  event_type: z.enum(['created', 'updated', 'status_changed', 'note', 'evidence_added', 'evidence_removed']),
  summary: z.string().min(1).max(2_000),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
const evidenceSchema = z.object({
  id: z.string().uuid(),
  investigation_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  object_path: z.string().min(1).max(512),
  mime_type: z.enum(evidenceMimeTypes),
  size_bytes: z.number().int().positive().max(evidenceMaxBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.string(),
});

export type Investigation = z.infer<typeof investigationSchema>;
export type InvestigationEvent = z.infer<typeof eventSchema>;
export type InvestigationEvidence = z.infer<typeof evidenceSchema>;
export type InvestigationDetail = Investigation & {
  events: InvestigationEvent[];
  evidence: InvestigationEvidence[];
};

const titleSchema = z.string().trim().min(1).max(120);
const descriptionSchema = z.string().trim().max(2_000);
const noteSchema = z.string().trim().min(1).max(2_000);
const evidenceMetadataSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255)
    .refine((value) => !/[\\/\u0000-\u001f\u007f]/.test(value), 'File name is invalid.'),
  objectPath: z.string().min(1).max(512),
  mimeType: z.enum(evidenceMimeTypes),
  sizeBytes: z.number().int().positive().max(evidenceMaxBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

function requireData<T>(data: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error('INVALID_INVESTIGATION_DATA');
  return parsed.data;
}

export async function listInvestigations(
  accessToken: string,
): Promise<Investigation[]> {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client
    .from('investigations')
    .select('id, user_id, title, description, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('INVESTIGATION_LIST_UNAVAILABLE');
  return requireData(data, z.array(investigationSchema));
}

export async function getInvestigation(
  accessToken: string,
  investigationId: string,
): Promise<InvestigationDetail | null> {
  const client = getUserSupabaseClient(accessToken);
  const { data: row, error: caseError } = await client
    .from('investigations')
    .select('id, user_id, title, description, status, created_at, updated_at')
    .eq('id', investigationId)
    .maybeSingle();
  if (caseError) throw new Error('INVESTIGATION_DETAIL_UNAVAILABLE');
  if (!row) return null;

  const [eventResult, evidenceResult] = await Promise.all([
    client.from('investigation_events')
      .select('id, investigation_id, event_type, summary, metadata, created_at')
      .eq('investigation_id', investigationId)
      .order('created_at', { ascending: true })
      .limit(250),
    client.from('investigation_evidence')
      .select('id, investigation_id, file_name, object_path, mime_type, size_bytes, sha256, created_at')
      .eq('investigation_id', investigationId)
      .order('created_at', { ascending: true })
      .limit(100),
  ]);
  if (eventResult.error || evidenceResult.error) {
    throw new Error('INVESTIGATION_DETAIL_UNAVAILABLE');
  }

  return {
    ...requireData(row, investigationSchema),
    events: requireData(eventResult.data, z.array(eventSchema)),
    evidence: requireData(evidenceResult.data, z.array(evidenceSchema)),
  };
}

export async function createInvestigation(
  accessToken: string,
  userId: string,
  input: { title: string; description: string },
): Promise<Investigation> {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client
    .from('investigations')
    .insert({
      user_id: userId,
      title: titleSchema.parse(input.title),
      description: descriptionSchema.parse(input.description),
    })
    .select('id, user_id, title, description, status, created_at, updated_at')
    .single();
  if (error) throw new Error('INVESTIGATION_CREATE_FAILED');
  return requireData(data, investigationSchema);
}

export async function updateInvestigation(
  accessToken: string,
  investigationId: string,
  input: {
    title?: string | undefined;
    description?: string | undefined;
    status?: z.infer<typeof investigationStatusSchema> | undefined;
  },
): Promise<Investigation | null> {
  const client = getUserSupabaseClient(accessToken);
  const patch = {
    ...(input.title !== undefined ? { title: titleSchema.parse(input.title) } : {}),
    ...(input.description !== undefined ? { description: descriptionSchema.parse(input.description) } : {}),
    ...(input.status !== undefined ? { status: investigationStatusSchema.parse(input.status) } : {}),
  };
  const { data, error } = await client
    .from('investigations')
    .update(patch)
    .eq('id', investigationId)
    .select('id, user_id, title, description, status, created_at, updated_at')
    .maybeSingle();
  if (error) throw new Error('INVESTIGATION_UPDATE_FAILED');
  return data ? requireData(data, investigationSchema) : null;
}

export async function deleteInvestigation(
  accessToken: string,
  investigationId: string,
): Promise<boolean> {
  const client = getUserSupabaseClient(accessToken);
  const { data: evidenceRows, error: evidenceError } = await client
    .from('investigation_evidence')
    .select('object_path')
    .eq('investigation_id', investigationId);
  if (evidenceError) throw new Error('INVESTIGATION_DELETE_FAILED');

  if (evidenceRows.length > 0) {
    const { error: storageError } = await client.storage
      .from(evidenceBucket)
      .remove(evidenceRows.map((row) => row.object_path));
    if (storageError) throw new Error('INVESTIGATION_EVIDENCE_DELETE_FAILED');
  }

  const { data, error } = await client
    .from('investigations')
    .delete()
    .eq('id', investigationId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('INVESTIGATION_DELETE_FAILED');
  return data !== null;
}

export async function addInvestigationNote(
  accessToken: string,
  userId: string,
  investigationId: string,
  summary: string,
): Promise<InvestigationEvent | null> {
  const client = getUserSupabaseClient(accessToken);
  const { data, error } = await client
    .from('investigation_events')
    .insert({
      user_id: userId,
      investigation_id: investigationId,
      event_type: 'note',
      summary: noteSchema.parse(summary),
      metadata: {},
    })
    .select('id, investigation_id, event_type, summary, metadata, created_at')
    .maybeSingle();
  if (error) throw new Error('INVESTIGATION_NOTE_FAILED');
  return data ? requireData(data, eventSchema) : null;
}

export async function addInvestigationEvidence(
  accessToken: string,
  userId: string,
  investigationId: string,
  input: z.input<typeof evidenceMetadataSchema>,
): Promise<InvestigationEvidence | null> {
  const metadata = evidenceMetadataSchema.parse(input);
  const expectedPath = `${userId}/${investigationId}/${metadata.id}`;
  if (metadata.objectPath !== expectedPath) {
    throw new Error('INVALID_EVIDENCE_PATH');
  }

  const client = getUserSupabaseClient(accessToken);
  const { error: storageError } = await client.storage
    .from(evidenceBucket)
    .createSignedUrl(metadata.objectPath, 30);
  if (storageError) throw new Error('EVIDENCE_OBJECT_NOT_FOUND');

  const { data, error } = await client
    .from('investigation_evidence')
    .insert({
      id: metadata.id,
      investigation_id: investigationId,
      user_id: userId,
      file_name: metadata.fileName,
      object_path: metadata.objectPath,
      mime_type: metadata.mimeType,
      size_bytes: metadata.sizeBytes,
      sha256: metadata.sha256,
    })
    .select('id, investigation_id, file_name, object_path, mime_type, size_bytes, sha256, created_at')
    .maybeSingle();
  if (error) throw new Error('INVESTIGATION_EVIDENCE_SAVE_FAILED');
  return data ? requireData(data, evidenceSchema) : null;
}

export async function deleteInvestigationEvidence(
  accessToken: string,
  investigationId: string,
  evidenceId: string,
): Promise<boolean> {
  const client = getUserSupabaseClient(accessToken);
  const { data: evidence, error: getError } = await client
    .from('investigation_evidence')
    .select('object_path')
    .eq('id', evidenceId)
    .eq('investigation_id', investigationId)
    .maybeSingle();
  if (getError) throw new Error('INVESTIGATION_EVIDENCE_DELETE_FAILED');
  if (!evidence) return false;

  const { error: storageError } = await client.storage
    .from(evidenceBucket)
    .remove([evidence.object_path]);
  if (storageError) throw new Error('INVESTIGATION_EVIDENCE_DELETE_FAILED');

  const { data, error } = await client
    .from('investigation_evidence')
    .delete()
    .eq('id', evidenceId)
    .eq('investigation_id', investigationId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('INVESTIGATION_EVIDENCE_DELETE_FAILED');
  return data !== null;
}
