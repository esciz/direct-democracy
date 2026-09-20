// These two registry entries call the same first-party adapter and use the
// same native ID namespace. Never infer shared identity from a display name.
export const SHARED_SOS_SOURCE_SLUGS = [
  "nevada-secretary-of-state-elections",
  "nevada-secretary-of-state-candidate-filings",
] as const;

type IdentityRecord = { id: string; sourceId: string | null; externalId: string | null; jurisdictionId: string | null };
type IdentityDelegate = {
  findMany(args: unknown): Promise<IdentityRecord[]>;
  findUnique(args: unknown): Promise<IdentityRecord | null>;
};
const identitySelect = { id: true, sourceId: true, externalId: true, jurisdictionId: true };

export async function resolveSourceImportWhere(model: unknown, input: {
  sourceId: string; sharedSourceIds: string[]; externalId: string; jurisdictionId?: string; slug?: string;
}): Promise<{ id: string } | { sourceId_externalId: { sourceId: string; externalId: string } }> {
  const nativeWhere = { sourceId_externalId: { sourceId: input.sourceId, externalId: input.externalId } };
  const sourceIds = [...new Set([input.sourceId, ...input.sharedSourceIds])];
  if (sourceIds.length === 1) return nativeWhere;
  const delegate = model as IdentityDelegate;
  const matches = await delegate.findMany({
    where: { sourceId: { in: sourceIds }, externalId: input.externalId }, select: identitySelect, take: 2,
  });
  if (matches.length > 1) throw new Error(`shared_source_identity_ambiguous:${input.externalId}`);
  const existing = matches[0];
  if (existing && input.jurisdictionId && existing.jurisdictionId !== input.jurisdictionId) {
    throw new Error(`shared_source_identity_jurisdiction_conflict:${input.externalId}`);
  }
  if (input.slug) {
    const owner = await delegate.findUnique({ where: { slug: input.slug }, select: identitySelect });
    // A slug alone is not proof, even if it is already used by a related feed.
    if (owner && owner.id !== existing?.id) throw new Error(`shared_source_identity_slug_conflict:${input.slug}`);
  }
  // Updating by ID preserves the existing sourceId/externalId. The caller's
  // tracked-import path still records the observing feed and reviews changes.
  return existing ? { id: existing.id } : nativeWhere;
}
