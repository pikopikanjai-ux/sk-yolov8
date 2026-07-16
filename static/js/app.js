'use strict';

// ── State ─────────────────────────────────────────────────────
let uploadedFile    = null;
let uploadedDataUrl = null;
let detectionResult = null;
let isDetecting     = false;
let activeTab       = 'upload';

// Camera
let camStream  = null;
let camActive  = false;
let photoTaken = false;


// ═══════════════════════════════════════════════════════════════
// TAB SWITCHER
// ═══════════════════════════════════════════════════════════════
function switchTab(tab) {
  activeTab = tab;
  _applyTabUI(tab);
  if (tab === 'upload') stopCamera();
  _clearState();
}

function _applyTabUI(tab) {
  const pu = document.getElementById('panelUpload');
  const pc = document.getElementById('panelCamera');
  const tu = document.getElementById('tabUpload');
  const tc = document.getElementById('tabCamera');

  if (tab === 'upload') {
    pu.classList.remove('hidden'); pu.classList.add('flex');
    pc.classList.add('hidden');    pc.classList.remove('flex');
    tu.classList.add('bg-white','text-green-700','shadow-sm');
    tu.classList.remove('text-slate-500');
    tc.classList.remove('bg-white','text-green-700','shadow-sm');
    tc.classList.add('text-slate-500');
  } else {
    pc.classList.remove('hidden'); pc.classList.add('flex');
    pu.classList.add('hidden');    pu.classList.remove('flex');
    tc.classList.add('bg-white','text-green-700','shadow-sm');
    tc.classList.remove('text-slate-500');
    tu.classList.remove('bg-white','text-green-700','shadow-sm');
    tu.classList.add('text-slate-500');
  }
}

function _clearState() {
  uploadedFile = uploadedDataUrl = detectionResult = null;
  photoTaken = false;
  resetResult();
}


// ═══════════════════════════════════════════════════════════════
// KONFIRMASI SUMBER GAMBAR
// ═══════════════════════════════════════════════════════════════
function confirmImageSource() {
  const caraUrl = window.CLDD_CARA_DETEKSI_URL || '/cara-deteksi';
  return CLDD.confirm({
    title: 'Pastikan Ini Foto Daun Jagung',
    message: `Sistem ini hanya dilatih untuk mendeteksi penyakit pada
      <b>daun jagung</b>. Agar hasil deteksi akurat, pastikan gambar yang
      akan diunggah benar-benar menampilkan daun jagung dan bukan objek lain.<br><br>
      <a href="${caraUrl}"
         class="inline-flex items-center gap-1 text-green-600 font-semibold
                hover:text-green-700 hover:underline">
        Lihat cara deteksi
      </a>`,
    type: 'warning',
    okText: 'Mengerti, Lanjutkan',
    cancelText: 'Batal',
  });
}


// ═══════════════════════════════════════════════════════════════
// UPLOAD TAB
// ═══════════════════════════════════════════════════════════════
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

function _isValidImageFile(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  return ALLOWED_EXT.includes(ext) && file.type.startsWith('image/');
}

// ── FIX BUG PENYIMPANAN ───────────────────────────────────────
// Masalah: async/await memutus "user gesture chain" sehingga
// browser menolak membuka file picker setelah Promise selesai.
//
// Solusi: Gunakan flag `_uploadConfirmed`. Saat user klik zone,
// tampilkan popup dulu. Jika OK, set flag = true lalu klik
// fileInput SECARA LANGSUNG (synchronous) di dalam handler OK
// popup — bukan setelah await. Ini mempertahankan gesture chain.
let _uploadConfirmed = false;

function handleUploadZoneClick() {
  console.log('[UploadZone] Clicked, confirmed =', _uploadConfirmed);

  if (_uploadConfirmed) {
    _uploadConfirmed = false;
    console.log('[UploadZone] Flag true → OPEN FILE PICKER');
    document.getElementById('fileInput').click();
    return;
  }

  // Tampilkan popup
  confirmImageSource().then(ok => {
    console.log('[Confirm] resolved with:', ok);

    if (!ok) return;

    _uploadConfirmed = true;
    
    // Langsung trigger fileInput, JANGAN klik zone lagi
    // Ini lebih stabil
    setTimeout(() => {
      document.getElementById('fileInput').click();
      _uploadConfirmed = false;   // reset flag
    }, 50);   // beri sedikit waktu agar popup benar-benar hilang
  }).catch(err => {
    console.error('[Confirm] error:', err);
    _uploadConfirmed = false;
  });
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { CLDD.error('Ukuran file maksimal 5 MB!'); return; }

  detectionResult = null;

  if (!_isValidImageFile(file)) {
    uploadedFile    = null;
    uploadedDataUrl = null;
    renderUploadPreview(false, file.name);
    CLDD.error('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.');
    return;
  }

  uploadedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadedDataUrl = ev.target.result;
    renderUploadPreview(true);
    CLDD.success('Gambar siap dideteksi');
  };
  reader.readAsDataURL(file);
}

