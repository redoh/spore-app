import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ error, info: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Render hatası yakalandı</Text>
          <Text style={styles.label}>Mesaj</Text>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          {this.state.error.stack ? (
            <>
              <Text style={styles.label}>Stack</Text>
              <ScrollView style={styles.scroll}>
                <Text style={styles.stack}>{this.state.error.stack}</Text>
              </ScrollView>
            </>
          ) : null}
          {this.state.info ? (
            <>
              <Text style={styles.label}>Component stack</Text>
              <ScrollView style={styles.scroll}>
                <Text style={styles.stack}>{this.state.info}</Text>
              </ScrollView>
            </>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bgDeep,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: theme.colors.danger,
    fontSize: 22,
    fontWeight: '900',
  },
  label: {
    color: theme.colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  msg: {
    color: theme.colors.text,
    fontSize: 14,
    backgroundColor: theme.colors.bgPanel,
    padding: 10,
    borderRadius: 8,
  },
  scroll: {
    maxHeight: 250,
    backgroundColor: theme.colors.bgPanel,
    padding: 10,
    borderRadius: 8,
  },
  stack: {
    color: theme.colors.text,
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
