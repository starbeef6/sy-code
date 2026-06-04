import '@xterm/xterm/css/xterm.css';
import { render } from 'solid-js/web';
import { App } from './App';
import { installDomI18n } from '../lib/i18n';

installDomI18n();
render(() => <App />, document.getElementById('root') as HTMLElement);
