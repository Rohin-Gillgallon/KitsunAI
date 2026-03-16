import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';

const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

interface BootingScreenProps {
  accent: string;
}

export const BootingScreen: React.FC<BootingScreenProps> = ({ accent }) => {
  return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator size="large" color={accent} />
      <Text style={[styles.loadingText, { fontFamily: MONO }]}>
        BOOTING FOX_AI_OS...
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    marginTop: 16,
    fontSize: 10,
    letterSpacing: 4,
    textAlign: 'center',
  },
});
