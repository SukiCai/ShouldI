import { router } from 'expo-router';
import * as React from 'react';
import { Alert, Keyboard, Pressable, Text, View } from 'react-native';

import { AuthCredentialFields } from '@/components/auth/AuthCredentialFields';
import { AuthFields, GenZAuthChrome } from '@/components/auth/GenZAuthChrome';
import { HERO_SIGNUP_AVATARS } from '@/constants/users/avatarSources';

export default function SignUpScreen() {
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  function onContinue() {
    Keyboard.dismiss();
    Alert.alert(
      'Sign up preview',
      'Auth wires up soon — this flow now matches the calm core experience.',
      [{ text: 'OK' }],
    );
  }

  return (
    <GenZAuthChrome
      appearance="mist"
      heroAvatars={HERO_SIGNUP_AVATARS}
      headline={"Make your next decision with calm clarity."}
      heroBadge="SHOULDI"
      footerCtaLabel="Sign Up"
      footerCtaAccessibilityLabel="Sign up"
      swipeAlternate={{ pathname: '/sign-in', direction: 'up' }}
      scrollBottomPad={56}
      onFooterPress={onContinue}
      sheetHeader={
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
