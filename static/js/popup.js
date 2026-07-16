// static/js/popup.js — CLDD popup system
// API: CLDD.toast(msg,type,dur) | CLDD.alert(opts) | CLDD.confirm(opts)
'use strict';
(function(){

const SID = 'cldd-ps';
if (!document.getElementById(SID)) {
  const s = document.createElement('style');
  s.id = SID;
  s.textContent = `
@keyframes cldd-up{from{opacity:0;transform:translateY(10px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
@keyframes cldd-dn{from{opacity:1;transform:translateY(0) translateX(-50%)}to{opacity:0;transform:translateY(10px) translateX(-50%)}}
@keyframes cldd-mi{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes cldd-mo{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.96)}}
@keyframes cldd-bi{from{opacity:0}to{opacity:1}}
@keyframes cldd-bo{from{opacity:1}to{opacity:0}}

/* ── Toast ── */
.cldd-toast {
  position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
  z-index:9000; display:flex; align-items:center; gap:8px;
  padding:9px 16px; border-radius:10px;
  font-size:13px; font-weight:500;
  max-width:calc(100vw - 32px); text-align:center;
  pointer-events:auto; cursor:pointer;
  animation:cldd-up .24s cubic-bezier(.34,1.4,.64,1) both;
  border: 1px solid;
}
.cldd-toast.out { animation:cldd-dn .18s ease forwards }

/* Muted palette — no saturated fills */
.cldd-toast.info    { background:#f8fafc; color:#475569; border-color:#e2e8f0; box-shadow:0 2px 12px rgba(0,0,0,.07) }
.cldd-toast.success { background:#f0fdf4; color:#166534; border-color:#bbf7d0; box-shadow:0 2px 12px rgba(0,0,0,.07) }
.cldd-toast.error   { background:#fff5f5; color:#991b1b; border-color:#fecaca; box-shadow:0 2px 12px rgba(0,0,0,.07) }
.cldd-toast.warning { background:#fffbeb; color:#92400e; border-color:#fde68a; box-shadow:0 2px 12px rgba(0,0,0,.07) }

.cldd-toast-icon { font-size:15px; flex-shrink:0; opacity:.7 }

/* ── Backdrop ── */
.cldd-bd {
  position:fixed; inset:0; z-index:9100;
  background:rgba(15,23,42,.35);
  backdrop-filter:blur(4px);
  display:flex; align-items:center; justify-content:center; padding:20px;
  animation:cldd-bi .18s ease both;
}
.cldd-bd.out { animation:cldd-bo .15s ease forwards }

/* ── Modal ── */
.cldd-modal {
  background:#fff; border-radius:16px;
  padding:28px 24px 22px;
  width:100%; max-width:380px;
  box-shadow:0 8px 40px rgba(15,23,42,.12);
  border:1px solid #f1f5f9;
  text-align:center;
  animation:cldd-mi .24s cubic-bezier(.34,1.4,.64,1) both;
}
.cldd-modal.out { animation:cldd-mo .15s ease forwards }

/* Icon circle — hidden */
.cldd-mi-icon { display:none; }

.cldd-mt {
  font-size:15px; font-weight:700; color:#0f172a;
  margin-bottom:6px; line-height:1.3;
}
.cldd-mb {
  font-size:13px; color:#64748b;
  line-height:1.6; margin-bottom:20px;
}

/* Button row */
.cldd-actions { display:flex; gap:8px; justify-content:center; }

.cldd-btn {
  flex:1; max-width:140px;
  padding:9px 16px; border-radius:8px;
  font-size:13px; font-weight:500;
  cursor:pointer; border:1px solid;
  transition:opacity .15s, background .15s, transform .1s;
}
.cldd-btn:hover  { opacity:.85 }
.cldd-btn:active { transform:scale(.97) }

/* OK button — subtle outline colored by type */
.cldd-ok.info    { background:#f8fafc; color:#334155; border-color:#e2e8f0; }
.cldd-ok.success { background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
.cldd-ok.error   { background:#fff5f5; color:#991b1b; border-color:#fecaca; }
.cldd-ok.warning { background:#fffbeb; color:#92400e; border-color:#fde68a; }

/* Cancel — always neutral ghost */
.cldd-cancel {
  background:#fff; color:#94a3b8;
  border-color:#e2e8f0;
}
.cldd-cancel:hover { background:#f8fafc; color:#64748b }
  `;
  document.head.appendChild(s);
}

const ICONS = { info:'💬', success:'✓', error:'✕', warning:'!' };
const toasts = [];

function dismiss(el) {
  const i = toasts.indexOf(el); if (i > -1) toasts.splice(i, 1);
  el.classList.add('out');
  setTimeout(() => el.remove(), 200);
  toasts.forEach((t, k) => { t.style.bottom = `${24 + k * 50}px`; });
}

function toast(msg, type='info', dur=3200) {
  toasts.filter(t => t._type === type).forEach(dismiss);
  const el = document.createElement('div');
  el._type = type;
  el.className = `cldd-toast ${type}`;
  el.innerHTML = `<span class="cldd-toast-icon">${ICONS[type]||'·'}</span><span>${msg}</span>`;
  el.style.bottom = `${24 + toasts.length * 50}px`;
  document.body.appendChild(el);
  toasts.push(el);
  const t = setTimeout(() => dismiss(el), dur);
  el.addEventListener('click', () => { clearTimeout(t); dismiss(el); });
}

function modal({ title = '', message = '', type = 'info', okText = 'OK', cancelText = null }) {
  return new Promise(res => {
    // Hapus modal lama jika ada (safety)
    const existing = document.querySelector('.cldd-bd');
    if (existing) existing.remove();

    const bd = document.createElement('div');
    bd.className = 'cldd-bd';

    const m = document.createElement('div');
    m.className = 'cldd-modal';
    m.innerHTML = `
      <div class="cldd-mt">${title}</div>
      <div class="cldd-mb">${message}</div>
      <div class="cldd-actions">
        ${cancelText ? `<button class="cldd-btn cldd-cancel" id="cldd-cancel">${cancelText}</button>` : ''}
        <button class="cldd-btn cldd-ok ${type}" id="cldd-ok">${okText}</button>
      </div>`;

    bd.appendChild(m);
    document.body.appendChild(bd);

    const okBtn = m.querySelector('#cldd-ok');
    const cancelBtn = m.querySelector('#cldd-cancel');

    okBtn.focus();

    function cleanup(value) {
      m.classList.add('out');
      bd.classList.add('out');
      
      document.removeEventListener('keydown', onKey);
      bd.onclick = null;
      if (okBtn) okBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
    
      // Percepat sedikit removal
      setTimeout(() => {
        if (bd.parentNode) bd.remove();
        res(value);
      }, 120);   // dikurangi dari 180
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        cleanup(false);
      } else if (e.key === 'Enter') {
        cleanup(true);
      }
    }

    okBtn.onclick = () => cleanup(true);
    if (cancelBtn) cancelBtn.onclick = () => cleanup(false);

    bd.onclick = e => {
      if (e.target === bd) cleanup(false);
    };

    document.addEventListener('keydown', onKey);
  });
}
window.CLDD = {
  toast,
  alert:   (o) => typeof o==='string' ? modal({title:'Info',message:o,cancelText:null})   : modal({...o,cancelText:null}),
  confirm: (o) => typeof o==='string' ? modal({title:'Konfirmasi',message:o,cancelText:'Batal'}) : modal({cancelText:'Batal',...o}),
  success: (m,d) => toast(m,'success',d),
  error:   (m,d) => toast(m,'error',d),
  warning: (m,d) => toast(m,'warning',d),
  info:    (m,d) => toast(m,'info',d),
};
})();
