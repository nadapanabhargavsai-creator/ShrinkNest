/**
 * ShrinkNest PDF Editor
 * File: js/pdf-editor.js
 * Uses: PDF.js (rendering) + PDF-lib (mutation)
 * 100% client-side — no uploads
 */

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const state = {
    pages: [],          // { pdfIndex, pageIndex, rotation, pdfDoc (PDFLib) }
    pdfDocs: [],        // loaded PDFLib documents
    pdfJsDocs: [],      // loaded PDF.js documents  
    fileNames: [],      // original file names
    selected: new Set(),
    undoStack: [],
    redoStack: [],
    splitMode: false,
    resultBlobs: [],    // { blob, name }
};

/* ─────────────────────────────────────────
   PDF.js SETUP
───────────────────────────────────────── */
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

/* ─────────────────────────────────────────
   DOM REFS
───────────────────────────────────────── */
const uploadZone      = document.getElementById('uploadZone');
const fileInput       = document.getElementById('fileInput');
const addMoreInput    = document.getElementById('addMoreInput');
const editorWorkspace = document.getElementById('editorWorkspace');
const pagesGrid       = document.getElementById('pagesGrid');
const pageCount       = document.getElementById('pageCount');
const fileLabel       = document.getElementById('fileLabel');
const fileMeta        = document.getElementById('fileMeta');
const progressPanel   = document.getElementById('progressPanel');
const progressMsg     = document.getElementById('progressMsg');
const resultPanel     = document.getElementById('resultPanel');
const resultActions   = document.getElementById('resultActions');
const saveBar         = document.getElementById('saveBar');
const saveBarInfo     = document.getElementById('saveBarInfo');
const btnSave         = document.getElementById('btnSave');
const btnSelectAll    = document.getElementById('btnSelectAll');
const btnDeselectAll  = document.getElementById('btnDeselectAll');
const btnMerge        = document.getElementById('btnMerge');
const btnSplit        = document.getElementById('btnSplit');
const splitPanel      = document.getElementById('splitPanel');
const splitInput      = document.getElementById('splitInput');
const btnSplitGo      = document.getElementById('btnSplitGo');
const btnRotL         = document.getElementById('btnRotL');
const btnRotR         = document.getElementById('btnRotR');
const btnRemove       = document.getElementById('btnRemove');
const btnExtract      = document.getElementById('btnExtract');
const btnUndo         = document.getElementById('btnUndo');
const btnRedo         = document.getElementById('btnRedo');
const btnEditAgain    = document.getElementById('btnEditAgain');
const errorBanner     = document.getElementById('errorBanner');
const errorMsg        = document.getElementById('errorMsg');
const confirmModal    = document.getElementById('confirmModal');
const confirmMsg      = document.getElementById('confirmMsg');
const btnConfirmOk    = document.getElementById('btnConfirmOk');
const btnConfirmCancel= document.getElementById('btnConfirmCancel');
const peToast         = document.getElementById('peToast');

/* ─────────────────────────────────────────
   UPLOAD HANDLING
───────────────────────────────────────── */
uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));
addMoreInput.addEventListener('change', () => handleFiles(Array.from(addMoreInput.files)));

async function handleFiles(files) {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (!pdfs.length) { showError('Please select valid PDF files.'); return; }
    clearError();
    showProgress('Loading PDF files…');

    for (const file of pdfs) {
        // Duplicate check
        if (state.fileNames.includes(file.name)) {
            showToast(`"${file.name}" already loaded — skipping.`);
            continue;
        }
        try {
            const arrayBuf = await file.arrayBuffer();

            // Check password protection (pdf-lib throws if encrypted without password)
            let libDoc;
            try {
                libDoc = await PDFLib.PDFDocument.load(arrayBuf, { ignoreEncryption: false });
            } catch (encErr) {
                showError(`"${file.name}" is password-protected or corrupted and cannot be edited.`);
                continue;
            }

            const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
            const pdfIdx = state.pdfDocs.length;

            state.pdfDocs.push(libDoc);
            state.pdfJsDocs.push(pdfJsDoc);
            state.fileNames.push(file.name);

            const pageCount_ = libDoc.getPageCount();
            for (let p = 0; p < pageCount_; p++) {
                state.pages.push({ pdfIndex: pdfIdx, pageIndex: p, rotation: 0 });
            }
        } catch (err) {
            console.error('PDF load error:', err);
            showError(`Failed to load "${file.name}". The file may be corrupted.`);
        }
    }

    if (state.pages.length === 0) {
        hideProgress();
        return;
    }

    pushUndo('initial');
    await renderGrid();
    hideProgress();
    showWorkspace();
}

