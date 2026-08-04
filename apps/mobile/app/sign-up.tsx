import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AuthPasswordField,
  AuthPhoneField,
  phoneDigitsValid,
} from '@/components/auth/AuthCredentialFields';
import { AuthSocialSignInRow } from '@/components/auth/AuthSocialSignInRow';
import { AuthFields, GenZAuthChrome } from '@/components/auth/GenZAuthChrome';
import { DEFAULT_DIAL_COUNTRY, findDialCountry } from '@/constants/auth/dialCountries';
import { signUp, toE164 } from '@/lib/auth';
import { HERO_SIGNUP_AVATARS } from '@/constants/users/avatarSources';
import { palette, typography } from '@/constants/theme';

type SignUpStep = 'phone' | 'password';

const SIGN_UP_ERROR_MESSAGES: Record<string, string> = {
  PHONE_TAKEN: 'That phone number already has an account — sign in instead.',
  INVALID_PHONE: 'Enter a valid phone number.',
  WEAK_PASSWORD: 'Use at least 6 characters.',
};

function resolveReturnTo(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'string' && value.startsWith('/')) return value;
  return '/explore';
}

export default function SignUpScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = resolveReturnTo(returnToParam);
  const [step, setStep] = React.useState<SignUpStep>('phone');
  const [phone, setPhone] = React.useState('');
  const [countryIso, setCountryIso] = React.useState(DEFAULT_DIAL_COUNTRY.iso);
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const country = findDialCountry(countryIso);

  async function finishSignup(provider: 'phone' | 'apple' | 'google' = 'phone') {
    if (submitting) return;
    Keyboard.dismiss();
    if (provider !== 'phone') {
      Alert.alert('Coming soon', `Sign up with ${provider === 'apple' ? 'Apple' : 'Google'} isn’t available yet — use a phone number for now.`);
      return;
    }
    if (password.trim().length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp(toE164(phone, country), password);
      router.replace(returnTo as '/explore');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      Alert.alert('Couldn’t create account', SIGN_UP_ERROR_MESSAGES[code] ?? 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function onFooterPress() {
    if (step === 'phone') {
      if (!phoneDigitsValid(phone, country)) {
        Alert.alert('Phone number', `Enter a valid ${country.minDigits}-digit phone number.`);
        return;
      }
      Keyboard.dismiss();
      setStep('password');
      return;
    }
    void finishSignup('phone');
  }

  return (
    <GenZAuthChrome
      appearance="oled"
      heroAvatars={HERO_SIGNUP_AVATARS}
      headline={"Let's create your account!"}
      heroBadge="SHOULDI"
      heroMotion="standard"
      ctaPlacement="docked"
      footerCtaLabel={step === 'phone' ? 'Continue' : 'Create account'}
      footerCtaAccessibilityLabel={step === 'phone' ? 'Continue to password' : 'Create account'}
      swipeAlternate={{ pathname: '/sign-in', direction: 'up' }}
      onFooterPress={onFooterPress}
      sheetHeader={
        <View style={AuthFields.sheetHeaderStack}>
          <View style={AuthFields.linkRowWrap}>
            <Text style={AuthFields.muted}>Already have an account?</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Go to Sign in"
              onPress={() => router.replace('/sign-in')}
              hitSlop={12}>
              <Text style={AuthFields.boldLink}>Sign in</Text>
            </Pressable>
          </View>
          {step === 'password' ? (
            <View style={styles.phoneSummaryRow}>
              <Text style={AuthFields.sheetLead}>
                {country.dial} {phone}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit phone number"
                hitSlop={8}
                onPress={() => setStep('phone')}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }>
      {step === 'phone' ? (
        <>
          <AuthSocialSignInRow
            mode="sign-up"
            onProviderPress={(provider) => finishSignup(provider)}
          />
          <AuthPhoneField
            phone={phone}
            onPhoneChange={setPhone}
            countryIso={countryIso}
            onCountryIsoChange={setCountryIso}
          />
        </>
      ) : (
        <AuthPasswordField
          password={password}
          onPasswordChange={setPassword}
          showPassword={showPassword}
          onToggleShowPassword={() => setShowPassword((v) => !v)}
        />
      )}
    </GenZAuthChrome>
  );
}

const styles = StyleSheet.create({
  phoneSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  editLink: {
    ...typography.compact,
    fontWeight: '800',
    color: palette.heroInk,
  },
});
