import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet, Text, View } from 'react-native';

import MainMenu from './src/screens/MainMenu';
import CellStage from './src/screens/CellStage';
import GameOver from './src/screens/GameOver';
import { useGame } from './src/game/store';
import { theme } from './src/theme';

export default function App() {
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== 'web');
  const status = useGame((s) => s.status);

  useEffect(() => {
    if (skiaReady) return;
    let cancelled = false;
    (async () => {
      const { LoadSkiaWeb } = await import(
        '@shopify/react-native-skia/lib/module/web'
      );
      await LoadSkiaWeb({
        locateFile: (file: string) => './' + file,
      });
      if (!cancelled) setSkiaReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [skiaReady]);

  if (!skiaReady) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.loadingTitle}>SPORE</Text>
        <Text style={styles.loadingSub}>CanvasKit yükleniyor…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          {status === 'playing' || status === 'evolving' ? (
            <CellStage />
          ) : status === 'gameover' ? (
            <GameOver />
          ) : (
            <MainMenu />
          )}
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
});