/* ─────────────────────────────────────────
   RENDER GRID
───────────────────────────────────────── */
async function renderGrid() {
    pagesGrid.innerHTML = '';
    updatePageCount();
    updateFileLabel();
    updateToolbarState();

    for (let i = 0; i < state.pages.length; i++) {
        const card = createSkeletonCard(i);
        pagesGrid.appendChild(card);
    }

    // Render thumbnails in background
    for (let i = 0; i < state.pages.length; i++) {
        renderThumb(i);
    }
}

function createSkeletonCard(idx) {
    const pg = state.pages[idx];
    const card = document.createElement('div');
    card.className = 'page-card';
    card.draggable = true;
    card.dataset.idx = idx;
    card.dataset.rotation = pg.rotation;
    if (state.selected.has(idx)) card.classList.add('selected');

    card.innerHTML = `
        <div class="page-thumb-wrap page-thumb-loading" id="thumbWrap_${idx}">
            <div class="spin"></div>
        </div>
        <div class="page-rotation-badge" id="rotBadge_${idx}"></div>
        <div class="page-footer">
            <span class="page-num">Page ${idx + 1}</span>
            <div class="page-check" id="pageCheck_${idx}">
                ${state.selected.has(idx) ? '<span style="color:#fff;font-size:11px;font-weight:700;">✓</span>' : ''}
            </div>
        </div>
    `;

    updateRotationBadge(card, pg.rotation);
    bindCardEvents(card, idx);
    bindDragEvents(card, idx);
    return card;
}

async function renderThumb(idx) {
    const pg = state.pages[idx];
    const wrap = document.getElementById(`thumbWrap_${idx}`);
    if (!wrap) return;

    try {
        const pdfJsDoc = state.pdfJsDocs[pg.pdfIndex];
        const page = await pdfJsDoc.getPage(pg.pageIndex + 1);

        const viewport = page.getViewport({ scale: 0.4, rotation: pg.rotation });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        wrap.classList.remove('page-thumb-loading');
        wrap.innerHTML = '';
        wrap.appendChild(canvas);
    } catch (e) {
        if (wrap) {
            wrap.classList.remove('page-thumb-loading');
            wrap.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;font-size:12px;">Preview unavailable</div>';
        }
    }
}

function updateRotationBadge(card, rotation) {
    const badge = card.querySelector('.page-rotation-badge');
    if (!badge) return;
    const norm = ((rotation % 360) + 360) % 360;
    card.dataset.rotation = norm;
    if (norm === 0) {
        badge.style.display = 'none';
    } else {
        badge.style.display = 'block';
        badge.textContent = `${norm}°`;
    }
}

/* ─────────────────────────────────────────
   CARD EVENTS
───────────────────────────────────────── */
function bindCardEvents(card, idx) {
    card.addEventListener('click', e => {
        if (e.target.closest('[data-no-select]')) return;
        toggleSelect(idx, card);
    });
}

function toggleSelect(idx, card) {
    if (state.selected.has(idx)) {
        state.selected.delete(idx);
        card.classList.remove('selected');
        const chk = card.querySelector('.page-check');
        if (chk) chk.innerHTML = '';
    } else {
        state.selected.add(idx);
        card.classList.add('selected');
        const chk = card.querySelector('.page-check');
        if (chk) chk.innerHTML = '<span style="color:#fff;font-size:11px;font-weight:700;">✓</span>';
    }
    updateToolbarState();
    updateSaveBarInfo();
}

/* ─────────────────────────────────────────
   DRAG TO REORDER
───────────────────────────────────────── */
let dragSrcIdx = null;

function bindDragEvents(card, idx) {
    card.addEventListener('dragstart', () => {
        dragSrcIdx = idx;
        setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.page-card').forEach(c => c.classList.remove('drag-target'));
    });
    card.addEventListener('dragover', e => {
        e.preventDefault();
        document.querySelectorAll('.page-card').forEach(c => c.classList.remove('drag-target'));
        card.classList.add('drag-target');
    });
    card.addEventListener('drop', e => {
        e.preventDefault();
        card.classList.remove('drag-target');
        if (dragSrcIdx === null || dragSrcIdx === idx) return;
        pushUndo('reorder');
        // Reorder pages
        const moved = state.pages.splice(dragSrcIdx, 1)[0];
        const target = dragSrcIdx < idx ? idx : idx;
        state.pages.splice(dragSrcIdx < idx ? idx - 1 : idx, 0, moved);
        // Fix selected indices
        const newSel = new Set();
        state.selected.forEach(s => {
            if (s === dragSrcIdx) newSel.add(dragSrcIdx < target ? target - 1 : target);
            else if (dragSrcIdx < target && s > dragSrcIdx && s <= target - 1) newSel.add(s - 1);
            else if (dragSrcIdx > target && s >= target && s < dragSrcIdx) newSel.add(s + 1);
            else newSel.add(s);
        });
        state.selected.clear();
        newSel.forEach(s => state.selected.add(s));
        dragSrcIdx = null;
        renderGrid();
        showToast('Page reordered');
    });
}

