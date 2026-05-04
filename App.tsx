import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import MainMenu from './src/screens/MainMenu';
import CellStage from './src/screens/CellStage';
import CreatureStage from './src/screens/CreatureStage';
import TribalStage from './src/screens/TribalStage';
import CivilizationStage from './src/screens/CivilizationStage';
import GameOver from './src/screens/GameOver';
import ErrorBoundary from './src/components/ErrorBoundary';
import { useGame } from './src/game/store';
import { theme } from './src/theme';

export default function App() {
  const status = useGame((s) => s.status);
  const stage = useGame((s) => s.stage);

  let screen: React.ReactNode;
  if (status === 'gameover') screen = <GameOver />;
  else if (status === 'menu') screen = <MainMenu />;
  else if (stage === 'civilization') screen = <CivilizationStage />;
  else if (stage === 'tribal') screen = <TribalStage />;
  else if (stage === 'creature') screen = <CreatureStage />;
  else screen = <CellStage />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <ErrorBoundary>{screen}</ErrorBoundary>
        </View>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bgDeep },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingTitle: {
    color: theme.colors.accent,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 6,
  },
  loadingSub: {
    color: theme.colors.textDim,
    marginTop: 8,
    fontSize: 13,
  },
  errorMsg: {
    color: theme.colors.textDim,
    marginTop: 12,
    fontSize: 11,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  diagBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#ff0066',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  diagText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
