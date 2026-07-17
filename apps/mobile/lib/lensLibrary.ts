import type { DiscoveredExpert, ExpertCatalogEntry } from '@shouldi/contracts';
import { ExpertCatalogResponseSchema as CatalogSchema } from '@shouldi/contracts';

export type LensDomain = ExpertCatalogEntry['lensDomain'];

export type LensTier = 'locked' | 'discovered' | 'applied' | 'calibrated';

export type LensSlot = {
  expertId: string;
  catalog: ExpertCatalogEntry;
  tier: LensTier;
  discovered?: DiscoveredExpert;
};

export type LensDomainGroup = {
  domain: Exclude<LensDomain, 'general'>;
  label: string;
  encountered: number;
  total: number;
  slots: LensSlot[];
};

export type LensLibraryView = {
  overallEncountered: number;
  overallTotal: number;
  groups: LensDomainGroup[];
};

const DOMAIN_LABELS: Record<Exclude<LensDomain, 'general'>, string> = {
  career: 'Career lenses',
  relationship: 'Relationship lenses',
};

const DOMAIN_ORDER: Array<Exclude<LensDomain, 'general'>> = ['career', 'relationship'];

function tierFromDiscovery(row?: DiscoveredExpert): LensTier {
  if (!row) return 'locked';
  if (row.status === 'calibrated') return 'calibrated';
  if (row.status === 'applied') return 'applied';
  return 'discovered';
}

export function buildLensLibrary(
  catalog: ExpertCatalogEntry[],
  discovered: DiscoveredExpert[],
): LensLibraryView {
  const discoveredById = new Map(discovered.map((row) => [row.expertId, row]));
  const collectible = catalog.filter((entry) => entry.lensDomain !== 'general');

  const groups = DOMAIN_ORDER.map((domain) => {
    const entries = collectible.filter((entry) => entry.lensDomain === domain);
    const slots: LensSlot[] = entries.map((entry) => {
      const row = discoveredById.get(entry.id);
      return {
        expertId: entry.id,
        catalog: entry,
        tier: tierFromDiscovery(row),
        discovered: row,
      };
    });

    const encountered = slots.filter((slot) => slot.tier !== 'locked').length;
    const showSilhouettes = encountered > 0;

    return {
      domain,
      label: DOMAIN_LABELS[domain],
      encountered,
      total: entries.length,
      slots: showSilhouettes ? slots : slots.filter((slot) => slot.tier !== 'locked'),
    };
  }).filter((group) => group.total > 0);

  const overallTotal = collectible.length;
  const overallEncountered = collectible.filter((entry) => discoveredById.has(entry.id)).length;

  return {
    overallEncountered,
    overallTotal,
    groups,
  };
}

export function parseCatalogResponse(data: unknown): ExpertCatalogEntry[] {
  return CatalogSchema.parse(data).experts;
}

export function flattenLensSlots(library: LensLibraryView): LensSlot[] {
  const unlocked = library.groups
    .flatMap((group) => group.slots)
    .filter((slot) => slot.tier !== 'locked')
    .sort((a, b) => (b.discovered?.lastUsedAt ?? 0) - (a.discovered?.lastUsedAt ?? 0));
  const locked = library.groups
    .flatMap((group) => group.slots)
    .filter((slot) => slot.tier === 'locked');
  return [...unlocked, ...locked];
}

export function tierLabel(tier: LensTier): string {
  switch (tier) {
    case 'calibrated':
      return 'Calibrated';
    case 'applied':
      return 'Applied';
    case 'discovered':
      return 'Discovered';
    default:
      return 'Not yet encountered';
  }
}

export function tierAccent(tier: LensTier, expertColor: string): string {
  if (tier === 'calibrated') return '#2DD4BF';
  if (tier === 'applied') return '#38BDF8';
  if (tier === 'discovered') return expertColor;
  return 'rgba(120,120,128,0.35)';
}