/* ─────────────────────────────────────────
   TOOLBAR ACTIONS
───────────────────────────────────────── */
btnSelectAll.addEventListener('click', () => {
    state.pages.forEach((_, i) => state.selected.add(i));
    document.querySelectorAll('.page-card').forEach((c, i) => {
        c.classList.add('selected');
        const chk = c.querySelector('.page-check');
        if (chk) chk.innerHTML = '<span style="color:#fff;font-size:11px;font-weight:700;">✓</span>';
    });
    updateToolbarState();
    updateSaveBarInfo();
});

btnDeselectAll.addEventListener('click', () => {
    state.selected.clear();
    document.querySelectorAll('.page-card').forEach(c => {
        c.classList.remove('selected');
        const chk = c.querySelector('.page-check');
        if (chk) chk.innerHTML = '';
    });
    updateToolbarState();
    updateSaveBarInfo();
});

/* Rotate Left */
btnRotL.addEventListener('click', () => rotateSel(-90));

/* Rotate Right */
btnRotR.addEventListener('click', () => rotateSel(90));

function rotateSel(deg) {
    if (state.selected.size === 0) { showToast('Select pages to rotate.'); return; }
    pushUndo('rotate');
    state.selected.forEach(i => {
        state.pages[i].rotation = ((state.pages[i].rotation + deg) % 360 + 360) % 360;
    });
    // Re-render only affected cards
    state.selected.forEach(i => {
        const card = document.querySelector(`.page-card[data-idx="${i}"]`);
        if (card) {
            updateRotationBadge(card, state.pages[i].rotation);
            const wrap = document.getElementById(`thumbWrap_${i}`);
            if (wrap) {
                wrap.innerHTML = '<div class="spin"></div>';
                wrap.classList.add('page-thumb-loading');
            }
            renderThumb(i);
        }
    });
    showToast(`Rotated ${state.selected.size} page(s) ${deg > 0 ? 'right' : 'left'}`);
}

/* Remove */
btnRemove.addEventListener('click', () => {
    if (state.selected.size === 0) { showToast('Select pages to remove.'); return; }
    showConfirm(
        `Remove ${state.selected.size} page(s)?`,
        'This can be undone with the Undo button.',
        () => {
            pushUndo('remove');
            const toRemove = Array.from(state.selected).sort((a, b) => b - a);
            toRemove.forEach(i => state.pages.splice(i, 1));
            state.selected.clear();
            renderGrid();
            showToast(`Removed ${toRemove.length} page(s). Use Undo to restore.`);
        }
    );
});

/* Extract */
btnExtract.addEventListener('click', async () => {
    if (state.selected.size === 0) { showToast('Select pages to extract.'); return; }
    const indices = Array.from(state.selected).sort((a, b) => a - b);
    await buildAndDownload(indices, 'extracted');
});

/* Merge — download all current pages as one PDF */
btnMerge.addEventListener('click', async () => {
    if (state.pages.length === 0) { showToast('No pages to merge.'); return; }
    await buildAndDownload(state.pages.map((_, i) => i), 'merged');
});

/* Split */
btnSplit.addEventListener('click', () => {
    state.splitMode = !state.splitMode;
    splitPanel.classList.toggle('visible', state.splitMode);
    btnSplit.classList.toggle('active', state.splitMode);
});

btnSplitGo.addEventListener('click', async () => {
    const raw = splitInput.value.trim();
    if (!raw) { showToast('Enter page ranges first (e.g. 1-3, 5, 8-10)'); return; }
    const groups = parseRanges(raw, state.pages.length);
    if (!groups) { showError('Invalid range format. Use: 1-3, 5, 8-10'); return; }
    clearError();
    showProgress(`Splitting into ${groups.length} file(s)…`);

    state.resultBlobs = [];
    for (let g = 0; g < groups.length; g++) {
        const indices = groups[g];
        const blob = await buildBlob(indices);
        if (blob) {
            state.resultBlobs.push({
                blob,
                name: `split_part${g + 1}.pdf`
            });
        }
    }

    hideProgress();
    showResultMultiple(state.resultBlobs, 'Split complete!');
    splitPanel.classList.remove('visible');
    state.splitMode = false;
    btnSplit.classList.remove('active');
});

