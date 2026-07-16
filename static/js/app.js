// static/js/app.js — CLDD Corn Leaf Disease Detector
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

// Hanya mengubah tampilan tab (tanpa reset state, tanpa stopCamera).
// Dipisah dari switchTab() supaya bisa dipakai ulang saat transisi
// otomatis kamera -> upload di dalam runDetection().
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
// UPLOAD TAB
// ═══════════════════════════════════════════════════════════════
// Format yang didukung — harus sinkron dengan ALLOWED di app.py.
// Validasi ini dilakukan di client SEBELUM file diterima, supaya file
// yang jelas-jelas salah format (pdf, video, dll) tidak sempat tampil
// sebagai "Siap dideteksi" lalu baru ditolak saat tombol Deteksi ditekan.
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

function _isValidImageFile(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  return ALLOWED_EXT.includes(ext) && file.type.startsWith('image/');
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { CLDD.error('Ukuran file maksimal 5 MB!'); return; }

  detectionResult = null;

  if (!_isValidImageFile(file)) {
    // Format tidak didukung — jangan simpan sebagai uploadedFile,
    // supaya tombol Deteksi tidak bisa lanjut memprosesnya.
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
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('border-green-400','bg-green-50/60');
      const f = e.dataTransfer.files[0];
      if (f) handleImageUpload({ target:{ files:[f] } });
    });
  }
  // Fullscreen: jika user keluar manual (Escape/back), matikan kamera
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && camActive) stopCamera();
  });
  // Fallback Safari/iOS prefix
  document.addEventListener('webkitfullscreenchange', () => {
    if (!document.webkitFullscreenElement && camActive) stopCamera();
  });

  console.log('%c✅ CLDD app.js ready', 'color:#16a34a;font-weight:700');
});


// ═══════════════════════════════════════════════════════════════
// CAMERA TAB
// ═══════════════════════════════════════════════════════════════
async function toggleCamera() {
  camActive ? stopCamera() : await startCamera();
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

    // Masuk fullscreen — tampilkan viewfinder penuh
    // _fakeFull dipakai sebagai fallback CSS untuk iOS Safari
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
  // Keluar dari fullscreen jika sedang aktif
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitFullscreenElement) {
    document.webkitExitFullscreen();
  }
  // Keluar dari CSS fake fullscreen (fallback iOS)
  _fakeFullExit();

  if (camStream) camStream.getTracks().forEach(t=>t.stop());
  camStream = null; camActive = false; photoTaken = false; uploadedFile = null;
  const v = document.getElementById('camFeed'); if(v) v.srcObject = null;
  setCamUI('idle'); setCamDetect(false);
}

