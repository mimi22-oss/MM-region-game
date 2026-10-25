export type DownloadPhase = 'idle' | 'queued' | 'downloading' | 'downloaded' | 'error';
export type RegionDownload<T> = {
  id: string;
  name: string;
  phase: DownloadPhase;
  value?: T;
};

/** One import at a time. Foreground requests move ahead of queued prefetches. */
export class RegionDownloadQueue<T> {
  private snapshot: RegionDownload<T>[];
  private listeners = new Set<() => void>();
  private pending: string[] = [];
  private running = false;
  private definitions: { id: string; name: string; load: () => Promise<T> }[];

  constructor(definitions: { id: string; name: string; load: () => Promise<T> }[]) {
    this.definitions = definitions;
    this.snapshot = definitions.map(({ id, name }) => ({ id, name, phase: 'idle' }));
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  request(ids: string[], foreground = false) {
    const requested: string[] = [];
    for (const id of new Set(ids)) {
      const entry = this.snapshot.find(item => item.id === id);
      if (!entry || !['idle', 'queued'].includes(entry.phase)) continue;
      requested.push(id);
    }
    this.pending = foreground
      ? [...requested, ...this.pending.filter(id => !requested.includes(id))]
      : [...this.pending, ...requested.filter(id => !this.pending.includes(id))];
    if (requested.length) {
      if (this.snapshot.some(entry => entry.phase === 'idle' && requested.includes(entry.id))) {
        this.snapshot = this.snapshot.map(entry => entry.phase === 'idle' && requested.includes(entry.id)
          ? { ...entry, phase: 'queued' } : entry);
        this.emit();
      }
      void this.pump();
    }
  }

  private emit() { this.listeners.forEach(listener => listener()); }
  private update(id: string, change: Partial<RegionDownload<T>>) {
    this.snapshot = this.snapshot.map(entry => entry.id === id ? { ...entry, ...change } : entry);
    this.emit();
  }
  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        const id = this.pending.shift()!;
        this.update(id, { phase: 'downloading' });
        try {
          const value = await this.definitions.find(entry => entry.id === id)!.load();
          this.update(id, { phase: 'downloaded', value });
        } catch {
          this.update(id, { phase: 'error' });
        }
      }
    } finally { this.running = false; }
  }
}

export type RegionLoadingItem = {
  id: string;
  name: string;
  phase: DownloadPhase | 'waiting-render' | 'rendering' | 'ready';
};
export type WorldLoadingState = {
  blocking: boolean;
  required: RegionLoadingItem[];
  downloads: RegionLoadingItem[];
};
export type WorldDestination = {
  x: number;
  z: number;
  seq: number;
  distance?: number;
  pitch?: number;
};