function renderUploadPreview(isValid = true, fileName = '') {
  const c = document.getElementById('previewContainer');
  if (!c) return;

  if (!isValid) {
    c.innerHTML = `
      <div class="relative w-full flex flex-col items-center justify-center text-center py-6 px-4">
        <button onclick="removeImage(event)"
                class="absolute top-1 right-1 leading-none cursor-pointer">
          <i class="ri-close-circle-fill text-2xl text-red-400 hover:text-red-600 drop-shadow"></i>
        </button>
        <div class="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
          <i class="ri-file-warning-line text-2xl text-red-400"></i>
        </div>
        <p class="text-sm font-medium text-slate-700 max-w-[220px] truncate">${fileName}</p>
        <p class="text-xs text-red-500 font-semibold mt-1">Tidak dapat dideteksi</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Gunakan format JPG, PNG, atau WEBP</p>
      </div>`;
    return;
  }

  c.innerHTML = `
    <div class="relative w-full flex items-center justify-center py-2">
      <img src="${uploadedDataUrl}"
           class="max-h-48 w-full object-contain rounded-xl shadow-sm fade-in" alt="Preview">
      <button onclick="removeImage(event)"
              class="absolute top-1 right-1 leading-none cursor-pointer">
        <i class="ri-close-circle-fill text-2xl text-red-400 hover:text-red-600 drop-shadow"></i>
      </button>
    </div>
    <p class="text-xs text-green-600 font-medium mt-1 pb-3">Siap dideteksi</p>`;
}

async function removeImage(e) {
  e && (e.preventDefault(), e.stopPropagation());
  const ok = await CLDD.confirm({
    title:'Hapus Gambar',message:'Yakin ingin menghapus gambar ini?',
    type:'warning',okText:'Hapus',cancelText:'Batal'});
  if (!ok) return;
  uploadedFile = uploadedDataUrl = detectionResult = null;
  const fi = document.getElementById('fileInput'); if (fi) fi.value = '';
  document.getElementById('previewContainer').innerHTML = `
    <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
      <i class="ri-image-add-line text-2xl text-slate-400"></i>
    </div>
    <p class="text-sm font-medium text-slate-700">Tarik &amp; lepas gambar di sini</p>
    <p class="text-xs text-slate-400 mt-1">atau klik untuk memilih file</p>
    <p class="text-xs text-slate-300 mt-4">JPG, PNG, WEBP · maks 5 MB</p>`;
  resetResult();
  CLDD.info('Gambar dihapus');
}

// Drag-drop
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('uploadZone');
  if (zone) {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('border-green-400','bg-green-50/60');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('border-green-400','bg-green-50/60');
    });
    // ── FIX BUG DRAG & DROP ──────────────────────────────────
    // Drag & drop tidak punya masalah gesture chain karena
    // handleImageUpload() tidak membuka file picker — cukup async/await.
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      zone.classList.remove('border-green-400','bg-green-50/60');
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const ok = await confirmImageSource();
      if (ok) handleImageUpload({ target:{ files:[f] } });
    });
  }

  // Fullscreen: jika user keluar manual (Escape/back), matikan kamera
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && camActive) stopCamera();
  });
  document.addEventListener('webkitfullscreenchange', () => {
    if (!document.webkitFullscreenElement && camActive) stopCamera();
  });

  console.log('%c✅ CLDD app.js ready', 'color:#16a34a;font-weight:700');
});


// ═══════════════════════════════════════════════════════════════
// CAMERA TAB
// ═══════════════════════════════════════════════════════════════
async function toggleCamera() {
  if (camActive) { stopCamera(); return; }
  const ok = await confirmImageSource();
  if (!ok) return;
  await startCamera();
}

