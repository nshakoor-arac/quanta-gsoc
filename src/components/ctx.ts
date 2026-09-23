import type { Article, ScopeTarget, WindowKey } from "@/lib/types";
import type { Filters } from "@/lib/client/filters";

export interface Ctx {
  all: Article[];
  items: Article[];
  win: WindowKey;
  filters: Filters;
  setFilters: (f: Filters | ((p: Filters) => Filters)) => void;
  pinned: Article[];
  togglePin: (a: Article) => void;
  isPinned: (id: string) => boolean;
  open: (a: Article) => void;
  quickCountry: (iso2: string) => void;
  quickFeed: () => void;
  buildReport: (t: ScopeTarget) => void;
}
