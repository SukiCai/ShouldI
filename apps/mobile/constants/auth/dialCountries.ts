export type DialCountry = {
  iso: string;
  name: string;
  flag: string;
  dial: string;
  /** National number length (digits only), used for input cap + light validation. */
  maxDigits: number;
  minDigits: number;
};

/** Curated dial list for auth — common markets first, then A–Z. */
export const DIAL_COUNTRIES: DialCountry[] = [
  { iso: 'US', name: 'United States', flag: '🇺🇸', dial: '+1', maxDigits: 10, minDigits: 10 },
  { iso: 'CA', name: 'Canada', flag: '🇨🇦', dial: '+1', maxDigits: 10, minDigits: 10 },
  { iso: 'GB', name: 'United Kingdom', flag: '🇬🇧', dial: '+44', maxDigits: 11, minDigits: 10 },
  { iso: 'CN', name: 'China', flag: '🇨🇳', dial: '+86', maxDigits: 11, minDigits: 11 },
  { iso: 'HK', name: 'Hong Kong', flag: '🇭🇰', dial: '+852', maxDigits: 8, minDigits: 8 },
  { iso: 'TW', name: 'Taiwan', flag: '🇹🇼', dial: '+886', maxDigits: 10, minDigits: 9 },
  { iso: 'JP', name: 'Japan', flag: '🇯🇵', dial: '+81', maxDigits: 11, minDigits: 10 },
  { iso: 'KR', name: 'South Korea', flag: '🇰🇷', dial: '+82', maxDigits: 11, minDigits: 9 },
  { iso: 'SG', name: 'Singapore', flag: '🇸🇬', dial: '+65', maxDigits: 8, minDigits: 8 },
  { iso: 'AU', name: 'Australia', flag: '🇦🇺', dial: '+61', maxDigits: 9, minDigits: 9 },
  { iso: 'NZ', name: 'New Zealand', flag: '🇳🇿', dial: '+64', maxDigits: 10, minDigits: 8 },
  { iso: 'IN', name: 'India', flag: '🇮🇳', dial: '+91', maxDigits: 10, minDigits: 10 },
  { iso: 'DE', name: 'Germany', flag: '🇩🇪', dial: '+49', maxDigits: 12, minDigits: 10 },
  { iso: 'FR', name: 'France', flag: '🇫🇷', dial: '+33', maxDigits: 9, minDigits: 9 },
  { iso: 'ES', name: 'Spain', flag: '🇪🇸', dial: '+34', maxDigits: 9, minDigits: 9 },
  { iso: 'IT', name: 'Italy', flag: '🇮🇹', dial: '+39', maxDigits: 11, minDigits: 9 },
  { iso: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '+31', maxDigits: 9, minDigits: 9 },
  { iso: 'SE', name: 'Sweden', flag: '🇸🇪', dial: '+46', maxDigits: 10, minDigits: 9 },
  { iso: 'NO', name: 'Norway', flag: '🇳🇴', dial: '+47', maxDigits: 8, minDigits: 8 },
  { iso: 'DK', name: 'Denmark', flag: '🇩🇰', dial: '+45', maxDigits: 8, minDigits: 8 },
  { iso: 'CH', name: 'Switzerland', flag: '🇨🇭', dial: '+41', maxDigits: 9, minDigits: 9 },
  { iso: 'IE', name: 'Ireland', flag: '🇮🇪', dial: '+353', maxDigits: 10, minDigits: 9 },
  { iso: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '+351', maxDigits: 9, minDigits: 9 },
  { iso: 'BR', name: 'Brazil', flag: '🇧🇷', dial: '+55', maxDigits: 11, minDigits: 10 },
  { iso: 'MX', name: 'Mexico', flag: '🇲🇽', dial: '+52', maxDigits: 10, minDigits: 10 },
  { iso: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '+54', maxDigits: 11, minDigits: 10 },
  { iso: 'CL', name: 'Chile', flag: '🇨🇱', dial: '+56', maxDigits: 9, minDigits: 9 },
  { iso: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '+57', maxDigits: 10, minDigits: 10 },
  { iso: 'PH', name: 'Philippines', flag: '🇵🇭', dial: '+63', maxDigits: 10, minDigits: 10 },
  { iso: 'TH', name: 'Thailand', flag: '🇹🇭', dial: '+66', maxDigits: 9, minDigits: 9 },
  { iso: 'VN', name: 'Vietnam', flag: '🇻🇳', dial: '+84', maxDigits: 10, minDigits: 9 },
  { iso: 'MY', name: 'Malaysia', flag: '🇲🇾', dial: '+60', maxDigits: 10, minDigits: 9 },
  { iso: 'ID', name: 'Indonesia', flag: '🇮🇩', dial: '+62', maxDigits: 12, minDigits: 9 },
  { iso: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', dial: '+971', maxDigits: 9, minDigits: 9 },
  { iso: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dial: '+966', maxDigits: 9, minDigits: 9 },
  { iso: 'IL', name: 'Israel', flag: '🇮🇱', dial: '+972', maxDigits: 9, minDigits: 9 },
  { iso: 'TR', name: 'Turkey', flag: '🇹🇷', dial: '+90', maxDigits: 10, minDigits: 10 },
  { iso: 'ZA', name: 'South Africa', flag: '🇿🇦', dial: '+27', maxDigits: 9, minDigits: 9 },
  { iso: 'NG', name: 'Nigeria', flag: '🇳🇬', dial: '+234', maxDigits: 10, minDigits: 10 },
  { iso: 'EG', name: 'Egypt', flag: '🇪🇬', dial: '+20', maxDigits: 10, minDigits: 10 },
  { iso: 'PL', name: 'Poland', flag: '🇵🇱', dial: '+48', maxDigits: 9, minDigits: 9 },
  { iso: 'RU', name: 'Russia', flag: '🇷🇺', dial: '+7', maxDigits: 10, minDigits: 10 },
  { iso: 'UA', name: 'Ukraine', flag: '🇺🇦', dial: '+380', maxDigits: 9, minDigits: 9 },
];

export const DEFAULT_DIAL_COUNTRY =
  DIAL_COUNTRIES.find((c) => c.iso === 'US') ?? DIAL_COUNTRIES[0];

export function findDialCountry(iso: string): DialCountry {
  return DIAL_COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_DIAL_COUNTRY;
}
