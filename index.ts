import 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

async function bootstrap() {
  if (Platform.OS === 'web') {
    // CanvasKit must be on `globalThis.CanvasKit` BEFORE @shopify/react-native-skia
    // is first imported, because its web shim captures the reference at module
    // init time. We therefore load it here and only dynamically import App
    // once it is in place.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const mod = require('canvaskit-wasm/bin/full/canvaskit') as any;
    const init = typeof mod === 'function' ? mod : mod.default;
    const baseUrl =
      typeof window !== 'undefined' && window.location?.pathname
        ? window.location.pathname.replace(/\/[^/]*$/, '/')
        : '/';
    const ck = await init({ locateFile: (file: string) => baseUrl + file });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CanvasKit = ck;
  }
  const App = (await import('./App')).default;
  registerRootComponent(App);
}

bootstrap().catch((err) => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `<pre style="color:#ff5b6e;background:#03060f;padding:24px;font-family:monospace;font-size:12px;white-space:pre-wrap;">Boot error:\n${(err && err.stack) || err}</pre>`;
  } else {
    // eslint-disable-next-line no-console
    console.error(err);
  }
});
