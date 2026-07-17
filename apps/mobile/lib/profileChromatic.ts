import { semantic } from '@/constants/theme';

export type ProfileStatTone = 'calibration' | 'followThrough';
export type ProfileGrowthTone = 'strength' | 'growth' | 'focus';

export function statChromatic(tone: ProfileStatTone) {
  switch (tone) {
    case 'calibration':
      return { iconColor: semantic.actionPrimary, iconBg: `${semantic.actionPrimary}18` };
    case 'followThrough':
      return { iconColor: semantic.actionAffirm, iconBg: `${semantic.actionAffirm}18` };
  }
}

export function growthChromatic(tone: ProfileGrowthTone) {
  switch (tone) {
    case 'strength':
      return { iconColor: semantic.actionAffirm, iconBg: `${semantic.actionAffirm}18` };
    case 'growth':
      return { iconColor: semantic.actionCaution, iconBg: `${semantic.actionCaution}18` };
    case 'focus':
      return { iconColor: semantic.actionPrimary, iconBg: `${semantic.actionPrimary}18` };
  }
}

export function dnaSummarySurfaceBg() {
  return `${semantic.actionPrimary}10`;
}
