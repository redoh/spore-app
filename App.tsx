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
  const [loadError, setLoadError] = useState<string | null>(null);
  const status = useGame((s) => s.status);

  useEffect(() => {
    if (skiaReady) return;
    if (Platform.OS !== 'web') {
      setSkiaReady(true);
      return;
    }
    let cancelled = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@shopify/react-native-skia/lib/module/web');
      const baseUrl =
        typeof window !== 'undefined' && window.location?.pathname
          ? window.location.pathname.replace(/\/[^/]*$/, '/')
          : '/';
      mod
        .LoadSkiaWeb({
          locateFile: (file: string) => baseUrl + file,
        })
        .then(() => {
          if (!cancelled) setSkiaReady(true);
        })
        .catch((err: Error) => {
          if (!cancelled) setLoadError(String(err?.message ?? err));
        });
    } catch (err) {
      setLoadError(String((err as Error)?.message ?? err));
    }
    return () => {
      cancelled = true;
    };
  }, [skiaReady]);

  if (!skiaReady) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.loadingTitle}>SPORE</Text>
        {loadError ? (
          <>
            <Text style={[styles.loadingSub, { color: theme.colors.danger }]}>
              CanvasKit yüklenemedi
            </Text>
            <Text style={styles.errorMsg}>{loadError}</Text>
          </>
        ) : (
          <Text style={styles.loadingSub}>CanvasKit yükleniyor…</Text>
        )}
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
  errorMsg: {
    color: theme.colors.textDim,
    marginTop: 12,
    fontSize: 11,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
