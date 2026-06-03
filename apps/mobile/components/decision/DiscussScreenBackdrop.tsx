import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { ReelCardAtmosphereLayers } from '@/components/explore/ReelDiscussChrome';
import { REEL_SURFACE_LOCATIONS } from '@/constants/reelSurfaceGradients';
import type { DecisionCategory } from '@shouldi/contracts';

type Props = {
  category: DecisionCategory;
  coarseGradient: readonly [string, string, string];
  children: React.ReactNode;
};

/** Coarse gradient + Explore atmosphere — same stack as decision Discuss screen. */
export function DiscussScreenBackdrop({ category, coarseGradient, children }: Props) {
  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={[...coarseGradient]}
        locations={[...REEL_SURFACE_LOCATIONS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.discussAtmospherePortal} pointerEvents="none">
        <ReelCardAtmosphereLayers category={category} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  discussAtmospherePortal: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
