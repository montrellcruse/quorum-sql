import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco to use locally bundled editor instead of loading from CDN
// This ensures Monaco works reliably in headless test environments (Playwright)
loader.config({ monaco });

export { monaco };
