import { TextStyle } from 'react-native';

export const typography = {
  // Font sizes
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    hero: 34,
  },
  // Font weights
  weight: {
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    heavy: '800' as TextStyle['fontWeight'],
  },
  // Line heights
  lineHeight: {
    xs: 15,
    sm: 18,
    md: 22,
    lg: 25,
    xl: 28,
    xxl: 34,
    hero: 42,
  },
};