/* Undo */
btnUndo.addEventListener('click', () => {
    if (state.undoStack.length <= 1) { showToast('Nothing to undo.'); return; }
    const current = state.undoStack.pop();
    state.redoStack.push(current);
    const prev = state.undoStack[state.undoStack.length - 1];
    restoreState(prev);
    updateToolbarState();
    showToast('Undone');
});

/* Redo */
btnRedo.addEventListener('click', () => {
    if (state.redoStack.length === 0) { showToast('Nothing to redo.'); return; }
    const next = state.redoStack.pop();
    state.undoStack.push(next);
    restoreState(next);
    updateToolbarState();
    showToast('Redone');
});

/* Save & Download */
btnSave.addEventListener('click', async () => {
    if (state.pages.length === 0) return;
    await buildAndDownload(state.pages.map((_, i) => i), 'edited');
});

/* Edit Again */
btnEditAgain.addEventListener('click', () => {
    resultPanel.classList.remove('visible');
});

/* ─────────────────────────────────────────
   BUILD PDF BLOB
───────────────────────────────────────── */
async function buildBlob(pageIndices) {
    try {
        const out = await PDFLib.PDFDocument.create();
        for (const pi of pageIndices) {
            const pg = state.pages[pi];
            const srcDoc = state.pdfDocs[pg.pdfIndex];
            const [copied] = await out.copyPages(srcDoc, [pg.pageIndex]);
            // Apply rotation
            const curRot = copied.getRotation().angle;
            const totalRot = (curRot + pg.rotation) % 360;
            copied.setRotation(PDFLib.degrees(totalRot));
            out.addPage(copied);
        }
        const bytes = await out.save();
        return new Blob([bytes], { type: 'application/pdf' });
    } catch (e) {
        console.error('Build blob error:', e);
        showError('Failed to build PDF. Please try again.');
        return null;
    }
}

async function buildAndDownload(pageIndices, label) {
    showProgress('Building PDF…');
    const blob = await buildBlob(pageIndices);
    hideProgress();
    if (!blob) return;

    const name = `shrinknest_${label}_${Date.now()}.pdf`;
    state.resultBlobs = [{ blob, name }];
    showResultSingle(blob, name);
}

