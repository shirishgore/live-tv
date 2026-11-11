export type Channel = {
  id: string;
  name: string;
  logo: string | null;
  country: string;
  countryName: string;
  category: string;
  /** Derived from `category` ([category]); kept so cards can render chips. */
  categories: string[];
  language: string | null;
  quality: string | null;
  streamCount: number;
  streams?: string[];
};

export type ListStatus = 'watchlist' | 'planned' | 'completed';
