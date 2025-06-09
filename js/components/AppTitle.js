export class AppTitle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="../css/header.css" />
        <div id="header-center">
            <h1 id="app-title">
              <span class="title-symbol">::-⊡-</span>
              <span class="ankh-wrapper">
                <span class="ankh-coin">☥</span>
                <span class="sparkle sparkle-top">✨</span>
                <span class="sparkle sparkle-bottom">✨</span>
                <span class="sparkle sparkle-left">✨</span>
                <span class="sparkle sparkle-right">✨</span>
              </span>
              <span class="title-main"> Decent</span> 🦚 <span class="title-main"> Head </span>
              <span class="ankh-wrapper">
                <span class="ankh-coin">☥</span>
                <span class="sparkle sparkle-top">✨</span>
                <span class="sparkle sparkle-bottom">✨</span>
                <span class="sparkle sparkle-left">✨</span>
                <span class="sparkle sparkle-right">✨</span>
              </span>
              <span class="title-symbol">-⊡-::</span>
            </h1>
            <h3 id="app-subtitle">(Another Decent Frankenstein)</h3>
        </div>
    `;
  }
}

customElements.define('app-title', AppTitle);