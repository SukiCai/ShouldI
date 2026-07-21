import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

export function MonoText(props: TextProps & { style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[props.style, { fontFamily: 'SpaceMono' }]} />;
}
