import { Injectable, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GifItem { id: string; url: string; preview: string; width: number; height: number; title: string }

// Busca de GIFs pelo GIPHY. A chave fica só no servidor (GIPHY_API_KEY);
// o navegador recebe apenas os links das imagens.
@Injectable()
export class GifsService {
  private cache = new Map<string, { at: number; items: GifItem[] }>();

  constructor(private config: ConfigService) {}

  private get key() { return this.config.get<string>('GIPHY_API_KEY', ''); }

  status() { return { enabled: !!this.key }; }

  async trending() { return this.fetch('trending', {}); }

  async search(q: string) {
    const term = typeof q === 'string' ? q.trim().slice(0, 50) : '';
    if (!term) throw new BadRequestException('Digite o que procura');
    return this.fetch('search', { q: term });
  }

  private async fetch(kind: 'trending' | 'search', params: Record<string, string>) {
    if (!this.key) throw new ServiceUnavailableException('GIFs ainda não configurados');
    const cacheKey = kind + ':' + (params.q || '').toLowerCase();
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.items;

    const qs = new URLSearchParams({ api_key: this.key, limit: '24', rating: 'pg-13', lang: 'pt', ...params });
    const res = await fetch(`https://api.giphy.com/v1/gifs/${kind}?${qs}`, { signal: AbortSignal.timeout(6000) })
      .catch(() => null);
    if (!res || !res.ok) throw new ServiceUnavailableException('Não foi possível buscar GIFs agora');
    const body: any = await res.json().catch(() => ({}));
    const items: GifItem[] = (body?.data || [])
      .map((g: any) => {
        const full = g?.images?.fixed_height || g?.images?.original;
        const small = g?.images?.fixed_height_small || full;
        return {
          id: String(g?.id || ''),
          url: String(full?.url || ''),
          preview: String(small?.url || full?.url || ''),
          width: Number(full?.width) || 200,
          height: Number(full?.height) || 200,
          title: String(g?.title || '').slice(0, 100),
        };
      })
      // Só links de imagem do próprio GIPHY (o chat também só exibe esses)
      .filter((g: GifItem) => isGiphyMedia(g.url) && isGiphyMedia(g.preview));

    if (this.cache.size > 300) this.cache.clear();
    this.cache.set(cacheKey, { at: Date.now(), items });
    return items;
  }
}

export function isGiphyMedia(url: string) {
  return /^https:\/\/(media\d?|i)\.giphy\.com\/[\w/.\-?=&%]+$/i.test(url);
}
