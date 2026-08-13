import axios from 'axios';
import logger from './log/winston.log';

type LogoBank = {
  name: string;
  slug: string;
  code: string;
  logo?: string;
};

let cache: { at: number; byCode: Map<string, string>; bySlug: Map<string, string> } | null = null;
const CACHE_MS = 24 * 60 * 60 * 1000;

function usableLogo(url?: string) {
  return !!url && !url.includes('default-image');
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function loadCatalog() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const response = await axios.get<LogoBank[]>('https://nigerianbanks.xyz', { timeout: 8000 });
    const byCode = new Map<string, string>();
    const bySlug = new Map<string, string>();
    for (const bank of response.data ?? []) {
      if (!usableLogo(bank.logo)) continue;
      if (bank.code) byCode.set(normalize(bank.code), bank.logo!);
      if (bank.slug) bySlug.set(normalize(bank.slug), bank.logo!);
    }
    cache = { at: Date.now(), byCode, bySlug };
  } catch (error: any) {
    logger.warn('Could not load bank logo catalog', { error: error?.message });
    if (!cache) {
      cache = { at: Date.now(), byCode: new Map(), bySlug: new Map() };
    }
  }
  return cache;
}

export async function withBankLogos<T extends { name: string; code: string; slug: string }>(
  banks: T[]
): Promise<Array<T & { logo?: string }>> {
  const catalog = await loadCatalog();
  return banks.map((bank) => {
    const fromCode = catalog.byCode.get(normalize(bank.code));
    const fromSlug = catalog.bySlug.get(normalize(bank.slug));
    const fallback = bank.slug
      ? `https://nigerianbanks.xyz/logo/${bank.slug}.png`
      : undefined;
    return {
      ...bank,
      logo: fromCode || fromSlug || fallback,
    };
  });
}
