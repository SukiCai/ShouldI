import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Text, View } from 'react-native';

import { council } from '@/constants/theme';

import { youScreenStyles as styles } from './youScreenStyles';

type ProfileQuoteCardProps = {
  quote: string;
  textPrimary: string;
};

export function ProfileQuoteCard({ quote, textPrimary }: ProfileQuoteCardProps) {
  return (
    <View style={[styles.quoteCard, { backgroundColor: `${council.violet}10` }]}>
      <Text style={[styles.quoteMark, { color: council.violet }]}>“</Text>
      <Text style={[styles.quoteCardText, { color: textPrimary }]}>{quote}</Text>
    </View>
  );
}
