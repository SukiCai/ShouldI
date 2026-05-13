import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/theme';

type ScreenProps = PropsWithChildren<ViewProps & { padded?: boolean; scroll?: boolean }>;

export default function Screen({ children, padded = true, scroll = false, style, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inset = padded
    ? [
        styles.paddedNoTop,
        {
          paddingTop: Math.max(12, insets.top + 4),
          paddingBottom: Math.max(12, insets.bottom + 8),
        },
      ]
    : undefined;
  const content = scroll ? (
    <ScrollView contentInsetAdjustmentBehavior="always" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <SafeAreaView {...rest} edges={['left', 'right']} style={[styles.outer, padded && styles.horizontalPad, style]}>
      <View style={inset}>{content}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: palette.mist,
    paddingHorizontal: 0,
  },
  horizontalPad: {
    paddingHorizontal: 20,
  },
  paddedNoTop: {
    flex: 1,
    gap: 10,
    paddingVertical: 8,
  },
});
