import * as React from 'react';
import { StyleSheet, View } from 'react-native';

/** Same pastel luma ladder as `GenZAuthChrome` OLED hero — luminous dots on #000. */
export const OLED_LUMA_PINK = '#ffb2e8';
export const OLED_LUMA_SKY = '#93edff';
export const OLED_LUMA_MINT = '#7fffd0';
export const OLED_LUMA_LIME = '#e4f299';
export const OLED_LUMA_VIOLET = '#e4d9ff';
export const OLED_LUMA_TEAL = '#70d8c6';

type OledSpeck = { k: string; z: number; c: string } & (
  | { left: `${number}%`; top: `${number}%` }
  | { right: `${number}%`; top: `${number}%` }
  | { left: `${number}%`; bottom: `${number}%` }
  | { right: `${number}%`; bottom: `${number}%` }
);

const OLED_FLUOR_SPECKS: readonly OledSpeck[] = [
  { k: 'a', z: 7, c: OLED_LUMA_PINK, left: '8%', top: '12%' },
  { k: 'b', z: 5, c: OLED_LUMA_SKY, left: '5%', top: '34%' },
  { k: 'c', z: 6, c: OLED_LUMA_MINT, right: '10%', top: '11%' },
  { k: 'd', z: 4, c: OLED_LUMA_LIME, right: '6%', top: '29%' },
  { k: 'e', z: 8, c: OLED_LUMA_SKY, left: '13%', top: '50%' },
  { k: 'f', z: 5, c: OLED_LUMA_VIOLET, left: '7%', bottom: '42%' },
  { k: 'g', z: 6, c: OLED_LUMA_MINT, right: '12%', bottom: '34%' },
  { k: 'h', z: 4, c: OLED_LUMA_PINK, right: '8%', bottom: '14%' },
  { k: 'i', z: 5, c: OLED_LUMA_TEAL, left: '24%', bottom: '22%' },
];

/** Field of tiny pastel pixels behind OLED chrome — paired with `#000` (`sign-up`, `appearance="oled"`). */
export function OledFluorSpeckles() {
  return (
    <View style={styles.layer} pointerEvents="none">
      {OLED_FLUOR_SPECKS.map((s) => {
        const { k, z, c, ...pos } = s;
        const r = z / 2;
        return (
          <View
            key={k}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.dot,
              pos,
              {
                width: z,
                height: z,
                borderRadius: r,
                backgroundColor: c,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
  },
});
