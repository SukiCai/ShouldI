import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';
import { profileLight, themeSurface, typography } from '@/constants/theme';

export default function EditScreenInfo({ path }: { path: string }) {
  const scheme = useColorScheme();
  const surface = themeSurface(scheme);
  const isDark = scheme === 'dark';

  return (
    <View>
      <View style={styles.getStartedContainer}>
        <Text
          style={[
            styles.getStartedText,
            { color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' },
          ]}>
          Open up the code for this screen:
        </Text>

        <View
          style={[
            styles.codeHighlightContainer,
            styles.homeScreenFilename,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
          ]}>
          <MonoText>{path}</MonoText>
        </View>

        <Text
          style={[
            styles.getStartedText,
            { color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' },
          ]}>
          Change any of the text, save the file, and your app will automatically update.
        </Text>
      </View>

      <View style={styles.helpContainer}>
        <ExternalLink
          style={styles.helpLink}
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet">
          <Text style={[styles.helpLinkText, { color: profileLight.sky }]}>
            Tap here if your app doesn't automatically update after making changes
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  getStartedContainer: {
    alignItems: 'center',
    marginHorizontal: 50,
  },
  homeScreenFilename: {
    marginVertical: 7,
  },
  codeHighlightContainer: {
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  getStartedText: {
    ...typography.body,
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: 15,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  helpLink: {
    paddingVertical: 15,
  },
  helpLinkText: {
    textAlign: 'center',
  },
});