async function startCamera() {
  photoTaken = false; uploadedFile = null;
  setCamDetect(false); setCamUI('requesting');
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } },
      audio:false });
    camActive = true;
    const v = document.getElementById('camFeed');
    v.srcObject = camStream; await v.play();
    setCamUI('live');

    const camBox = document.getElementById('camBox');
    if (camBox) {
      if (camBox.requestFullscreen) {
        camBox.requestFullscreen().catch(() => _fakeFull(camBox));
      } else if (camBox.webkitRequestFullscreen) {
        camBox.webkitRequestFullscreen();
      } else {
        _fakeFull(camBox);
      }
    }

    CLDD.success('Kamera aktif');
  } catch(err) {
    camStream = null; camActive = false; setCamUI('idle');
    const m = {
      NotAllowedError:'Akses kamera ditolak. Izinkan di pengaturan browser.',
      NotFoundError:'Tidak ada kamera yang ditemukan.',
      NotReadableError:'Kamera digunakan aplikasi lain.',
    };
    CLDD.alert({ title:'Kamera Tidak Tersedia',
                 message: m[err.name] || `Error: ${err.message}`,
                 type:'error', okText:'Mengerti' });
  }
}

function stopCamera() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitFullscreenElement) {
    document.webkitExitFullscreen();
  }
  _fakeFullExit();

  if (camStream) camStream.getTracks().forEach(t=>t.stop());
  camStream = null; camActive = false; photoTaken = false; uploadedFile = null;
  const v = document.getElementById('camFeed'); if(v) v.srcObject = null;
  setCamUI('idle'); setCamDetect(false);
}

function _fakeFull(el) {
  el.dataset.fakeFull = '1';
  el.classList.add('cam-fake-full');
  Object.assign(el.style, {
    position:'fixed', inset:'0', zIndex:'9999',
    width:'100vw', height:'100svh',
    borderRadius:'0',
  });
  document.body.style.overflow = 'hidden';
}

function _fakeFullExit() {
  const el = document.getElementById('camBox');
  if (!el || !el.dataset.fakeFull) return;
  delete el.dataset.fakeFull;
  el.classList.remove('cam-fake-full');
  Object.assign(el.style, {
    position:'', inset:'', zIndex:'',
    width:'', height:'', borderRadius:'',
  });
  document.body.style.overflow = '';
}

function snapPhoto() {
  const v = document.getElementById('camFeed');
  const c = document.getElementById('snapCanvas');
  if (!v || !c) return;
  c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

  const fl = document.getElementById('camFlash');
  if (fl) {
    fl.classList.remove('hidden'); fl.style.opacity = '0.7';
    setTimeout(()=>{ fl.style.opacity='0'; setTimeout(()=>fl.classList.add('hidden'),160); }, 80);
  }

  c.toBlob(blob => {
    if (!blob) { CLDD.error('Gagal mengambil foto.'); return; }
    uploadedFile = new File([blob], `snap_${Date.now()}.jpg`, { type:'image/jpeg' });
    const prev = document.getElementById('camPreview');
    if (prev) prev.src = c.toDataURL('image/jpeg', 0.92);
    photoTaken = true;
    setCamUI('captured');
    setCamDetect(true);
    CLDD.success('Foto diambil!');
  }, 'image/jpeg', 0.92);
}

function retakePhoto() {
  photoTaken = false; uploadedFile = detectionResult = null;
  resetResult(); setCamDetect(false); setCamUI('live');
}

function setCamUI(state) {
  const idle       = document.getElementById('camIdle');
  const feed       = document.getElementById('camFeed');
  const prev       = document.getElementById('camPreview');
  const guide      = document.getElementById('camGuide');
  const btnTog     = document.getElementById('btnToggleCam');
  const btnStartCam= document.getElementById('btnStartCam');
  const lbl        = document.getElementById('camToggleLabel');
  const btnSnap    = document.getElementById('btnSnap');
  const btnRet     = document.getElementById('btnRetake');

  [idle,feed,prev,guide].forEach(el => el && el.classList.add('hidden'));
  btnSnap && btnSnap.classList.add('hidden');
  btnRet  && btnRet.classList.add('hidden');

  if (state === 'idle') {
    idle.innerHTML = `
      <div class="flex flex-col items-center text-center px-6 py-8">
        <div class="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
          <i class="ri-camera-off-line text-2xl text-slate-500"></i></div>
        <p class="text-slate-400 text-sm font-medium">Kamera belum aktif</p>
        <p class="text-slate-600 text-xs mt-1">Tekan tombol di bawah untuk mulai</p></div>`;
    idle.classList.remove('hidden');

    if (btnStartCam) {
      btnStartCam.classList.remove('hidden');
      btnStartCam.disabled = false;
      btnStartCam.innerHTML = '<i class="ri-camera-line"></i> Aktifkan Kamera';
      btnStartCam.className = btnStartCam.className
        .replace(/bg-red-\\w+/g,'').replace(/hover:bg-red-\\w+/g,'').trim();
      btnStartCam.classList.add('bg-green-600','hover:bg-green-700');
    }
    if (btnTog) { btnTog.disabled = false; lbl && (lbl.textContent = 'Aktifkan'); }

  } else if (state === 'requesting') {
    idle.innerHTML = `
      <div class="flex flex-col items-center text-center px-6 py-8">
        <div class="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3"></div>
        <p class="text-slate-400 text-sm">Meminta akses kamera…</p></div>`;
    idle.classList.remove('hidden');
    if (btnStartCam) { btnStartCam.disabled = true; }
    if (btnTog)      { btnTog.disabled = true; }

  } else if (state === 'live') {
    if (btnStartCam) btnStartCam.classList.add('hidden');
    feed.classList.remove('hidden');
    guide.classList.remove('hidden');
    btnSnap && btnSnap.classList.remove('hidden');
    if (btnTog) { btnTog.disabled = false; lbl && (lbl.textContent = 'Matikan'); }

  } else if (state === 'captured') {
    if (btnStartCam) btnStartCam.classList.add('hidden');
    prev.classList.remove('hidden');
    btnRet  && btnRet.classList.remove('hidden');
    if (btnTog) { btnTog.disabled = false; lbl && (lbl.textContent = 'Matikan'); }
  }
}

