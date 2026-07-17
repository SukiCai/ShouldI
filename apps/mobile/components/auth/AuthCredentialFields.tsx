import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthFields } from '@/components/auth/GenZAuthChrome';
import JumpUpSheet from '@/components/ui/JumpUpSheet';
import TextField from '@/components/ui/TextField';
import {
  DEFAULT_DIAL_COUNTRY,
  DIAL_COUNTRIES,
  findDialCountry,
  type DialCountry,
} from '@/constants/auth/dialCountries';
import { MOTION } from '@/constants/motion';
import { selection } from '@/lib/haptics';
import { semantic, themeSurface, typography } from '@/constants/theme';

export function formatUsPhoneDigits(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 10);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 10);
  if (!d.length) return '';
  if (d.length <= 3) return `(${p1}`;
  if (d.length <= 6) return `(${p1}) ${p2}`;
  return `(${p1}) ${p2}-${p3}`;
}

export function formatNationalPhoneDigits(input: string, country: DialCountry): string {
  const d = input.replace(/\D/g, '').slice(0, country.maxDigits);
  if (country.iso === 'US' || country.iso === 'CA') return formatUsPhoneDigits(d);
  return d;
}

export function phoneDigitsValid(phone: string, country: DialCountry = DEFAULT_DIAL_COUNTRY): boolean {
  const len = phone.replace(/\D/g, '').length;
  return len >= country.minDigits && len <= country.maxDigits;
}

function vibe() {
  selection();
}

function FocusShell({
  focused,
  style,
  children,
}: {
  focused: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.012 : 1, MOTION.segmentPop);
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

type PhoneProps = {
  phone: string;
  onPhoneChange: (v: string) => void;
  countryIso?: string;
  onCountryIsoChange?: (iso: string) => void;
};

export function AuthPhoneField({
  phone,
  onPhoneChange,
  countryIso = DEFAULT_DIAL_COUNTRY.iso,
  onCountryIsoChange,
}: PhoneProps) {
  /** Light ink on light gray pills / picker — OLED dark tokens wash out placeholders. */
  const fieldInk = themeSurface('light');
  const picker = fieldInk;
  const insets = useSafeAreaInsets();
  const [phoneFocus, setPhoneFocus] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const country = findDialCountry(countryIso);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DIAL_COUNTRIES;
    return DIAL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.iso.toLowerCase().includes(q),
    );
  }, [query]);

  function selectCountry(next: DialCountry) {
    vibe();
    onCountryIsoChange?.(next.iso);
    onPhoneChange(formatNationalPhoneDigits(phone, next));
    setPickerOpen(false);
    setQuery('');
  }

  return (
    <>
      <View style={AuthFields.phoneRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Country code ${country.name} ${country.dial}`}
          style={({ pressed }) => [
            AuthFields.countryPill,
            pressed || phoneFocus || pickerOpen ? AuthFields.controlFocused : null,
          ]}
          onPress={() => {
            vibe();
            setPickerOpen(true);
          }}>
          <Text style={AuthFields.countryEmoji}>{country.flag}</Text>
          <Text style={AuthFields.countryCode}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={17} color={fieldInk.textMuted} />
        </Pressable>

        <FocusShell
          focused={phoneFocus}
          style={[
            AuthFields.inputPill,
            phoneFocus ? AuthFields.controlFocused : null,
            styles.phoneShell,
          ]}>
          <TextField
            value={phone}
            placeholder="--- --- ----"
            placeholderTextColor={fieldInk.textMuted}
            onChangeText={(raw) => onPhoneChange(formatNationalPhoneDigits(raw, country))}
            keyboardType="phone-pad"
            autoCorrect={false}
            accessibilityLabel="Phone number"
            onFocus={() => {
              vibe();
              setPhoneFocus(true);
            }}
            onBlur={() => setPhoneFocus(false)}
            selectionColor={`${semantic.actionPrimary}c4`}
            containerStyle={styles.phoneFieldInner}
            style={[
              AuthFields.pwdInput,
              styles.phoneInput,
              {
                color: fieldInk.textPrimary,
                letterSpacing: phone.trim() ? 0.8 : 1.6,
              },
            ]}
          />
        </FocusShell>
      </View>

      <JumpUpSheet
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setQuery('');
        }}
        backgroundColor={picker.sheet}
        borderTopColor={picker.hairline}
        bottomInset={insets.bottom}
        maxHeight="58%"
        cardStyle={styles.pickerCard}
        grabColor="rgba(15,17,21,0.16)"
        dismissAccessibilityLabel="Close country picker">
        <View style={styles.pickerBody}>
          <Text style={[styles.pickerTitle, { color: picker.textDisplay }]}>Country / region</Text>
          <View style={[styles.searchShell, { backgroundColor: picker.groupedSurface }]}>
            <Ionicons name="search" size={18} color={picker.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or code"
              placeholderTextColor={picker.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search countries"
              style={[styles.searchInput, { color: picker.textPrimary }]}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.iso}
            keyboardShouldPersistTaps="handled"
            style={styles.pickerList}
            contentContainerStyle={styles.pickerListContent}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: picker.textMuted }]}>No matches</Text>
            }
            renderItem={({ item }) => {
              const selected = item.iso === country.iso;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.name} ${item.dial}`}
                  onPress={() => selectCountry(item)}
                  style={({ pressed }) => [
                    styles.countryRow,
                    selected && styles.countryRowSelected,
                    pressed && styles.countryRowPressed,
                  ]}>
                  <Text style={styles.rowFlag}>{item.flag}</Text>
                  <Text style={[styles.rowName, { color: picker.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rowDial, { color: picker.textMuted }]}>{item.dial}</Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={20} color={semantic.actionPrimary} />
                  ) : (
                    <View style={styles.checkSpacer} />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </JumpUpSheet>
    </>
  );
}

