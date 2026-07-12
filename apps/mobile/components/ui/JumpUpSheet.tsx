/**
 * Shared bottom sheet with spring slide-up + dimmed backdrop.
 * Use for modals, paywalls, rosters, and thread expansions across the app.
 */
import * as React from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const JUMP_UP_SPRING = { friction: 8, tension: 72 } as const;
export const JUMP_UP_BACKDROP_MS = 220;
export const SHEET_SLIDE_OFFSET = 420;
/** Extra sheet height below the safe area so the slide-up never exposes the dim backdrop. */
export const SHEET_BOTTOM_BLEED = 56;

export function useJumpUpMotion(open: boolean) {
  const translateY = React.useRef(new Animated.Value(SHEET_SLIDE_OFFSET)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!open) return;
    translateY.setValue(SHEET_SLIDE_OFFSET);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: JUMP_UP_BACKDROP_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        ...JUMP_UP_SPRING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, open, translateY]);

  return { translateY, backdropOpacity };
}

export type JumpUpSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  backgroundColor: string;
  borderTopColor?: string;
  bottomInset?: number;
  maxHeight?: `${number}%` | number;
  showGrab?: boolean;
  grabColor?: string;
  cardStyle?: StyleProp<ViewStyle>;
  dismissAccessibilityLabel?: string;
};

export default function JumpUpSheet({
  visible,
  onClose,
  children,
  backgroundColor,
  borderTopColor,
  bottomInset = 0,
  maxHeight = '78%',
  showGrab = true,
  grabColor,
  cardStyle,
  dismissAccessibilityLabel = 'Dismiss',
}: JumpUpSheetProps) {
  const motion = useJumpUpMotion(visible);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[styles.backdropDim, { opacity: motion.backdropOpacity }]}>
          <Pressable
            style={styles.backdropPress}
            accessibilityRole="button"
            accessibilityLabel={dismissAccessibilityLabel}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor,
              borderTopColor: borderTopColor ?? 'transparent',
              paddingBottom: bottomInset + 16 + SHEET_BOTTOM_BLEED,
              marginBottom: -SHEET_BOTTOM_BLEED,
              maxHeight,
              transform: [{ translateY: motion.translateY }],
            },
            cardStyle,
          ]}>
          {showGrab ? (
            <View style={[styles.grab, grabColor ? { backgroundColor: grabColor } : null]} />
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  backdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  backdropPress: {
    flex: 1,
  },
  card: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 0,
  },
  grab: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
    marginTop: 4,
    backgroundColor: 'rgba(15,23,42,0.18)',
  },
});
