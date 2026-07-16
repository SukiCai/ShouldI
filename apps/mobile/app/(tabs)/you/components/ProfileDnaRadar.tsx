import * as React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { screenContentGutter } from '@/constants/theme';
import type { ProfileDnaDimensionMock } from '@/lib/profileMockData';

type ProfileDnaRadarProps = {
  dimensions: ProfileDnaDimensionMock[];
  accentColor: string;
  gridColor: string;
  fillColor: string;
  labelColor: string;
  levelColor: string;
};

const CARD_H_PADDING = 12;
const CANVAS_HEIGHT = 236;
const SIDE_LABEL_WIDTH = 62;
const TOP_LABEL_WIDTH = 92;
const LABEL_CHART_GAP = 6;

type LabelPlacement = {
  left: number;
  top: number;
  width: number;
  align: 'flex-start' | 'center' | 'flex-end';
};

function buildSixAxisLabelSlots(canvasWidth: number, canvasHeight: number): LabelPlacement[] {
  const centerX = canvasWidth / 2;
  return [
    { left: centerX - TOP_LABEL_WIDTH / 2, top: 2, width: TOP_LABEL_WIDTH, align: 'center' },
    {
      left: canvasWidth - SIDE_LABEL_WIDTH - 2,
      top: 28,
      width: SIDE_LABEL_WIDTH,
      align: 'flex-start',
    },
    {
      left: canvasWidth - SIDE_LABEL_WIDTH - 2,
      top: canvasHeight - 56,
      width: SIDE_LABEL_WIDTH,
      align: 'flex-start',
    },
    {
      left: centerX - TOP_LABEL_WIDTH / 2,
      top: canvasHeight - 34,
      width: TOP_LABEL_WIDTH,
      align: 'center',
    },
    { left: 2, top: canvasHeight - 56, width: SIDE_LABEL_WIDTH, align: 'flex-end' },
    { left: 2, top: 28, width: SIDE_LABEL_WIDTH, align: 'flex-end' },
  ];
}

function maxRadarRadius(canvasWidth: number, canvasHeight: number): number {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const horizontal = centerX - SIDE_LABEL_WIDTH - LABEL_CHART_GAP;
  const vertical = centerY - 34;
  const diagonal = horizontal / Math.cos(Math.PI / 6);
  return Math.floor(Math.min(horizontal, vertical, diagonal));
}

function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number,
) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function labelPlacement(
  index: number,
  total: number,
  slots: LabelPlacement[],
): LabelPlacement {
  if (total === 6 && index < slots.length) {
    return slots[index];
  }

  const canvasWidth = slots[0] ? slots[0].left + slots[0].width / 2 + TOP_LABEL_WIDTH / 2 : 260;
  const canvasHeight = CANVAS_HEIGHT;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const maxR = maxRadarRadius(canvasWidth, canvasHeight);
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const labelHeight = 26;
  const gutter = 4;
  const anchorY = centerY + dy * (maxR + 6);

  if (dy < -0.6) {
    return { left: centerX - 44, top: gutter, width: 88, align: 'center' };
  }
  if (dy > 0.6) {
    return {
      left: centerX - 44,
      top: canvasHeight - labelHeight - gutter,
      width: 88,
      align: 'center',
    };
  }
  if (dx > 0.2) {
    return {
      left: centerX + maxR + 10,
      top: anchorY - labelHeight / 2,
      width: canvasWidth - (centerX + maxR + 14),
      align: 'flex-start',
    };
  }
  return {
    left: gutter,
    top: anchorY - labelHeight / 2,
    width: centerX - maxR - 10,
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
}: ProfileDnaRadarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const canvasWidth = Math.max(
    280,
    windowWidth - screenContentGutter * 2 - CARD_H_PADDING * 2,
  );
  const centerX = canvasWidth / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const maxR = maxRadarRadius(canvasWidth, CANVAS_HEIGHT);
  const labelSlots = React.useMemo(
    () => buildSixAxisLabelSlots(canvasWidth, CANVAS_HEIGHT),
    [canvasWidth],
  );
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const dataPoints = dimensions
    .map((dim, index) => {
      const point = polarPoint(centerX, centerY, maxR * dim.value, index, dimensions.length);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <View
      style={[
        styles.wrap,
        { width: canvasWidth, height: CANVAS_HEIGHT, marginVertical: 6, alignSelf: 'stretch' },
      ]}>
      <Svg width={canvasWidth} height={CANVAS_HEIGHT} style={styles.svgLayer}>
        {gridLevels.map((level) => {
          const points = dimensions
            .map((_, index) => {
              const point = polarPoint(centerX, centerY, maxR * level, index, dimensions.length);
              return `${point.x},${point.y}`;
            })
            .join(' ');
          return (
            <Polygon key={level} points={points} fill="none" stroke={gridColor} strokeWidth={1} />
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
              strokeWidth={1}
            />
          );
        })}
        <Polygon points={dataPoints} fill={fillColor} stroke={accentColor} strokeWidth={2.5} />
        {dimensions.map((dim, index) => {
          const point = polarPoint(centerX, centerY, maxR * dim.value, index, dimensions.length);
          return (
            <Circle
              key={`dot-${dim.label}`}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={accentColor}
            />
          );
        })}
        <Circle cx={centerX} cy={centerY} r={2.5} fill={accentColor} />
      </Svg>

      {dimensions.map((dim, index) => {
        const pos = labelPlacement(index, dimensions.length, labelSlots);
        const textAlign =
          pos.align === 'flex-end' ? 'right' : pos.align === 'flex-start' ? 'left' : 'center';
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
            <Text style={[styles.axisLabel, { color: labelColor, textAlign }]}>{dim.label}</Text>
            <Text style={[styles.axisLevel, { color: levelColor, textAlign }]}>{dim.level}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = {
  wrap: {
    position: 'relative' as const,
  },
  svgLayer: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
  },
  axisLabelWrap: {
    position: 'absolute' as const,
    gap: 1,
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    lineHeight: 12,
  },
  axisLevel: {
    fontSize: 10,
    fontWeight: '500' as const,
    lineHeight: 12,
  },
};
