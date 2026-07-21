import { router } from 'expo-router';
import * as React from 'react';

import SegmentControl from '@/components/ui/SegmentControl';
import { usePmfSurface } from '@/components/screen/pmfChrome';

export type AuthMode = 'sign-in' | 'sign-up';

type Props = {
  mode: AuthMode;
};

/** Sign in / Sign up — bouncy track toggle at top of auth sheet. */
export function AuthModeSegment({ mode }: Props) {
  const surface = usePmfSurface();

  return (
    <SegmentControl
      options={[
        { value: 'sign-in', label: 'Sign In', accessibilityLabel: 'Sign in to your account' },
        { value: 'sign-up', label: 'Sign Up', accessibilityLabel: 'Create a new account' },
      ]}
      value={mode}
      onChange={(next) => {
        if (next === mode) return;
        router.replace(next === 'sign-in' ? '/sign-in' : '/sign-up');
      }}
      surface={surface}
    />
  );
}
