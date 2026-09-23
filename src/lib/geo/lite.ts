import raw from "@/data/countries-lite.json";

export interface CountryLite {
  iso2: string;
  iso3: string;
  num: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
}

export const COUNTRIES: CountryLite[] = raw as CountryLite[];
export const BY_ISO2: Record<string, CountryLite> = Object.fromEntries(COUNTRIES.map((c) => [c.iso2, c]));
export const BY_NUM: Record<string, CountryLite> = Object.fromEntries(COUNTRIES.filter((c) => c.num).map((c) => [String(Number(c.num)), c]));
export const REGIONS: string[] = [...new Set(COUNTRIES.map((c) => c.region))].sort();

export function countryName(iso2: string): string {
  return BY_ISO2[iso2]?.name ?? iso2;
}
