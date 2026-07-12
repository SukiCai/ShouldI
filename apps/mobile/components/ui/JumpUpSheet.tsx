/**
 * Shared bottom sheet with spring slide-up + dimmed backdrop.
 * Use for modals, paywalls, rosters, and thread expansions across the app.
 */
import * as React from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  MOTION,
  SHEET_BOTTOM_BLEED,
  useJumpUpMotion,
} from '@/constants/motion';
import { radius } from '@/constants/theme';

export {
  JUMP_UP_BACKDROP_MS,
  JUMP_UP_SPRING,
  MOTION,
  SHEET_BOTTOM_BLEED,
  SHEET_SLIDE_OFFSET,
  useJumpUpMotion,
  usePrefersReducedMotion,
} from '@/constants/motion';

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
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
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
