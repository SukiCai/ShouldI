import { router, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { Alert, Keyboard, Pressable, Text, View } from 'react-native';

import { AuthCredentialFields, phoneDigitsValid } from '@/components/auth/AuthCredentialFields';
import { AuthFields, GenZAuthChrome } from '@/components/auth/GenZAuthChrome';
import { DEFAULT_DIAL_COUNTRY, findDialCountry } from '@/constants/auth/dialCountries';
import { markAuthenticatedPreview } from '@/lib/guestSignupPrompt';
import { HERO_AVATAR_CLUSTER } from '@/constants/users/avatarSources';

function resolveReturnTo(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'string' && value.startsWith('/')) return value;
  return '/explore';
}

export default function SignInScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = resolveReturnTo(returnToParam);
  const [phone, setPhone] = React.useState('');
  const [countryIso, setCountryIso] = React.useState(DEFAULT_DIAL_COUNTRY.iso);
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const country = findDialCountry(countryIso);

  async function onContinue() {
    Keyboard.dismiss();
    if (!phoneDigitsValid(phone, country)) {
      Alert.alert('Phone number', `Enter a valid ${country.minDigits}-digit phone number.`);
      return;
    }
    if (!password.trim()) {
      Alert.alert('Password', 'Enter your password.');
      return;
    }
    await markAuthenticatedPreview();
    Alert.alert('Signed in', 'Session preview — auth backend ships soon.', [
      {
        text: 'OK',
        onPress: () => router.replace(returnTo as '/explore'),
      },
    ]);
  }

  return (
    <GenZAuthChrome
      appearance="oled"
      heroAvatars={HERO_AVATAR_CLUSTER}
      headline={"Let's get you signed in!"}
      heroBadge="SHOULDI"
      heroMotion="standard"
      ctaPlacement="docked"
      footerCtaLabel="Sign In"
      footerCtaAccessibilityLabel="Sign in"
      swipeAlternate={{ pathname: '/sign-up', direction: 'down' }}
      onFooterPress={() => void onContinue()}
      sheetHeader={
        <View style={AuthFields.linkRowWrap}>
          <Text style={AuthFields.muted}>You don't have an account yet?</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Go to Sign up"
            onPress={() => router.replace('/sign-up')}
            hitSlop={12}>
            <Text style={AuthFields.boldLink}>Sign Up</Text>
          </Pressable>
        </View>
      }
      tertiaryRow={
        <View style={AuthFields.tertiaryCenter}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Forgot password"
            onPress={() => Alert.alert('Coming soon', 'Password recovery launches with login.')}>
            <Text style={AuthFields.tertiaryBold}>Forgot password?</Text>
          </Pressable>
        </View>
      }>
      <AuthCredentialFields
        phone={phone}
        onPhoneChange={setPhone}
        countryIso={countryIso}
        onCountryIsoChange={setCountryIso}
        password={password}
        onPasswordChange={setPassword}
        showPassword={showPassword}
        onToggleShowPassword={() => setShowPassword((v) => !v)}
      />
    </GenZAuthChrome>
  );
}
