import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tabScreenStyles as styles } from './tabScreenStyles';

type TabScreenHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  textDisplay: string;
  textMuted: string;
  groupedSurface: string;
  hairline: string;
  textPrimary: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  blockStyle?: StyleProp<ViewStyle>;
};

export function TabScreenHeader({
  title,
  subtitle,
  textDisplay,
  textMuted,
  action,
  children,
  blockStyle,
}: TabScreenHeaderProps) {
  return (
    <View style={[styles.headerBlock, blockStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: textDisplay }]}>{title}</Text>
          {subtitle != null ? (
            typeof subtitle === 'string' ? (
              <Text style={[styles.subtitle, { color: textMuted }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

type TabHeaderIconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  groupedSurface: string;
  hairline: string;
  iconColor: string;
  disabled?: boolean;
  iconSize?: number;
};

export function TabHeaderIconButton({
  icon,
  accessibilityLabel,
  onPress,
  groupedSurface,
  hairline,
  iconColor,
  disabled,
  iconSize = 20,
}: TabHeaderIconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconCircle,
        { backgroundColor: groupedSurface, borderColor: hairline },
        disabled && { opacity: 0.35 },
        pressed && !disabled && { opacity: 0.85 },
      ]}>
      <Ionicons name={icon} size={iconSize} color={iconColor} />
    </Pressable>
  );
}
