import { config } from '../../config.js';
import { safeURL } from '../../ui.js';
export class AppTitle extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() {
    this.shadowRoot.innerHTML = `<style>
      :host { display:block; text-align:center; min-width:0; }
      button { cursor:pointer; font:700 clamp(18px,4vw,36px)/1.2 system-ui; border:0; background:none; color:var(--dh-title,var(--dh-text,#eef8ff)); text-shadow:0 0 20px var(--dh-accent,#80edd2); padding:8px; overflow-wrap:anywhere; }
      button:focus-visible { outline:2px solid var(--dh-accent,#80edd2); border-radius:8px; }
      img { width:1em; height:1em; object-fit:contain; margin-right:.3em; vertical-align:middle; }
      p { font:12px/1.4 system-ui; margin:0; color:var(--dh-muted,#bdd0e4); }
      </style><button aria-haspopup="dialog"></button><p></p>`;
    const button = this.shadowRoot.querySelector('button');
    button.textContent = config.appName;
    const icon = safeURL(config.art.titleIcon);
    if (icon) {
      const image = document.createElement('img');
      image.src = icon; image.alt = ''; button.prepend(image);
    }
    this.shadowRoot.querySelector('p').textContent = config.subtitle;
    this.shadowRoot.querySelector('button').onclick = () => this.dispatchEvent(new CustomEvent('decenthead:about', { bubbles:true, composed:true }));
  }
}
if (!customElements.get('app-title')) customElements.define('app-title', AppTitle);
