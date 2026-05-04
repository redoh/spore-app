import 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

function setStatus(msg: string) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector('#boot-status');
  if (el) (el as HTMLElement).textContent = msg;
}

async function bootstrap() {
  if (Platform.OS === 'web') {
    setStatus('canvaskit module yükleniyor…');
    // CanvasKit must be on `globalThis.CanvasKit` BEFORE @shopify/react-native-skia
    // is first imported, because its web shim captures the reference at module
    // init time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    let mod: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('canvaskit-wasm/bin/full/canvaskit');
    } catch (e) {
      throw new Error(
        'require(canvaskit-wasm) failed: ' + ((e as Error)?.message ?? e),
      );
    }
    const init = typeof mod === 'function' ? mod : mod?.default;
    if (typeof init !== 'function') {
      throw new Error(
        'CanvasKitInit not a function. typeof mod=' +
          typeof mod +
          ' keys=' +
          (mod && Object.keys(mod).join(',')),
      );
    }
    const baseUrl =
      typeof window !== 'undefined' && window.location?.pathname
        ? window.location.pathname.replace(/\/[^/]*$/, '/')
        : '/';
    setStatus('canvaskit.wasm indiriliyor…');
    const ck = await init({ locateFile: (file: string) => baseUrl + file });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CanvasKit = ck;
    setStatus('App yükleniyor…');
  }
  const App = (await import('./App')).default;
  registerRootComponent(App);
}

bootstrap().catch((err) => {
  const msg = (err && (err.message || String(err))) || 'unknown';
  const stack = (err && err.stack) || '(no stack)';
  if (typeof document !== 'undefined') {
    document.body.innerHTML =
      '<pre style="color:#ff5b6e;background:#03060f;padding:24px;font-family:monospace;font-size:12px;white-space:pre-wrap;">' +
      'Boot error\n\nMessage: ' +
      msg +
      '\n\nStack:\n' +
      stack +
      '</pre>';
  } else {
    // eslint-disable-next-line no-console
    console.error(err);
  }
});
