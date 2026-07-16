import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthFields } from '@/components/auth/GenZAuthChrome';
import { pmfText, usePmfSurface } from '@/components/screen/pmfChrome';
import TextField from '@/components/ui/TextField';
import { semantic } from '@/constants/theme';

type Props = {
  phone: string;
  onPhoneChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
};

function formatUsPhoneDigits(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 10);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 10);
  if (!d.length) return '';
  if (d.length <= 3) return `(${p1}`;
  if (d.length <= 6) return `(${p1}) ${p2}`;
  return `(${p1}) ${p2}-${p3}`;
}

async function vibe() {
  try {
    if (Platform.OS === 'ios') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* optional */
  }
}

export function AuthCredentialFields({
  phone,
  onPhoneChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
}: Props) {
  const surface = usePmfSurface();
  const text = pmfText(surface);
  const [phoneFocus, setPhoneFocus] = React.useState(false);

  return (
    <View style={styles.block}>
      <View style={AuthFields.phoneRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Country code United States plus one"
          style={({ pressed }) => [
            AuthFields.countryPill,
            (pressed || phoneFocus) ? AuthFields.controlFocused : null,
          ]}
          onPress={() => void vibe().then(() => Alert.alert('Country picker', 'More regions ship soon.'))}>
          <Text style={AuthFields.countryEmoji}>🇺🇸</Text>
          <Text style={AuthFields.countryCode}>+1</Text>
          <Ionicons name="chevron-down" size={17} color={surface.textMuted} />
        </Pressable>

        <View
          style={[
            AuthFields.inputPill,
            phoneFocus ? AuthFields.controlFocused : null,
            styles.phoneShell,
          ]}>
          <TextField
            value={phone}
            placeholder="––– ––– ––––"
            onChangeText={(raw) => onPhoneChange(formatUsPhoneDigits(raw))}
            keyboardType="phone-pad"
            autoCorrect={false}
            accessibilityLabel="Phone number"
            onFocus={() => {
              void vibe();
              setPhoneFocus(true);
            }}
            onBlur={() => setPhoneFocus(false)}
            selectionColor={`${semantic.actionPrimary}c4`}
            containerStyle={styles.phoneFieldInner}
            style={[AuthFields.pwdInput, styles.phoneInput, { letterSpacing: phone.trim() ? 0.35 : 1.2 }]}
          />
        </View>
      </View>

      <View style={[AuthFields.inputPill, styles.passwordShell]}>
        <View style={AuthFields.pwdRow}>
          <TextField
            value={password}
            placeholder="Password"
            onChangeText={onPasswordChange}
            secureTextEntry={!showPassword}
            accessibilityLabel="Password"
            autoCorrect={false}
            autoCapitalize="none"
            selectionColor={`${semantic.actionPrimary}c4`}
            containerStyle={styles.passwordField}
            style={[AuthFields.pwdInput, styles.passwordInput]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={10}
            onPress={() => {
              void vibe();
              onToggleShowPassword();
            }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={surface.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 14,
    marginTop: 4,
    marginBottom: 4,
    pointerEvents: 'auto',
  },
  phoneShell: {
    flex: 1,
    marginBottom: 0,
  },
  phoneFieldInner: {
    marginBottom: 0,
  },
  phoneInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    minHeight: 50,
  },
  passwordShell: {
    marginBottom: 0,
  },
  passwordField: {
    flex: 1,
    marginBottom: 0,
  },
  passwordInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    minHeight: 50,
  },
});
