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
import { radius, themeSurface, typography } from '@/constants/theme';

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
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f2f2f7',
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(60,60,67,0.18)',
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
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
});
