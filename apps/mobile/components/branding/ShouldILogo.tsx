import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { palette } from '@/constants/theme';

export type ShouldILogoMarkProps = {
  size?: number;
  style?: React.ComponentProps<typeof View>['style'];
};

/** OLED squircle + tricolor fork hub (matches assets/brand/logo-mark.svg raster pipeline). */
export function ShouldILogoMark({ size = 24, style }: ShouldILogoMarkProps) {
  const gid = React.useId().replace(/:/g, '');
  const rimId = `si_logo_rim_${gid}`;
  const faceId = `si_logo_face_${gid}`;
  const w = Math.max(8, Math.round(size));
  const vb = 24;

  const hub = vb / 2;
  const cy = 14.18;

  return (
    <View style={[style, { width: w, height: w }]} pointerEvents="none" accessibilityElementsHidden>
      <Svg width={w} height={w} viewBox={`0 0 ${vb} ${vb}`}>
        <Defs>
          <LinearGradient id={rimId} x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={palette.neonMint} />
            <Stop offset="50%" stopColor={palette.neonSky} />
            <Stop offset="100%" stopColor={palette.neonPink} />
          </LinearGradient>
          <RadialGradient id={faceId} cx="50%" cy="40%" r="72%" gradientUnits="objectBoundingBox">
            <Stop offset="0%" stopColor={palette.nightWash} />
            <Stop offset="100%" stopColor="#000000" />
          </RadialGradient>
        </Defs>
        <Rect
          x={1}
          y={1}
          width={vb - 2}
          height={vb - 2}
          rx={8.25}
          ry={8.25}
          fill={`url(#${faceId})`}
          stroke={`url(#${rimId})`}
          strokeWidth={0.5}
        />
        <Path d={`M ${hub} 17.08 L ${hub} ${cy}`} stroke={palette.neonPink} strokeWidth={1.9} strokeLinecap="round" />
        <Path
          d={`M ${hub} ${cy} Q 10.42 12.38 7.05 10.08`}
          fill="none"
          stroke={palette.neonMint}
          strokeWidth={1.9}
          strokeLinecap="round"
        />
        <Path
          d={`M ${hub} ${cy} Q 13.58 12.38 16.95 10.08`}
          fill="none"
          stroke={palette.neonSky}
          strokeWidth={1.9}
          strokeLinecap="round"
        />
        <Circle
          cx={hub}
          cy={cy}
          r={2.08}
          fill="#fdfefe"
          stroke={palette.neonMint}
          strokeWidth={0.38}
          strokeOpacity={0.95}
        />
      </Svg>
    </View>
  );
}
