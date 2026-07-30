import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Button from '@/components/ui/Button';
import { themeSurface, typography } from '@/constants/theme';

type Props = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  footer?: ReactNode;
};

export default function EmptyState({ title, body, actionLabel, onAction, footer }: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);

  return (
    <View style={styles.wrap}>
      <Text style={[typography.title, styles.title, { color: surface.textPrimary }]}>{title}</Text>
      {body ? (
        <Text style={[typography.body, styles.body, { color: surface.textMuted }]}>{body}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} accessibilityLabel={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  body: {
    textAlign: 'center',
    lineHeight: 23,
  },
  action: {
    marginTop: 8,
    minWidth: 160,
  },
});
