import * as React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { palette, profileNeutralStroke, radius, themeSurface, typography } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
};

export default function TextField({
  label,
  containerStyle,
  style,
  multiline,
  placeholderTextColor,
  ...rest
}: Props) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[typography.caption, styles.label, { color: surface.textMuted }]}>{label}</Text>
      ) : null}
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={placeholderTextColor ?? surface.textMuted}
        style={[
          typography.body,
          styles.input,
          multiline && styles.inputMultiline,
          {
            color: surface.textPrimary,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.field,
            borderColor: isDark ? palette.chromeHairline : profileNeutralStroke(0.14),
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
});
