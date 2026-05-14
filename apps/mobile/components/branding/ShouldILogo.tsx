import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { palette } from '@/constants/theme';

export type ShouldILogoMarkProps = {
  size?: number;
  style?: React.ComponentProps<typeof View>['style'];
};

/** Gradient squircle + fork; gradient uses accent + accentBloom from theme. */
export function ShouldILogoMark({ size = 24, style }: ShouldILogoMarkProps) {
  const gid = React.useId().replace(/:/g, '');
  const gradId = `si_logo_grad_${gid}`;
  const w = Math.max(8, Math.round(size));
  const vb = 24;

  const hub = vb / 2;
  const hubColor = palette.mint;
  const forkStroke = 'rgba(253,254,255,0.92)';
  const outline = 'rgba(255,255,255,0.35)';

  return (
    <View style={[style, { width: w, height: w }]} pointerEvents="none" accessibilityElementsHidden>
      <Svg width={w} height={w} viewBox={`0 0 ${vb} ${vb}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={palette.accent} />
            <Stop offset="100%" stopColor={palette.accentBloom} />
          </LinearGradient>
        </Defs>
        <Rect
          x={1}
          y={1}
          width={vb - 2}
          height={vb - 2}
          rx={7.5}
          ry={7.5}
          fill={`url(#${gradId})`}
          stroke={outline}
          strokeWidth={0.5}
        />
        <Path d={`M ${hub} 17.15 L ${hub} 14.08`} fill="none" stroke={forkStroke} strokeWidth={2} strokeLinecap="round" />
        <Path d={`M ${hub} 14.08 Q 10.5 12.35 7.25 10.15`} fill="none" stroke={forkStroke} strokeWidth={2} strokeLinecap="round" />
        <Path d={`M ${hub} 14.08 Q 13.5 12.35 ${vb - 7.25} 10.15`} fill="none" stroke={forkStroke} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={hub} cy={14.08} r={2.12} fill={hubColor} stroke={forkStroke} strokeWidth={0.38} />
      </Svg>
    </View>
  );
}
