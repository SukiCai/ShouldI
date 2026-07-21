import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind = 'none' | 'light' | 'medium' | 'selection' | 'success' | 'warning' | 'error';

async function impact(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(style);
  } catch {
    /* optional */
  }
}

async function notification(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(type);
  } catch {
    /* optional */
  }
}

export function fireHaptic(kind: HapticKind = 'light') {
  switch (kind) {
    case 'none':
      return;
    case 'light':
      void impact(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'medium':
      void impact(Haptics.ImpactFeedbackStyle.Medium);
      return;
    case 'selection':
      void impact(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'success':
      void notification(Haptics.NotificationFeedbackType.Success);
      return;
    case 'warning':
      void notification(Haptics.NotificationFeedbackType.Warning);
      return;
    case 'error':
      void notification(Haptics.NotificationFeedbackType.Error);
      return;
    default:
      void impact(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function tapLight() {
  fireHaptic('light');
}

export function tapMedium() {
  fireHaptic('medium');
}

export function selection() {
  fireHaptic('selection');
}

export function success() {
  fireHaptic('success');
}

export function warning() {
  fireHaptic('warning');
}

export function error() {
  fireHaptic('error');
}
