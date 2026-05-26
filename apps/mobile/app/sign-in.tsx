import { router } from 'expo-router';
import * as React from 'react';
import { Alert, Keyboard, Pressable, Text, View } from 'react-native';

import { AuthCredentialFields } from '@/components/auth/AuthCredentialFields';
import { AuthFields, GenZAuthChrome } from '@/components/auth/GenZAuthChrome';
import { HERO_AVATAR_CLUSTER } from '@/constants/users/avatarSources';

export default function SignInScreen() {
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  function onContinue() {
    Keyboard.dismiss();
    Alert.alert(
      'Sign in preview',
      'Auth wires up soon — matches the OLED reference layout.',
      [{ text: 'OK' }],
    );
  }

  return (
    <GenZAuthChrome
      appearance="oled"
      heroAvatars={HERO_AVATAR_CLUSTER}
      headline={"AI can answer. Humans validate."}
      heroBadge="SHOULDI"
      footerCtaLabel="Sign In"
      footerCtaAccessibilityLabel="Sign in"
      swipeAlternate={{ pathname: '/sign-up', direction: 'down' }}
      scrollBottomPad={56}
      onFooterPress={onContinue}
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
        password={password}
        onPasswordChange={setPassword}
        showPassword={showPassword}
        onToggleShowPassword={() => setShowPassword((v) => !v)}
      />
    </GenZAuthChrome>
  );
}
