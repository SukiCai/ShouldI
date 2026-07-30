import { Ionicons } from '@expo/vector-icons';
import type { ExploreFeedResponse } from '@shouldi/contracts';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { palette, profileTypography, radius, typography } from '@/constants/theme';

type ExploreFeedCard = ExploreFeedResponse['cards'][number];

type ExploreOverlapDeckProps = {
  cards: ExploreFeedCard[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onCardPress?: (index: number) => void;
};

export default function ExploreOverlapDeck({
  cards,
  activeIndex,
  onActiveIndexChange,
  onCardPress,
}: ExploreOverlapDeckProps) {
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const listRef = React.useRef<FlatList<ExploreFeedCard>>(null);
  const cardWidth = Math.min(320, Math.max(248, width * 0.7));
  const gap = 12;
  const snap = cardWidth + gap;
  const sidePeek = Math.max(20, (width - cardWidth) / 2);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fn = AccessibilityInfo.isReduceMotionEnabled;
        if (typeof fn === 'function') {
          const value = await fn();
          if (!cancelled) setReduceMotion(value);
        }
      } catch {
        // no-op
      }
    })();
    let sub: { remove: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    } catch {
      // no-op
    }
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  React.useEffect(() => {
    if (cards.length === 0) return;
    listRef.current?.scrollToOffset({
      offset: Math.max(0, activeIndex) * snap,
      animated: true,
    });
  }, [activeIndex, cards.length, snap]);

  const handleMomentumEnd = React.useCallback(
    (x: number) => {
      const next = Math.round(x / snap);
      if (next === activeIndex) return;
      onActiveIndexChange(next);
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      }
    },
    [activeIndex, onActiveIndexChange, snap],
  );

  const renderItem = React.useCallback(
    ({ item, index }: { item: ExploreFeedCard; index: number }) => {
      const inputRange = [(index - 1) * snap, index * snap, (index + 1) * snap];
      const rotateY = scrollX.interpolate({
        inputRange,
        outputRange: reduceMotion ? ['0deg', '0deg', '0deg'] : ['12deg', '0deg', '-12deg'],
        extrapolate: 'clamp',
      });
      const scale = scrollX.interpolate({
        inputRange,
        outputRange: reduceMotion ? [0.95, 1, 0.95] : [0.87, 1, 0.87],
        extrapolate: 'clamp',
      });
      const translateY = scrollX.interpolate({
        inputRange,
        outputRange: reduceMotion ? [6, 0, 6] : [14, 0, 14],
        extrapolate: 'clamp',
      });
      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.58, 1, 0.58],
        extrapolate: 'clamp',
      });
      const glowOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.18, 0.5, 0.18],
        extrapolate: 'clamp',
      });
      const pinkGlowOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.08, 0.32, 0.08],
        extrapolate: 'clamp',
      });
      const votes = item.distribution.reduce((sum, row) => sum + row.votes, 0);
      const isActive = index === activeIndex;

      return (
        <View style={[styles.itemWrap, { width: snap }]}>
          <Animated.View
            style={[
              styles.glowBack,
              {
                width: cardWidth,
                opacity: glowOpacity,
                transform: [{ translateY: 20 }, { scale: 1.04 }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.glowBackPink,
              {
                width: cardWidth * 0.88,
                opacity: pinkGlowOpacity,
                transform: [{ translateY: -18 }, { scale: 1.02 }],
              },
            ]}
          />
          <Animated.View
            style={{
              width: cardWidth,
              opacity,
              transform: [{ perspective: 900 }, { rotateY }, { translateY }, { scale }],
            }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Focus card ${index + 1}. ${item.question}`}
              onPress={() => {
                onCardPress?.(index);
                if (Platform.OS !== 'web') {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                }
              }}
              style={({ pressed }) => [
                styles.card,
                isActive && styles.cardActive,
                pressed && styles.cardPressed,
              ]}>
              <View style={styles.topRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.category.toUpperCase()}</Text>
                </View>
                <View style={styles.votesPill}>
                  <Ionicons name="sparkles" size={12} color={palette.neonPink} />
                  <Text style={styles.votesText}>{votes.toLocaleString()}</Text>
                </View>
              </View>
              <Text
                style={styles.question}
                numberOfLines={3}
                ellipsizeMode="tail">
                {item.question}
              </Text>
              <View style={styles.bottomHint}>
                <Text style={styles.bottomHintText}>{isActive ? 'Now live below' : 'Swipe to focus'}</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      );
    },
    [activeIndex, cardWidth, onCardPress, reduceMotion, scrollX, snap],
  );

  if (cards.length === 0) return null;

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        horizontal
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate={Platform.OS === 'ios' ? 0.92 : 0.9}
        snapToInterval={snap}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: sidePeek }}
        getItemLayout={(_, index) => ({
          length: snap,
          offset: snap * index,
          index,
        })}
        onMomentumScrollEnd={(e) => handleMomentumEnd(e.nativeEvent.contentOffset.x)}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 12,
    marginBottom: 10,
  },
  itemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glowBack: {
    position: 'absolute',
    height: 190,
    borderRadius: radius.hero,
    backgroundColor: `${palette.neonSky}33`,
  },
  glowBackPink: {
    position: 'absolute',
    height: 170,
    borderRadius: radius.hero,
    backgroundColor: `${palette.neonPink}3a`,
  },
  card: {
    minHeight: 190,
    borderRadius: radius.hero,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(125,125,145,0.24)',
    justifyContent: 'space-between',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#071124',
        shadowOpacity: 0.13,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 9 },
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  cardActive: {
    borderColor: `${palette.neonPink}95`,
  },
  cardPressed: {
    opacity: 0.92,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: `${palette.neonSky}20`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.neonSky}60`,
  },
  badgeText: {
    ...typography.micro,
    color: profileTypography.emphasis,
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  votesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.neonPink}52`,
  },
  votesText: {
    ...typography.label,
    color: profileTypography.body,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  question: {
    ...typography.bodySm,
    color: profileTypography.ink,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bottomHint: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: `${palette.heroInk}08`,
  },
  bottomHintText: {
    ...typography.caption,
    color: profileTypography.subdued,
    fontWeight: '700',
  },
});