function setCamDetect(on) {
  const b = document.getElementById('detectBtnCam'); if(!b) return;
  b.disabled = !on;
  b.classList.toggle('opacity-40', !on);
  b.classList.toggle('cursor-not-allowed', !on);
  b.classList.toggle('hover:bg-green-700', on);
  b.classList.toggle('active:scale-[.98]', on);
}


// ═══════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════
function runDetection() {
  if (!uploadedFile) {
    CLDD.alert({
      title: 'Belum Ada Gambar',
      message: activeTab==='camera'
        ? 'Ambil foto terlebih dahulu dengan tombol "Ambil Foto".'
        : 'Unggah foto daun jagung terlebih dahulu.',
      type:'warning', okText:'Mengerti'});
    return;
  }
  if (isDetecting) return;
  isDetecting = true;

  // ── FIX BUG KAMERA TIDAK TERTUTUP ────────────────────────
  // Ketika deteksi dari tab kamera: simpan file & dataUrl sebelum
  // stopCamera() mereset keduanya, lalu pindah ke tab upload
  // dan tampilkan preview foto yang baru diambil.
  if (activeTab === 'camera') {
    const fileToDetect = uploadedFile;
    const camPrev      = document.getElementById('camPreview');
    const dataUrl      = (camPrev && camPrev.src && camPrev.src !== window.location.href)
                         ? camPrev.src
                         : uploadedDataUrl;

    stopCamera();                 // reset uploadedFile → null

    uploadedFile    = fileToDetect;   // kembalikan file yang tadi disimpan
    uploadedDataUrl = dataUrl;
    activeTab       = 'upload';
    _applyTabUI('upload');
    renderUploadPreview(true);
  }

  const btn = document.getElementById(activeTab==='upload' ? 'detectBtn' : 'detectBtnCam');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="w-4 h-4 border-2 border-white border-t-transparent
                    rounded-full animate-spin mr-2"></span>Mendeteksi…`;
  }

  const area = document.getElementById('resultArea');
  area.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center py-16 text-center gap-5">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 border-4 border-green-100 border-t-green-600
                    rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <i class="ri-leaf-fill text-green-500 text-xl"></i></div>
      </div>
      <div>
        <p class="font-semibold text-slate-700">YOLOv8 menganalisis gambar…</p>
        <p class="text-slate-400 text-sm mt-1">Mohon tunggu sebentar</p>
      </div>
      <div class="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div id="pbar" class="h-full bg-green-500 rounded-full"
             style="width:0%;transition:width 2.4s ease-out;"></div>
      </div>
    </div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const pb=document.getElementById('pbar'); if(pb) pb.style.width='88%'; }));

  const fd = new FormData(); fd.append('image', uploadedFile);
  fetch('/detect',{method:'POST',body:fd})
    .then(r=>r.ok?r.json():r.json().then(d=>Promise.reject(d)))
    .then(data=>{ detectionResult=data; renderResult(data); CLDD.success('Deteksi selesai!'); })
    .catch(err=>{ CLDD.error(err?.message||'Terjadi kesalahan.'); resetResult(); })
    .finally(()=>{
      isDetecting=false;
      if(btn){
        btn.disabled=false;
        btn.innerHTML = '<i class="ri-search-eye-line text-base"></i> Mulai Deteksi';
        if(activeTab==='camera' && !photoTaken) setCamDetect(false);
      }
    });
}