/* ─────────────────────────────────────────
   RESULT PANELS
───────────────────────────────────────── */
function showResultSingle(blob, name) {
    resultActions.innerHTML = '';

    const url = URL.createObjectURL(blob);
    const sizeKB = (blob.size / 1024).toFixed(1);

    const dl = document.createElement('a');
    dl.href = url;
    dl.download = name;
    dl.className = 'btn-download';
    dl.innerHTML = `<i class="fas fa-download"></i> Download PDF <span style="opacity:0.7;font-size:12px;margin-left:4px;">(${sizeKB} KB)</span>`;
    resultActions.appendChild(dl);

    const again = document.createElement('button');
    again.className = 'btn-edit-again';
    again.innerHTML = '<i class="fas fa-pen-to-square"></i> Edit Again';
    again.addEventListener('click', () => resultPanel.classList.remove('visible'));
    resultActions.appendChild(again);

    resultPanel.querySelector('p').textContent = `${name} • ${sizeKB} KB`;
    resultPanel.classList.add('visible');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showResultMultiple(blobs, title) {
    resultActions.innerHTML = '';

    blobs.forEach(({ blob, name }) => {
        const url = URL.createObjectURL(blob);
        const sizeKB = (blob.size / 1024).toFixed(1);
        const dl = document.createElement('a');
        dl.href = url;
        dl.download = name;
        dl.className = 'btn-download';
        dl.style.marginBottom = '6px';
        dl.innerHTML = `<i class="fas fa-download"></i> ${name} <span style="opacity:0.7;font-size:12px;margin-left:4px;">(${sizeKB} KB)</span>`;
        resultActions.appendChild(dl);
    });

    const again = document.createElement('button');
    again.className = 'btn-edit-again';
    again.innerHTML = '<i class="fas fa-pen-to-square"></i> Edit Again';
    again.addEventListener('click', () => resultPanel.classList.remove('visible'));
    resultActions.appendChild(again);

    resultPanel.querySelector('h3').textContent = title || 'PDF Ready';
    resultPanel.querySelector('p').textContent = `${blobs.length} file(s) ready to download`;
    resultPanel.classList.add('visible');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ─────────────────────────────────────────
   UNDO / REDO STACK
───────────────────────────────────────── */
function pushUndo(label) {
    const snapshot = {
        label,
        pages: state.pages.map(p => ({ ...p })),
        selected: new Set(state.selected),
    };
    state.undoStack.push(snapshot);
    state.redoStack = []; // clear redo on new action
    if (state.undoStack.length > 50) state.undoStack.shift();
    updateToolbarState();
}

function restoreState(snapshot) {
    state.pages = snapshot.pages.map(p => ({ ...p }));
    state.selected = new Set(snapshot.selected);
    renderGrid();
}

/* ─────────────────────────────────────────
   RANGE PARSER (for Split)
───────────────────────────────────────── */
function parseRanges(raw, total) {
    const groups = [];
    const parts = raw.split(',');
    for (const part of parts) {
        const t = part.trim();
        if (!t) continue;
        if (t.includes('-')) {
            const [a, b] = t.split('-').map(Number);
            if (isNaN(a) || isNaN(b) || a < 1 || b > total || a > b) return null;
            const g = [];
            for (let i = a - 1; i <= b - 1; i++) g.push(i);
            groups.push(g);
        } else {
            const n = Number(t);
            if (isNaN(n) || n < 1 || n > total) return null;
            groups.push([n - 1]);
        }
    }
    return groups.length ? groups : null;
}

/* ─────────────────────────────────────────
   UI HELPERS
───────────────────────────────────────── */
function showWorkspace() {
    uploadZone.style.display = 'none';
    editorWorkspace.classList.add('visible');
    saveBar.style.display = 'flex';
    updateSaveBarInfo();
}

function showProgress(msg) {
    progressMsg.textContent = msg;
    progressPanel.classList.add('visible');
}

function hideProgress() {
    progressPanel.classList.remove('visible');
}

function updatePageCount() {
    const el = document.getElementById('pageCount');
    if (el) el.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''}`;
}

function updateFileLabel() {
    if (!fileLabel) return;
    if (state.fileNames.length === 0) {
        fileLabel.textContent = 'No files';
        fileMeta.textContent = '';
    } else if (state.fileNames.length === 1) {
        fileLabel.textContent = state.fileNames[0];
        fileMeta.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''}`;
    } else {
        fileLabel.textContent = `${state.fileNames.length} PDF files`;
        fileMeta.textContent = `${state.pages.length} total pages`;
    }
}

function updateToolbarState() {
    const hasSel = state.selected.size > 0;
    const hasPages = state.pages.length > 0;
    btnRotL.disabled = !hasSel;
    btnRotR.disabled = !hasSel;
    btnRemove.disabled = !hasSel;
    btnExtract.disabled = !hasSel;
    btnMerge.disabled = !hasPages;
    btnSave.disabled = !hasPages;
    btnUndo.disabled = state.undoStack.length <= 1;
    btnRedo.disabled = state.redoStack.length === 0;
    updateSaveBarInfo();
}

function updateSaveBarInfo() {
    if (!saveBarInfo) return;
    const total = state.pages.length;
    const sel = state.selected.size;
    if (sel > 0) {
        saveBarInfo.innerHTML = `<strong>${sel}</strong> of ${total} page${total !== 1 ? 's' : ''} selected`;
    } else {
        saveBarInfo.innerHTML = `<strong>${total}</strong> page${total !== 1 ? 's' : ''} • Click pages to select`;
    }
}

function showError(msg) {
    errorBanner.classList.add('visible');
    errorMsg.textContent = msg;
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearError() {
    errorBanner.classList.remove('visible');
    errorMsg.textContent = '';
}

let toastTimer;
function showToast(msg) {
    peToast.textContent = msg;
    peToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => peToast.classList.remove('show'), 2400);
}

function showConfirm(title, body, onConfirm) {
    confirmMsg.innerHTML = `<strong>${title}</strong><br><span style="font-size:13px;color:#888;">${body}</span>`;
    confirmModal.classList.add('open');
    const cleanup = () => confirmModal.classList.remove('open');
    btnConfirmOk.onclick = () => { cleanup(); onConfirm(); };
    btnConfirmCancel.onclick = cleanup;
}
