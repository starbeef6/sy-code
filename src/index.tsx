import { render } from 'solid-js/web';

const root = document.getElementById('root') as HTMLElement;
const isPet = new URLSearchParams(window.location.search).get('window') === 'pet';

if (isPet) {
  void import('./pet/Pet').then(({ default: Pet }) => {
    render(() => <Pet />, root);
  });
} else {
  void import('./App').then(({ default: App }) => {
    render(() => <App />, root);
  });
}