type PasswordProps = {
  password: string;
  onPasswordChange: (v: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
};

export function AuthPasswordField({
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
}: PasswordProps) {
  const fieldInk = themeSurface('light');
  const [passwordFocus, setPasswordFocus] = React.useState(false);

  return (
    <FocusShell focused={passwordFocus} style={[AuthFields.inputPill, styles.passwordShell]}>
      <View style={AuthFields.pwdRow}>
        <TextField
          value={password}
          placeholder="Password"
          placeholderTextColor={fieldInk.textMuted}
          onChangeText={onPasswordChange}
          secureTextEntry={!showPassword}
          accessibilityLabel="Password"
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => {
            vibe();
            setPasswordFocus(true);
          }}
          onBlur={() => setPasswordFocus(false)}
          selectionColor={`${semantic.actionPrimary}c4`}
          containerStyle={styles.passwordField}
          style={[
            AuthFields.pwdInput,
            styles.passwordInput,
            { color: fieldInk.textPrimary },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          hitSlop={10}
          onPress={() => {
            vibe();
            onToggleShowPassword();
          }}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={fieldInk.textMuted} />
        </Pressable>
      </View>
    </FocusShell>
  );
}

type Props = PhoneProps & PasswordProps;

export function AuthCredentialFields(props: Props) {
  return (
    <View style={styles.block}>
      <AuthPhoneField
        phone={props.phone}
        onPhoneChange={props.onPhoneChange}
        countryIso={props.countryIso}
        onCountryIsoChange={props.onCountryIsoChange}
      />
      <AuthPasswordField
        password={props.password}
        onPasswordChange={props.onPasswordChange}
        showPassword={props.showPassword}
        onToggleShowPassword={props.onToggleShowPassword}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 12,
    marginTop: 2,
    marginBottom: 0,
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
    // Pill shell owns horizontal inset so --- --- ---- / Password align.
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
  pickerCard: {
    marginHorizontal: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 10,
    overflow: 'hidden',
  },
  pickerBody: {
    paddingHorizontal: 16,
    paddingTop: 2,
    gap: 10,
    flex: 1,
    minHeight: 260,
  },
  pickerTitle: {
    ...typography.titleSm,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    ...typography.compact,
    paddingVertical: 10,
  },
  pickerList: {
    flexGrow: 0,
    maxHeight: 320,
  },
  pickerListContent: {
    paddingBottom: 8,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  countryRowSelected: {
    backgroundColor: 'rgba(15,17,21,0.06)',
  },
  countryRowPressed: {
    opacity: 0.75,
  },
  rowFlag: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  rowName: {
    ...typography.compact,
    fontWeight: '600',
    flex: 1,
  },
  rowDial: {
    ...typography.compact,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'right',
  },
  checkSpacer: {
    width: 20,
  },
  empty: {
    ...typography.compact,
    textAlign: 'center',
    paddingVertical: 28,
  },
});
