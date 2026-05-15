import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenContentGutter, themeSurface } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { OledFluorSpeckles } from '@/components/ui/OledSignUpBackdrop';

type ScreenProps = PropsWithChildren<ViewProps & { padded?: boolean; scroll?: boolean }>;

export default function Screen({ children, padded = true, scroll = false, style, ...rest }: ScreenProps) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
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
    <ScrollView
      contentInsetAdjustmentBehavior="always"
      showsVerticalScrollIndicator={false}
      /** Lets horizontal lanes inside profile (and similar) scroll reliably on Android. */
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scrollBody}>
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <SafeAreaView
      {...rest}
      edges={['left', 'right']}
      style={[styles.outer, { backgroundColor: surface.canvas }, padded && styles.horizontalPad, style]}
    >
      <View pointerEvents="none" style={styles.signUpBackdrop}>
        <OledFluorSpeckles />
      </View>
      <View style={[styles.contentLayer, inset]}>{content}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    paddingHorizontal: 0,
  },
  signUpBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  contentLayer: {
    flex: 1,
    zIndex: 1,
  },
  horizontalPad: {
    paddingHorizontal: screenContentGutter,
  },
  paddedNoTop: {
    flex: 1,
    gap: 10,
    paddingVertical: 8,
  },
  /** Scroll content grows with children; padding keeps last row clear of the tab bar. */
  scrollBody: {
    flexGrow: 1,
    paddingBottom: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
});
