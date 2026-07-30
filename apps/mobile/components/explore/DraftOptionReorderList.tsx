import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { exploreDecisionCardStyles as styles } from '@/components/explore/exploreDecisionCardStyles';
import type { ExploreCardOption } from '@/components/explore/ExploreDecisionCard';
import type { ThemeSurface } from '@/constants/theme';

const ROW_HEIGHT = 80;

type Props = {
  options: ExploreCardOption[];
  aiSuggestedOptionId: string;
  ghostPct: number;
  canRemoveOption: boolean;
  surface: ThemeSurface;
  onChangeOptionLabel(optionId: string, label: string): void;
  onSelectAiLean(optionId: string): void;
  onRemoveOption(optionId: string): void;
  onReorderOptions(options: ExploreCardOption[]): void;
};

function hapticDrag() {
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }
}

type DraftOptionRowProps = {
  item: ExploreCardOption;
  index: number;
  total: number;
  aiLean: boolean;
  ghostPct: number;
  canRemoveOption: boolean;
  surface: ThemeSurface;
  onChangeOptionLabel(optionId: string, label: string): void;
  onSelectAiLean(optionId: string): void;
  onRemoveOption(optionId: string): void;
  onMove(fromIndex: number, toIndex: number): void;
};

function DraftOptionRow({
  item,
  index,
  total,
  aiLean,
  ghostPct,
  canRemoveOption,
  surface,
  onChangeOptionLabel,
  onSelectAiLean,
  onRemoveOption,
  onMove,
}: DraftOptionRowProps) {
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(false);

  const commitReorder = React.useCallback(
    (fromIndex: number, translationY: number) => {
      const offset = Math.round(translationY / ROW_HEIGHT);
      const toIndex = Math.min(total - 1, Math.max(0, fromIndex + offset));
      if (toIndex !== fromIndex) {
        onMove(fromIndex, toIndex);
      }
    },
    [onMove, total],
  );

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          dragging.value = true;
          runOnJS(hapticDrag)();
        })
        .onUpdate((event) => {
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          dragging.value = false;
          runOnJS(commitReorder)(index, event.translationY);
          translateY.value = withSpring(0);
        })
        .onFinalize(() => {
          dragging.value = false;
          translateY.value = withSpring(0);
        }),
    [commitReorder, dragging, index, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: dragging.value ? 2 : 0,
    opacity: dragging.value ? 0.96 : 1,
    elevation: dragging.value ? 2 : 0,
    shadowOpacity: dragging.value ? 0.08 : 0,
    shadowRadius: dragging.value ? 8 : 0,
    shadowOffset: { width: 0, height: dragging.value ? 2 : 0 },
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View style={[styles.rowLineDraft, aiLean && styles.rowLineAiLean]}>
        {canRemoveOption ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.label || 'option'}`}
            hitSlop={8}
            onPress={() => onRemoveOption(item.id)}
            style={({ pressed }) => [styles.removeOptionBtn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="remove-circle-outline" size={18} color={surface.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.sideIconSpacer} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Set ShouldI lean to ${item.label || 'option'}`}
          accessibilityState={{ selected: aiLean }}
          onPress={() => onSelectAiLean(item.id)}
          style={styles.rowBody}>
          <View style={styles.rowHead}>
            <TextInput
              value={item.label}
              onChangeText={(text) => onChangeOptionLabel(item.id, text)}
              placeholder="Option label"
              placeholderTextColor={surface.textMuted}
              style={[styles.rowLabelInput, { color: surface.textPrimary }]}
            />
            {aiLean ? (
              <View
                style={[
                  styles.suggestedTag,
                  { borderColor: surface.groupedBorder, backgroundColor: surface.canvas },
                ]}>
                <Text style={[styles.suggestedTagText, { color: surface.textMuted }]}>Suggested</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.track, { backgroundColor: surface.hairline }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, ghostPct)}%`,
                  backgroundColor: surface.textMuted,
                  opacity: 0.35,
                },
              ]}
            />
          </View>
        </Pressable>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityRole="button"
            accessibilityLabel={`Drag to reorder ${item.label || 'option'}`}
            style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={20} color={surface.textMuted} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

export function DraftOptionReorderList({
  options,
  aiSuggestedOptionId,
  ghostPct,
  canRemoveOption,
  surface,
  onChangeOptionLabel,
  onSelectAiLean,
  onRemoveOption,
  onReorderOptions,
}: Props) {
  const moveOption = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = [...options];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      onReorderOptions(next);
    },
    [onReorderOptions, options],
  );

  return (
    <View style={styles.rows}>
      {options.map((item, index) => (
        <DraftOptionRow
          key={item.id}
          item={item}
          index={index}
          total={options.length}
          aiLean={item.id === aiSuggestedOptionId}
          ghostPct={ghostPct}
          canRemoveOption={canRemoveOption}
          surface={surface}
          onChangeOptionLabel={onChangeOptionLabel}
          onSelectAiLean={onSelectAiLean}
          onRemoveOption={onRemoveOption}
          onMove={moveOption}
        />
      ))}
    </View>
  );
}