// ── Fullscreen helpers ────────────────────────────────────────
// Fallback untuk browser yang tidak support Fullscreen API (terutama iOS Safari).
// Menggunakan position:fixed untuk efek visual yang sama.
function _fakeFull(el) {
  el.dataset.fakeFull = '1';
  // Kelas ini dipakai oleh CSS selector di index.html
  // untuk menampilkan #camOverlayBtns saat fullscreen CSS
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

  // flash
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

// ── Camera UI state machine ───────────────────────────────────
function setCamUI(state) {
  const idle       = document.getElementById('camIdle');
  const feed       = document.getElementById('camFeed');
  const prev       = document.getElementById('camPreview');
  const guide      = document.getElementById('camGuide');
  const btnTog     = document.getElementById('btnToggleCam');   // di dalam camBox
  const btnStartCam= document.getElementById('btnStartCam');    // di luar camBox (idle only)
  const lbl        = document.getElementById('camToggleLabel');
  const btnSnap    = document.getElementById('btnSnap');
  const btnRet     = document.getElementById('btnRetake');

  // Reset semua elemen visual
  [idle,feed,prev,guide].forEach(el => el && el.classList.add('hidden'));
  btnSnap && btnSnap.classList.add('hidden');
  btnRet  && btnRet.classList.add('hidden');

  if (state === 'idle') {
    // Tampilkan idle placeholder
    idle.innerHTML = `
      <div class="flex flex-col items-center text-center px-6 py-8">
        <div class="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
          <i class="ri-camera-off-line text-2xl text-slate-500"></i></div>
        <p class="text-slate-400 text-sm font-medium">Kamera belum aktif</p>
        <p class="text-slate-600 text-xs mt-1">Tekan tombol di bawah untuk mulai</p></div>`;
    idle.classList.remove('hidden');

    // Tombol luar (btnStartCam) tampil, tombol dalam disembunyikan
    if (btnStartCam) {
      btnStartCam.classList.remove('hidden');
      btnStartCam.disabled = false;
      btnStartCam.innerHTML = '<i class="ri-camera-line"></i> Aktifkan Kamera';
      btnStartCam.className = btnStartCam.className
        .replace(/bg-red-\w+/g,'').replace(/hover:bg-red-\w+/g,'').trim();
      btnStartCam.classList.add('bg-green-600','hover:bg-green-700');
    }

    // Tombol dalam (btnToggleCam) tetap ada tapi overlay tersembunyi via CSS
    if (btnTog)  { btnTog.disabled = false; lbl && (lbl.textContent = 'Aktifkan'); }

  } else if (state === 'requesting') {
    idle.innerHTML = `
      <div class="flex flex-col items-center text-center px-6 py-8">
        <div class="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3"></div>
        <p class="text-slate-400 text-sm">Meminta akses kamera…</p></div>`;
    idle.classList.remove('hidden');
    // Nonaktifkan kedua tombol sementara
    if (btnStartCam) { btnStartCam.disabled = true; }
    if (btnTog)      { btnTog.disabled = true; }

  } else if (state === 'live') {
    // Sembunyikan tombol luar — kamera sudah fullscreen
    if (btnStartCam) btnStartCam.classList.add('hidden');

    feed.classList.remove('hidden');
    guide.classList.remove('hidden');
    btnSnap && btnSnap.classList.remove('hidden');

    // Update label tombol dalam
    if (btnTog)  { btnTog.disabled = false; lbl && (lbl.textContent = 'Matikan'); }

  } else if (state === 'captured') {
    // Sembunyikan tombol luar
    if (btnStartCam) btnStartCam.classList.add('hidden');

    prev.classList.remove('hidden');
    btnRet  && btnRet.classList.remove('hidden');

    if (btnTog)  { btnTog.disabled = false; lbl && (lbl.textContent = 'Matikan'); }
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

  // Jika deteksi dijalankan dari tab kamera: tutup kamera, pindah ke tab
  // upload, dan tampilkan foto yang baru diambil sebagai preview — supaya
  // kamera tidak lagi terlihat terbuka selama proses deteksi berlangsung.
  if (activeTab === 'camera') {
    const fileToDetect = uploadedFile;
    const camPrev = document.getElementById('camPreview');
    const dataUrl = (camPrev && camPrev.src) || uploadedDataUrl;

    stopCamera(); // catatan: stopCamera() mereset uploadedFile, makanya disimpan dulu di atas

    uploadedFile    = fileToDetect;
    uploadedDataUrl = dataUrl;
    activeTab       = 'upload';
    _applyTabUI('upload');
    renderUploadPreview();
  }

  // Loading on button
  const btn = document.getElementById(activeTab==='upload' ? 'detectBtn' : 'detectBtnCam');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="w-4 h-4 border-2 border-white border-t-transparent
                    rounded-full animate-spin mr-2"></span>Mendeteksi…`;
  }

  // Loading in result panel
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
        btn.innerHTML = activeTab==='upload'
          ? '<i class="ri-search-eye-line text-base"></i> Mulai Deteksi'
          : '<i class="ri-search-eye-line text-base"></i> Deteksi Foto';
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
  const thr  = Math.round((data.threshold||0.6)*100);

  // No valid detections
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

  const diseases = data.diseases;

  // Hitung hanya kelas penyakit (bukan sehat) untuk badge.
  // PENTING: key untuk kondisi sehat dari backend (app.py) adalah 'health',
  // BUKAN 'healthy'. Harus konsisten di semua pengecekan di file ini.
  const diseaseOnly = diseases.filter(d => d.class_name !== 'health');
  const multi       = diseases.length > 1;

  // ── Skema warna confidence ────────────────────────────────
  // - Sehat: selalu hijau, 2 gradasi berdasarkan pct (≥90% lebih pekat).
  // - Penyakit (jenis apapun): skema sama untuk semua — merah untuk ≥90%,
  //   oren untuk <90%. Tidak dibedakan per jenis penyakit.
  function getBadgeClass(healthy, pct) {
    if (healthy) {
      return pct >= 90
        ? 'bg-green-600 text-white'
        : 'bg-green-100 text-green-700';
    }
    return pct >= 90
      ? 'bg-red-600 text-white'
      : 'bg-orange-100 text-orange-700';
  }

  function getBarClass(healthy, pct) {
    if (healthy) {
      return pct >= 90 ? 'bg-green-600' : 'bg-green-400';
    }
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
      ? '<div class="border-t border-slate-100 my-4"></div>'
      : '';

    return `
      <div>
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeBg} mb-1.5">
              ${pct}% keyakinan
            </span>
            <h3 class="font-bold text-slate-800 text-sm leading-tight">
              ${d.label}
            </h3>
          </div>

          ${multi ? `
            <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500
                         flex items-center justify-center text-[11px] font-bold shrink-0">
              ${i+1}
            </span>` : ''}
        </div>

        <div class="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div class="${barCl} h-full rounded-full"
               style="width:${pct}%;transition:width .6s ease"></div>
        </div>

        <p class="text-xs text-slate-500 leading-relaxed">
          ${d.desc}
        </p>

        ${solHtml}
        ${divider}
      </div>`;
  }).join('');

  // Badge hanya muncul jika ada lebih dari satu penyakit
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
        <img src="${data.result_image}"
             class="w-full object-contain max-h-56 bg-slate-900"
             alt="Hasil deteksi">
      </div>` : ''}

      ${multiBadge}

      <div>${cards}</div>

      <button onclick="downloadPDF()"
              class="mt-5 w-full py-3 border border-slate-300 hover:border-slate-400
                     hover:bg-slate-50 text-slate-600 font-medium rounded-xl
                     flex items-center justify-center gap-2 text-sm
                     transition-all active:scale-[.98]">
        <i class="ri-file-pdf-line text-slate-400"></i>
        Unduh Laporan PDF
      </button>

    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════
function downloadPDF() {
  if (!detectionResult) {
    CLDD.alert({title:'Belum Ada Hasil',message:'Lakukan deteksi dahulu.',type:'info',okText:'OK'});
    return;
  }

  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const pw  = doc.internal.pageSize.getWidth();   // 210
  const ph  = doc.internal.pageSize.getHeight();  // 297
  const mg  = 20;   // margin kiri-kanan
  const cw  = pw - mg * 2;  // content width = 170
  const diseases = detectionResult.diseases || [];

  // ── Helpers lokal ─────────────────────────────────────────
  const C = {
    green      : [22,  163,  74],
    greenLight : [240, 253, 244],
    greenMid   : [187, 247, 208],
    amber      : [217, 119,   6],
    amberLight : [255, 251, 235],
    red        : [220,  38,  38],
    slate900   : [ 15,  23,  42],
    slate700   : [ 51,  65,  85],
    slate500   : [100, 116, 139],
    slate300   : [203, 213, 225],
    slate100   : [241, 245, 249],
    white      : [255, 255, 255],
  };

  function setColor(arr, alpha) {
    // rgba not supported in jsPDF fill/stroke — we only set RGB
    doc.setTextColor(...arr);
  }
  function fill(arr)   { doc.setFillColor(...arr); }
  function stroke(arr) { doc.setDrawColor(...arr); }
  function lw(n)       { doc.setLineWidth(n); }

  function label(txt, x, y, size=8, style='normal', color=C.slate500) {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(txt, x, y);
  }

  function hline(y, x1=mg, x2=pw-mg, color=C.slate300, w=0.25) {
    stroke(color); lw(w);
    doc.line(x1, y, x2, y);
  }

  // ── PAGE BACKGROUND — very subtle off-white ───────────────
  fill([249,250,251]); doc.rect(0,0,pw,ph,'F');
  // white content card
  fill(C.white);
  doc.roundedRect(mg-4, 8, cw+8, ph-20, 3, 3, 'F');

  // ── HEADER ────────────────────────────────────────────────
  // Thin green accent bar on the left
  fill(C.green);
  doc.rect(mg-4, 8, 3, 38, 'F');

  // Logo dot + title
  fill(C.green);
  doc.circle(mg+5, 20, 3.5, 'F');
  fill(C.white);
  doc.circle(mg+5, 20, 1.5, 'F');

  label('CLDD', mg+12, 18, 15, 'bold', C.slate900);
  label('Corn Leaf Disease Detector', mg+12, 24, 8, 'normal', C.slate500);

  // Date — right aligned
  const dateStr = new Date().toLocaleDateString('id-ID',{dateStyle:'long'});
  label(dateStr, pw-mg, 18, 8, 'normal', C.slate500);
  doc.setFont('helvetica','normal'); // reset
  // right-align date manually
  const dateW = doc.getTextWidth(dateStr);
  doc.setTextColor(...C.slate500);
  doc.setFontSize(8);
  doc.text(dateStr, pw-mg-dateW, 18);

  label('Laporan Hasil Deteksi Penyakit Daun Jagung', mg+12, 30, 8, 'normal', C.slate500);
  label('Model: YOLOv8 · Confidence threshold: 25%', mg+12, 36, 7.5, 'normal', C.slate300);

  hline(48, mg-4, pw-mg+4, C.slate300, 0.3);

  let y = 56;

  // ── RESULT IMAGE ──────────────────────────────────────────
  if (detectionResult.result_image) {
    try {
      // Use a temporary canvas to get natural aspect ratio
      const img = new Image();
      img.src = detectionResult.result_image;
      // Calculate proportional height: cap width at cw, max height 72mm
      const natW = img.naturalWidth  || 640;
      const natH = img.naturalHeight || 480;
      const ratio = natH / natW;
      const imgW  = cw;
      const imgH  = Math.min(imgW * ratio, 72);   // max 72mm tall

      // Shadow effect — light grey rect slightly offset
      fill([229,231,235]);
      doc.roundedRect(mg+1, y+1, imgW, imgH, 2, 2, 'F');

      // Image
      doc.addImage(detectionResult.result_image, 'JPEG', mg, y, imgW, imgH, '', 'FAST');

      // Thin border
      stroke(C.slate300); lw(0.25);
      doc.roundedRect(mg, y, imgW, imgH, 2, 2, 'S');

      // Caption below image
      label('Gambar hasil anotasi YOLOv8', mg, y + imgH + 5, 7.5, 'normal', C.slate300);

      y += imgH + 12;
    } catch(e) {
      y += 4;
    }
  }

  // ── NO DETECTION ──────────────────────────────────────────
  if (diseases.length === 0) {
    fill(C.slate100); stroke(C.slate300); lw(0.3);
    doc.roundedRect(mg, y, cw, 20, 2, 2, 'FD');
    label('Tidak ada objek yang terdeteksi pada gambar ini.', mg+6, y+9, 9, 'bold', C.slate700);
    label('Pastikan gambar menampilkan daun jagung dengan jelas.', mg+6, y+15, 8, 'normal', C.slate500);
    _footer(doc, pw, ph, mg);
    doc.save(`CLDD_TidakTerdeteksi_${Date.now()}.pdf`);
    CLDD.success('PDF diunduh');
    return;
  }

  // ── MULTI-DISEASE SUMMARY ─────────────────────────────────
  if (diseases.length > 1) {
    fill(C.amberLight); stroke([253,230,138]); lw(0.3);
    doc.roundedRect(mg, y, cw, 11, 2, 2, 'FD');
    // amber dot
    fill(C.amber); doc.circle(mg+5, y+5.5, 1.5, 'F');
    label(`${diseases.length} kondisi terdeteksi pada gambar ini`, mg+10, y+7, 8.5, 'bold', C.amber);
    y += 17;
  }

  // ── EACH DISEASE ──────────────────────────────────────────
  diseases.forEach((d, idx) => {
    if (y > 240) { doc.addPage(); _newPageBg(doc, pw, ph, mg, cw, C); y = 20; }

    const pct     = Math.round(d.best_confidence * 100);
    // PENTING: key sehat dari backend adalah 'health', bukan 'healthy'.
    const healthy = d.class_name === 'health';
    // Sama seperti di renderResult(): sehat -> hijau; penyakit -> merah
    // (≥90%) atau oren (<90%), skema sama untuk semua jenis penyakit.
    const accentC = healthy ? C.green : (pct >= 90 ? C.red : C.amber);

    // ── Disease number pill (multi only) ─────────────────
    if (diseases.length > 1) {
      fill(accentC);
      doc.roundedRect(mg, y, 6, 5, 1, 1, 'F');
      doc.setFont('helvetica','bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.white);
      doc.text(`${idx+1}`, mg+1.8, y+3.8);
      label(d.label, mg+9, y+4, 11, 'bold', C.slate900);
      y += 8;
    } else {
      label(d.label, mg, y, 13, 'bold', C.slate900);
      y += 8;
    }

    // ── Confidence row ───────────────────────────────────
    // Label
    label('Tingkat Keyakinan', mg, y+3.5, 8, 'normal', C.slate500);
    // Percentage — right side
    const pctTxt = `${pct}%`;
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.setTextColor(...accentC);
    doc.text(pctTxt, pw-mg, y+3.5, {align:'right'});

    // Progress bar track
    const barY = y+6, barH = 2.5, barW = cw;
    fill(C.slate100); lw(0);
    doc.roundedRect(mg, barY, barW, barH, 1, 1, 'F');
    // Fill
    fill(accentC);
    doc.roundedRect(mg, barY, barW * (pct/100), barH, 1, 1, 'F');

    y += 14;

    // ── Description ──────────────────────────────────────
    if (y > 248) { doc.addPage(); _newPageBg(doc,pw,ph,mg,cw,C); y = 20; }

    label('Deskripsi', mg, y, 8, 'bold', C.slate700);
    y += 4.5;
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.slate500);
    const descLines = doc.splitTextToSize(d.desc, cw);
    doc.text(descLines, mg, y);
    y += descLines.length * 4.6 + 7;

    // ── Recommendations ───────────────────────────────────
    if (!healthy && d.solutions?.length) {
      if (y > 245) { doc.addPage(); _newPageBg(doc,pw,ph,mg,cw,C); y = 20; }

      label('Rekomendasi Penanganan', mg, y, 8, 'bold', C.slate700);
      y += 5;

      d.solutions.forEach((s, si) => {
        if (y > 272) { doc.addPage(); _newPageBg(doc,pw,ph,mg,cw,C); y = 20; }

        // bullet dot
        fill(accentC);
        doc.circle(mg + 1.5, y - 0.5, 1, 'F');

        doc.setFont('helvetica','normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...C.slate500);
        const sl = doc.splitTextToSize(s, cw - 7);
        doc.text(sl, mg + 6, y);
        y += sl.length * 4.6 + 2.5;
      });
    }

    // ── Divider between diseases ──────────────────────────
    if (idx < diseases.length - 1) {
      y += 4;
      if (y < 278) hline(y, mg, pw-mg, C.slate100, 0.4);
      y += 8;
    }
  });

  _footer(doc, pw, ph, mg);
  doc.save(`CLDD_${diseases[0].class_name.replace(/\s+/g,'_')}_${Date.now()}.pdf`);
  CLDD.success('PDF berhasil diunduh!');
}

// Draw subtle background for new pages
function _newPageBg(doc, pw, ph, mg, cw, C) {
  doc.setFillColor(249,250,251);
  doc.rect(0, 0, pw, ph, 'F');
  doc.setFillColor(...C.white);
  doc.roundedRect(mg-4, 8, cw+8, ph-20, 3, 3, 'F');
  // Left accent bar
  doc.setFillColor(...C.green);
  doc.rect(mg-4, 8, 3, ph-20, 'F');
}

function _footer(doc, pw, ph, mg) {
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);

    // Thin separator line
    doc.setDrawColor(226,232,240);
    doc.setLineWidth(0.25);
    doc.line(mg, ph-14, pw-mg, ph-14);

    // Left: branding
    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    doc.setTextColor(148,163,184);
    doc.text('CLDD — Corn Leaf Disease Detector  ·  Skripsi YOLOv8  ·  © 2026', mg, ph-9);

    // Right: page number
    doc.text(`${i} / ${n}`, pw-mg, ph-9, {align:'right'});
  }
}
