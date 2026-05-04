import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import MainMenu from './src/screens/MainMenu';
import CellStage from './src/screens/CellStage';
import GameOver from './src/screens/GameOver';
import { useGame } from './src/game/store';
import { theme } from './src/theme';

export default function App() {
  const status = useGame((s) => s.status);

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
});