// ═══════════════════════════════════════════════════════════════
// RESULT RENDERING
// ═══════════════════════════════════════════════════════════════
function resetResult() {
  const area = document.getElementById('resultArea'); if(!area) return;
  area.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center text-center py-16 gap-4">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <i class="ri-bar-chart-grouped-line text-3xl text-slate-300"></i></div>
      <p class="text-slate-400 font-medium">Hasil deteksi akan muncul di sini</p>
      <p class="text-slate-300 text-sm max-w-xs">Unggah gambar atau gunakan kamera, lalu tekan Deteksi.</p>
    </div>`;}

function renderResult(data) {
  const area = document.getElementById('resultArea'); if(!area) return;
  const thr  = Math.round((data.threshold||0.25)*100);

  if (!data.diseases || data.diseases.length===0) {
    area.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center py-12 gap-4 fade-in">
        <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <i class="ri-search-eye-line text-2xl text-slate-300"></i></div>
        <div>
          <p class="font-semibold text-slate-700">Objek Tidak Terdeteksi</p>
          <p class="text-slate-400 text-sm mt-1 max-w-xs">
            YOLOv8 tidak menemukan penyakit daun jagung maupun daun sehat pada gambar yang diunggah.
            Pastikan gambar menampilkan daun jagung dengan jelas, tidak buram, dan memiliki pencahayaan yang cukup.
          </p>
        </div>
        ${data.result_image?`
        <div class="w-full mt-2">
          <img src="${data.result_image}" class="rounded-xl shadow w-full object-contain max-h-52">
        </div>`:''}
      </div>`;
    return;
  }

  const diseases    = data.diseases;
  const diseaseOnly = diseases.filter(d => d.class_name !== 'health');
  const multi       = diseases.length > 1;

  function getBadgeClass(healthy, pct) {
    if (healthy) return pct >= 90 ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700';
    return pct >= 90 ? 'bg-red-600 text-white' : 'bg-orange-100 text-orange-700';
  }
  function getBarClass(healthy, pct) {
    if (healthy) return pct >= 90 ? 'bg-green-600' : 'bg-green-400';
    return pct >= 90 ? 'bg-red-500' : 'bg-orange-400';
  }

  const cards = diseases.map((d,i)=>{
    const pct     = Math.round(d.best_confidence*100);
    const healthy = d.class_name === 'health';
    const badgeBg = getBadgeClass(healthy, pct);
    const barCl   = getBarClass(healthy, pct);

    const solHtml = (!healthy && d.solutions?.length) ? `
      <div class="mt-3">
        <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Rekomendasi Penanganan</p>
        <ul class="space-y-1.5">
          ${d.solutions.map(s=>`
            <li class="flex gap-2 text-xs text-slate-600">
              <i class="ri-checkbox-circle-fill text-green-500 mt-0.5 shrink-0"></i>
              <span>${s}</span>
            </li>`).join('')}
        </ul>
      </div>` : '';

    const divider = (multi && i < diseases.length - 1)
      ? '<div class="border-t border-slate-100 my-4"></div>' : '';

    return `
      <div>
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeBg} mb-1.5">
              ${pct}% keyakinan</span>
            <h3 class="font-bold text-slate-800 text-sm leading-tight">${d.label}</h3>
          </div>
          ${multi ? `<span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500
                                  flex items-center justify-center text-[11px] font-bold shrink-0">
                       ${i+1}</span>` : ''}
        </div>
        <div class="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div class="${barCl} h-full rounded-full" style="width:${pct}%;transition:width .6s ease"></div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">${d.desc}</p>
        ${solHtml}
        ${divider}
      </div>`;
  }).join('');

  const multiBadge = diseaseOnly.length > 1 ? `
    <div class="flex items-center gap-2 text-xs font-medium text-orange-800
                bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-4">
      <i class="ri-alert-line text-orange-500"></i>
      ${diseaseOnly.length} penyakit terdeteksi pada gambar ini
    </div>` : '';

  area.innerHTML = `
    <div class="fade-in flex flex-col gap-0">
      ${data.result_image ? `
      <div class="rounded-xl overflow-hidden shadow-sm mb-5 border border-slate-100">
        <img src="${data.result_image}" class="w-full object-contain max-h-56 bg-slate-900"
             alt="Hasil deteksi">
      </div>` : ''}
      ${multiBadge}
      <div>${cards}</div>
      <button onclick="downloadPDF()"
              class="mt-5 w-full py-3 border border-slate-300 hover:border-slate-400
                     hover:bg-slate-50 text-slate-600 font-medium rounded-xl flex items-center
                     justify-center gap-2 text-sm transition-all active:scale-[.98]">
        <i class="ri-file-pdf-line text-slate-400"></i> Unduh Laporan PDF
      </button>
    </div>`;
}
