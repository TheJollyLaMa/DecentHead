export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
export function safeURL(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value, globalThis.document?.baseURI); return ['https:', 'http:', 'ipfs:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
export const modalStyles = `
  :host { font:14px/1.5 system-ui,sans-serif; color:var(--dh-text,#eef8ff); }
  dialog { box-sizing:border-box; width:min(650px,calc(100vw - 24px)); max-height:calc(100dvh - 24px); overflow:auto; padding:24px; border:1px solid var(--dh-accent,#80edd2); border-radius:16px; background:var(--dh-bg-1,#0b1424); color:inherit; }
  dialog::backdrop { background:#000b; backdrop-filter:blur(4px); }
  button,input,select { font:inherit; padding:9px; border-radius:7px; border:1px solid var(--dh-accent,#80edd2); color:inherit; background:var(--dh-bg-2,#192c40); box-sizing:border-box; max-width:100%; }
  button { cursor:pointer; } button:disabled { opacity:.5; cursor:default; } a { color:var(--dh-accent,#80edd2); }
  button:focus-visible,a:focus-visible,input:focus-visible { outline:3px solid var(--dh-accent,#80edd2); outline-offset:3px; }
  label { display:block; margin:12px 0; } p { overflow-wrap:anywhere; } h2 { margin-top:0; } section { border-top:1px solid #627286; margin-top:18px; padding-top:12px; }
`;
