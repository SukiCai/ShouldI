import { Text, type TextProps } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { themeSurface, typography } from '@/constants/theme';

type AppTextProps = TextProps & {
  tone?: 'primary' | 'muted' | 'display';
};

function useTextColor(tone: AppTextProps['tone']) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  if (tone === 'display') return surface.textDisplay;
  if (tone === 'muted') return surface.textMuted;
  return surface.textPrimary;
}

export function Eyebrow({ style, tone = 'muted', ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        typography.caption,
        { color: useTextColor(tone), fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}

export function Title({ style, tone = 'display', ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography.title, { color: useTextColor(tone), fontWeight: '700' }, style]} />;
}

export function Hero({ style, tone = 'display', ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography.hero, { color: useTextColor(tone), fontWeight: '800' }, style]} />;
}

export function Body({ style, tone = 'primary', ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography.body, { color: useTextColor(tone) }, style]} />;
}

export function Caption({ style, tone = 'muted', ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography.caption, { color: useTextColor(tone) }, style]} />;
}

export function Subhead({ style, tone = 'primary', ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography.subhead, { color: useTextColor(tone) }, style]} />;
}

export function Label({ style, tone = 'muted', ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography.label, { color: useTextColor(tone) }, style]} />;
}

export function Micro({ style, tone = 'muted', ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography.micro, { color: useTextColor(tone) }, style]} />;
}
