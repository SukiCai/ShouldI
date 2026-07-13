import * as React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import type { ProfileDnaDimensionMock } from '@/lib/profileMockData';

type ProfileDnaRadarProps = {
  dimensions: ProfileDnaDimensionMock[];
  accentColor: string;
  gridColor: string;
  fillColor: string;
  labelColor: string;
  levelColor: string;
  compact?: boolean;
};

function polarPoint(cx: number, cy: number, radius: number, index: number, total: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

type LabelPlacement = {
  left: number;
  top: number;
  width: number;
  align: 'flex-start' | 'center' | 'flex-end';
};

function axisLabelPlacement(
  index: number,
  total: number,
  centerX: number,
  centerY: number,
  maxR: number,
  canvas: number,
  compact: boolean,
): LabelPlacement {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const labelHeight = compact ? 18 : 22;
  const gutter = compact ? 4 : 6;

  if (!compact) {
    const labelDistance = maxR + 34;
    const width = 76;
    const anchorX = centerX + dx * labelDistance;
    const anchorY = centerY + dy * labelDistance;
    let left = anchorX - width / 2;
    let top = anchorY - labelHeight / 2;
    let align: LabelPlacement['align'] = 'center';

    if (dy < -0.45) {
      top = anchorY - labelHeight - 2;
    } else if (dy > 0.45) {
      top = anchorY + 4;
    } else if (dx > 0.45) {
      left = anchorX + 6;
      align = 'flex-start';
    } else if (dx < -0.45) {
      left = anchorX - width - 6;
      align = 'flex-end';
    }

    return { left, top, width, align };
  }

  const ring = maxR + 5;
  const anchorY = centerY + dy * ring;

  if (dy < -0.6) {
    const width = compact ? 56 : 80;
    return {
      left: centerX - width / 2,
      top: gutter,
      width,
      align: 'center',
    };
  }

  if (dy > 0.6) {
    const width = compact ? 56 : 80;
    return {
      left: centerX - width / 2,
      top: canvas - labelHeight - gutter,
      width,
      align: 'center',
    };
  }

  if (dx > 0.2) {
    const left = centerX + maxR + gutter;
    return {
      left,
      top: anchorY - labelHeight / 2,
      width: canvas - left - gutter,
      align: 'flex-start',
    };
  }

  const width = centerX - maxR - gutter * 2;
  return {
    left: gutter,
    top: anchorY - labelHeight / 2,
    width: Math.max(width, compact ? 40 : 56),
    align: 'flex-end',
  };
}

export function ProfileDnaRadar({
  dimensions,
  accentColor,
  gridColor,
  fillColor,
  labelColor,
  levelColor,
  compact = false,
}: ProfileDnaRadarProps) {
  const canvas = compact ? 148 : 200;
  const centerX = canvas / 2;
  const centerY = canvas / 2;
  const maxR = compact ? 26 : 58;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const dataPoints = dimensions
    .map((dim, index) => {
      const point = polarPoint(centerX, centerY, maxR * dim.value, index, dimensions.length);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <View style={[styles.wrap, { width: canvas, height: canvas, marginVertical: compact ? 2 : 8 }]}>
      <Svg width={canvas} height={canvas} style={styles.svgLayer}>
        {gridLevels.map((level) => {
          const points = dimensions
            .map((_, index) => {
              const point = polarPoint(centerX, centerY, maxR * level, index, dimensions.length);
              return `${point.x},${point.y}`;
            })
            .join(' ');
          return (
            <Polygon
              key={level}
              points={points}
              fill="none"
              stroke={gridColor}
              strokeWidth={compact ? 0.75 : 1}
            />
          );
        })}
        {dimensions.map((_, index) => {
          const outer = polarPoint(centerX, centerY, maxR, index, dimensions.length);
          return (
            <Line
              key={index}
              x1={centerX}
              y1={centerY}
              x2={outer.x}
              y2={outer.y}
              stroke={gridColor}
              strokeWidth={compact ? 0.75 : 1}
            />
          );
        })}
        <Polygon
          points={dataPoints}
          fill={fillColor}
          stroke={accentColor}
          strokeWidth={compact ? 1.5 : 2}
        />
        {dimensions.map((dim, index) => {
          const point = polarPoint(centerX, centerY, maxR * dim.value, index, dimensions.length);
          return (
            <Circle
              key={`dot-${dim.label}`}
              cx={point.x}
              cy={point.y}
              r={compact ? 2.5 : 3}
              fill={accentColor}
            />
          );
        })}
        <Circle cx={centerX} cy={centerY} r={compact ? 1.5 : 2} fill={accentColor} />
      </Svg>

      {dimensions.map((dim, index) => {
        const pos = axisLabelPlacement(
          index,
          dimensions.length,
          centerX,
          centerY,
          maxR,
          canvas,
          compact,
        );
        return (
          <View
            key={dim.label}
            style={[
              styles.axisLabelWrap,
              {
                left: pos.left,
                top: pos.top,
                width: pos.width,
                alignItems: pos.align,
              },
            ]}>
            <Text
              style={[
                compact ? styles.axisLabelCompact : styles.axisLabel,
                {
                  color: labelColor,
                  textAlign:
                    pos.align === 'flex-end' ? 'right' : pos.align === 'flex-start' ? 'left' : 'center',
                },
              ]}
              numberOfLines={2}>
              {dim.label}
            </Text>
            <Text
              style={[
                compact ? styles.axisLevelCompact : styles.axisLevel,
                {
                  color: levelColor,
                  textAlign:
                    pos.align === 'flex-end' ? 'right' : pos.align === 'flex-start' ? 'left' : 'center',
                },
              ]}>
              {dim.level}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = {
  wrap: {
    alignSelf: 'center' as const,
    position: 'relative' as const,
  },
  svgLayer: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
  },
  axisLabelWrap: {
    position: 'absolute' as const,
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    lineHeight: 12,
    textAlign: 'center' as const,
  },
  axisLevel: {
    fontSize: 9,
    fontWeight: '500' as const,
    lineHeight: 11,
    textAlign: 'center' as const,
  },
  axisLabelCompact: {
    fontSize: 7,
    fontWeight: '600' as const,
    lineHeight: 8,
    textAlign: 'center' as const,
  },
  axisLevelCompact: {
    fontSize: 6.5,
    fontWeight: '500' as const,
    lineHeight: 8,
    textAlign: 'center' as const,
  },
};
