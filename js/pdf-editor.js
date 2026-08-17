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
    pages: [],          // { pdfIndex, pageIndex, rotation, annotations[] }
    pdfDocs: [],        // loaded PDFLib documents
    pdfJsDocs: [],      // loaded PDF.js documents
    fileNames: [],      // original file names
    selected: new Set(),
    undoStack: [],
    redoStack: [],
    splitMode: false,
    resultBlobs: [],
};

/* annotation: { type:'text'|'crop'|'rect', ...props } */

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
const errorBanner     = document.getElementById('errorBanner');
const errorMsg        = document.getElementById('errorMsg');
const confirmModal    = document.getElementById('confirmModal');
const confirmMsg      = document.getElementById('confirmMsg');
const btnConfirmOk    = document.getElementById('btnConfirmOk');
const btnConfirmCancel= document.getElementById('btnConfirmCancel');
const peToast         = document.getElementById('peToast');

/* Page Editor Modal */
const pageEditorModal  = document.getElementById('pageEditorModal');
const peCanvasWrap     = document.getElementById('peCanvasWrap');
const peCanvas         = document.getElementById('peCanvas');
const peAnnotCanvas    = document.getElementById('peAnnotCanvas');
const pePrevBtn        = document.getElementById('pePrevPage');
const peNextBtn        = document.getElementById('peNextPage');
const pePageIndicator  = document.getElementById('pePageIndicator');
const peCloseBtn       = document.getElementById('peClose');
const peDoneBtn        = document.getElementById('peDone');
const peToolBtns       = document.querySelectorAll('.pe-tool-btn');
const peTextColor      = document.getElementById('peTextColor');
const peTextSize       = document.getElementById('peTextSize');
const peFontFamily     = document.getElementById('peFontFamily');
const peCropConfirmBar = document.getElementById('peCropConfirmBar');
const peCropApply      = document.getElementById('peCropApply');
const peCropCancel     = document.getElementById('peCropCancel');
const peAnnotList      = document.getElementById('peAnnotList');
const peUndoBtn        = document.getElementById('peUndo');
const peRedoBtn        = document.getElementById('peRedo');
const peRotLeftBtn     = document.getElementById('peRotLeft');
const peRotRightBtn    = document.getElementById('peRotRight');
const peDeletePageBtn  = document.getElementById('peDeletePage');
const peZoomIn         = document.getElementById('peZoomIn');
const peZoomOut        = document.getElementById('peZoomOut');
const peZoomLabel      = document.getElementById('peZoomLabel');

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
        if (state.fileNames.includes(file.name)) {
            showToast(`"${file.name}" already loaded — skipping.`);
            continue;
        }
        try {
            const arrayBuf = await file.arrayBuffer();
            let libDoc;
            try {
                libDoc = await PDFLib.PDFDocument.load(arrayBuf, { ignoreEncryption: false });
            } catch (encErr) {
                showError(`"${file.name}" is password-protected or corrupted.`);
                continue;
            }
            const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
            const pdfIdx = state.pdfDocs.length;
            state.pdfDocs.push(libDoc);
            state.pdfJsDocs.push(pdfJsDoc);
            state.fileNames.push(file.name);

            const pc = libDoc.getPageCount();
            for (let p = 0; p < pc; p++) {
                state.pages.push({ pdfIndex: pdfIdx, pageIndex: p, rotation: 0, annotations: [] });
            }
        } catch (err) {
            console.error('PDF load error:', err);
            showError(`Failed to load "${file.name}". The file may be corrupted.`);
        }
    }

    if (state.pages.length === 0) { hideProgress(); return; }
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

    const annotCount = (pg.annotations || []).length;

    card.innerHTML = `
        <div class="page-thumb-wrap page-thumb-loading" id="thumbWrap_${idx}">
            <div class="spin"></div>
        </div>
        <div class="page-rotation-badge" id="rotBadge_${idx}"></div>
        ${annotCount > 0 ? `<div class="page-annot-badge">${annotCount} edit${annotCount > 1 ? 's' : ''}</div>` : ''}
        <div class="page-hover-overlay">
            <span class="page-edit-hint"><i class="fas fa-pen-to-square"></i> Edit Page</span>
        </div>
        <div class="page-footer">
            <span class="page-num">Page ${idx + 1}</span>
            <div style="display:flex;align-items:center;gap:6px;">
                <button type="button" class="page-card-edit-btn" data-edit="1" title="Open Page Editor">
                    <i class="fas fa-pen-to-square"></i>
                </button>
                <div class="page-check" id="pageCheck_${idx}" data-check="1" title="Select / Deselect">
                    ${state.selected.has(idx) ? '<span style="color:#fff;font-size:11px;font-weight:700;">✓</span>' : ''}
                </div>
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

        // Draw text annotation previews on thumb
        const annots = pg.annotations || [];
        annots.filter(a => a.type === 'text').forEach(a => {
            ctx.save();
            ctx.font = `${Math.max(6, (a.fontSize || 16) * 0.4)}px ${a.fontFamily || 'sans-serif'}`;
            ctx.fillStyle = a.color || '#000';
            ctx.globalAlpha = 0.85;
            ctx.fillText(a.text, a.xPct * canvas.width, a.yPct * canvas.height);
            ctx.restore();
        });
        // Draw crop preview
        annots.filter(a => a.type === 'crop').forEach(a => {
            ctx.save();
            ctx.strokeStyle = 'rgba(108,99,255,0.7)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 2]);
            ctx.strokeRect(a.x1Pct * canvas.width, a.y1Pct * canvas.height,
                (a.x2Pct - a.x1Pct) * canvas.width, (a.y2Pct - a.y1Pct) * canvas.height);
            ctx.restore();
        });

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
    badge.style.display = norm === 0 ? 'none' : 'block';
    if (norm !== 0) badge.textContent = `${norm}°`;
}

/* ─────────────────────────────────────────
   CARD EVENTS — click/dblclick → page editor
   click checkbox → select/deselect
───────────────────────────────────────── */
function bindCardEvents(card, idx) {
    card.addEventListener('click', e => {
        // Checkbox click → select
        if (e.target.closest('[data-check]')) {
            e.stopPropagation();
            toggleSelect(idx, card);
            return;
        }
        // Any other click (or edit button) → open page editor
        openPageEditor(idx);
    });

    card.addEventListener('dblclick', e => {
        if (!e.target.closest('[data-check]')) {
            openPageEditor(idx);
        }
    });
}

function toggleSelect(idx, card) {
    if (state.selected.has(idx)) {
        state.selected.delete(idx);
        card.classList.remove('selected');
        const chk = card.querySelector('[data-check]');
        if (chk) chk.innerHTML = '';
    } else {
        state.selected.add(idx);
        card.classList.add('selected');
        const chk = card.querySelector('[data-check]');
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
        const moved = state.pages.splice(dragSrcIdx, 1)[0];
        state.pages.splice(dragSrcIdx < idx ? idx - 1 : idx, 0, moved);
        const newSel = new Set();
        state.selected.forEach(s => {
            if (s === dragSrcIdx) newSel.add(dragSrcIdx < idx ? idx - 1 : idx);
            else if (dragSrcIdx < idx && s > dragSrcIdx && s <= idx - 1) newSel.add(s - 1);
            else if (dragSrcIdx > idx && s >= idx && s < dragSrcIdx) newSel.add(s + 1);
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
   PAGE EDITOR MODAL
───────────────────────────────────────── */
let peState = {
    pageIdx: 0,
    activeTool: 'select',   // select | text | crop | rect | highlight
    zoom: 1.0,
    viewport: null,
    pdfJsPage: null,
    annotHistory: [],       // undo stack for annotations within this page
    annotRedoStack: [],
    cropRect: null,         // { x1, y1, x2, y2 } in canvas px
    isDragging: false,
    dragStart: null,
    textInputEl: null,
};

async function openPageEditor(pageIdx) {
    peState.pageIdx = pageIdx;
    peState.activeTool = 'select';
    peState.zoom = 1.0;
    peState.cropRect = null;
    peState.annotHistory = [JSON.parse(JSON.stringify(state.pages[pageIdx].annotations || []))];
    peState.annotRedoStack = [];

    pageEditorModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setActiveTool('select');
    await renderPageInEditor();
    updatePeNav();
    updatePeAnnotList();
    updatePeHistoryBtns();
}

function closePageEditor() {
    pageEditorModal.classList.remove('open');
    document.body.style.overflow = '';
    if (peState.textInputEl) {
        peState.textInputEl.remove();
        peState.textInputEl = null;
    }
    clearCropRect();
}

peCloseBtn.addEventListener('click', () => {
    closePageEditor();
    renderThumb(peState.pageIdx);
});

peDoneBtn.addEventListener('click', () => {
    closePageEditor();
    renderGrid();
});

/* Navigation */
pePrevBtn.addEventListener('click', async () => {
    if (peState.pageIdx > 0) {
        renderThumb(peState.pageIdx);
        peState.pageIdx--;
        peState.annotHistory = [JSON.parse(JSON.stringify(state.pages[peState.pageIdx].annotations || []))];
        peState.annotRedoStack = [];
        peState.zoom = 1.0;
        clearCropRect();
        await renderPageInEditor();
        updatePeNav();
        updatePeAnnotList();
    }
});

peNextBtn.addEventListener('click', async () => {
    if (peState.pageIdx < state.pages.length - 1) {
        renderThumb(peState.pageIdx);
        peState.pageIdx++;
        peState.annotHistory = [JSON.parse(JSON.stringify(state.pages[peState.pageIdx].annotations || []))];
        peState.annotRedoStack = [];
        peState.zoom = 1.0;
        clearCropRect();
        await renderPageInEditor();
        updatePeNav();
        updatePeAnnotList();
    }
});

function updatePeNav() {
    pePageIndicator.textContent = `Page ${peState.pageIdx + 1} of ${state.pages.length}`;
    pePrevBtn.disabled = peState.pageIdx === 0;
    peNextBtn.disabled = peState.pageIdx === state.pages.length - 1;
}

/* Zoom */
peZoomIn.addEventListener('click', async () => {
    if (peState.zoom < 3) { peState.zoom = Math.min(3, peState.zoom + 0.25); await renderPageInEditor(); }
});
peZoomOut.addEventListener('click', async () => {
    if (peState.zoom > 0.5) { peState.zoom = Math.max(0.5, peState.zoom - 0.25); await renderPageInEditor(); }
});

/* Rotate within editor */
peRotLeftBtn.addEventListener('click', async () => {
    pushUndo('rotate');
    state.pages[peState.pageIdx].rotation = ((state.pages[peState.pageIdx].rotation - 90) % 360 + 360) % 360;
    await renderPageInEditor();
    showToast('Rotated left');
});
peRotRightBtn.addEventListener('click', async () => {
    pushUndo('rotate');
    state.pages[peState.pageIdx].rotation = ((state.pages[peState.pageIdx].rotation + 90) % 360 + 360) % 360;
    await renderPageInEditor();
    showToast('Rotated right');
});

/* Delete page from within editor */
peDeletePageBtn.addEventListener('click', () => {
    showConfirm('Remove this page?', 'You can undo this with the Undo button.', () => {
        pushUndo('remove');
        state.pages.splice(peState.pageIdx, 1);
        state.selected.clear();
        closePageEditor();
        renderGrid();
        showToast('Page removed. Use Undo to restore.');
    });
});

/* Render page on PDF.js canvas */
async function renderPageInEditor() {
    const pg = state.pages[peState.pageIdx];
    const pdfJsDoc = state.pdfJsDocs[pg.pdfIndex];

    // Show loading
    peCanvas.style.opacity = '0.4';

    peState.pdfJsPage = await pdfJsDoc.getPage(pg.pageIndex + 1);
    const viewport = peState.pdfJsPage.getViewport({ scale: 1.5 * peState.zoom, rotation: pg.rotation });
    peState.viewport = viewport;

    peCanvas.width = viewport.width;
    peCanvas.height = viewport.height;
    peAnnotCanvas.width = viewport.width;
    peAnnotCanvas.height = viewport.height;

    const ctx = peCanvas.getContext('2d');
    await peState.pdfJsPage.render({ canvasContext: ctx, viewport }).promise;
    peCanvas.style.opacity = '1';

    peZoomLabel.textContent = `${Math.round(peState.zoom * 100)}%`;

    redrawAnnotations();
}

/* Redraw all annotations on annot canvas */
function redrawAnnotations() {
    const ctx = peAnnotCanvas.getContext('2d');
    ctx.clearRect(0, 0, peAnnotCanvas.width, peAnnotCanvas.height);

    const pg = state.pages[peState.pageIdx];
    (pg.annotations || []).forEach(a => {
        if (a.type === 'text') {
            ctx.save();
            ctx.font = `${(a.fontSize || 16) * peState.zoom}px ${a.fontFamily || 'Helvetica'}`;
            ctx.fillStyle = a.color || '#000000';
            ctx.globalAlpha = 0.92;
            ctx.fillText(a.text, a.xPct * peAnnotCanvas.width, a.yPct * peAnnotCanvas.height);
            // Selection indicator
            ctx.strokeStyle = 'rgba(108,99,255,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            const m = ctx.measureText(a.text);
            ctx.strokeRect(a.xPct * peAnnotCanvas.width - 2,
                a.yPct * peAnnotCanvas.height - (a.fontSize || 16) * peState.zoom,
                m.width + 4, (a.fontSize || 16) * peState.zoom + 4);
            ctx.restore();
        }
        if (a.type === 'crop') {
            ctx.save();
            ctx.strokeStyle = 'rgba(108,99,255,0.85)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(
                a.x1Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height,
                (a.x2Pct - a.x1Pct) * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height
            );
            // Dim outside
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fillRect(0, 0, peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height);
            ctx.fillRect(0, a.y2Pct * peAnnotCanvas.height, peAnnotCanvas.width, peAnnotCanvas.height);
            ctx.fillRect(0, a.y1Pct * peAnnotCanvas.height, a.x1Pct * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height);
            ctx.fillRect(a.x2Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height, (1 - a.x2Pct) * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height);
            ctx.restore();
        }
        if (a.type === 'rect') {
            ctx.save();
            ctx.strokeStyle = a.color || 'rgba(108,99,255,0.85)';
            ctx.lineWidth = 2.5 * peState.zoom;
            ctx.setLineDash([]);
            ctx.strokeRect(
                a.x1Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height,
                (a.x2Pct - a.x1Pct) * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height
            );
            ctx.restore();
        }
        if (a.type === 'highlight') {
            ctx.save();
            ctx.fillStyle = a.color || 'rgba(255,235,0,0.4)';
            ctx.fillRect(
                a.x1Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height,
                (a.x2Pct - a.x1Pct) * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height
            );
            ctx.restore();
        }
    });

    // Draw active crop rect
    if (peState.cropRect) {
        const r = peState.cropRect;
        ctx.save();
        ctx.strokeStyle = '#6C63FF';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.fillStyle = 'rgba(108,99,255,0.08)';
        ctx.fillRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.restore();
    }
}

/* ── Tool Selection ── */
peToolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setActiveTool(btn.dataset.tool);
    });
});

function setActiveTool(tool) {
    peState.activeTool = tool;
    peToolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

    // Show/hide text options
    document.getElementById('peTextOptions').style.display =
        (tool === 'text') ? 'flex' : 'none';

    peAnnotCanvas.style.cursor =
        tool === 'text' ? 'text' :
        tool === 'crop' ? 'crosshair' :
        tool === 'rect' ? 'crosshair' :
        tool === 'highlight' ? 'crosshair' : 'default';

    if (tool !== 'crop') clearCropRect();
}

/* ── Canvas Interaction ── */
peAnnotCanvas.addEventListener('mousedown', onCanvasDown);
peAnnotCanvas.addEventListener('mousemove', onCanvasMove);
peAnnotCanvas.addEventListener('mouseup', onCanvasUp);

// Touch support
peAnnotCanvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    onCanvasDown({ clientX: t.clientX, clientY: t.clientY, target: peAnnotCanvas });
    e.preventDefault();
}, { passive: false });
peAnnotCanvas.addEventListener('touchmove', e => {
    const t = e.touches[0];
    onCanvasMove({ clientX: t.clientX, clientY: t.clientY });
    e.preventDefault();
}, { passive: false });
peAnnotCanvas.addEventListener('touchend', e => {
    onCanvasUp({});
    e.preventDefault();
}, { passive: false });

function getCanvasXY(e) {
    const rect = peAnnotCanvas.getBoundingClientRect();
    const scaleX = peAnnotCanvas.width / rect.width;
    const scaleY = peAnnotCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function onCanvasDown(e) {
    const { x, y } = getCanvasXY(e);
    peState.isDragging = true;
    peState.dragStart = { x, y };

    if (peState.activeTool === 'text') {
        placeTextInput(x, y);
    }
    if (peState.activeTool === 'crop' || peState.activeTool === 'rect' || peState.activeTool === 'highlight') {
        peState.cropRect = { x1: x, y1: y, x2: x, y2: y };
    }
}

function onCanvasMove(e) {
    if (!peState.isDragging) return;
    const { x, y } = getCanvasXY(e);
    if ((peState.activeTool === 'crop' || peState.activeTool === 'rect' || peState.activeTool === 'highlight') && peState.cropRect) {
        peState.cropRect.x2 = x;
        peState.cropRect.y2 = y;
        redrawAnnotations();
    }
}

function onCanvasUp(e) {
    if (!peState.isDragging) return;
    peState.isDragging = false;
    const r = peState.cropRect;

    if (peState.activeTool === 'crop' && r && Math.abs(r.x2 - r.x1) > 20 && Math.abs(r.y2 - r.y1) > 20) {
        peCropConfirmBar.classList.add('visible');
    }

    if ((peState.activeTool === 'rect' || peState.activeTool === 'highlight') && r && Math.abs(r.x2 - r.x1) > 10) {
        commitDrawAnnotation(peState.activeTool, r);
        peState.cropRect = null;
    }
}

/* ── Text Input Overlay ── */
function placeTextInput(x, y) {
    if (peState.textInputEl) peState.textInputEl.remove();

    const rect = peAnnotCanvas.getBoundingClientRect();
    const scaleX = rect.width / peAnnotCanvas.width;
    const scaleY = rect.height / peAnnotCanvas.height;

    const wrap = document.createElement('div');
    wrap.style.cssText = `
        position:absolute;
        left:${(x * scaleX)}px;
        top:${(y * scaleY)}px;
        z-index:50;
        display:flex;
        gap:6px;
        align-items:center;
    `;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'Type text…';
    inp.style.cssText = `
        padding:6px 10px;
        font-family:${peFontFamily ? peFontFamily.value : 'Helvetica'};
        font-size:${peTextSize ? peTextSize.value : 16}px;
        color:${peTextColor ? peTextColor.value : '#000000'};
        border:2px solid #6C63FF;
        border-radius:8px;
        background:rgba(255,255,255,0.95);
        outline:none;
        min-width:140px;
        box-shadow:0 4px 16px rgba(108,99,255,0.2);
    `;

    const ok = document.createElement('button');
    ok.textContent = '✓';
    ok.style.cssText = `padding:6px 12px;border-radius:8px;border:none;background:#6C63FF;color:#fff;font-weight:700;cursor:pointer;`;

    const cancel = document.createElement('button');
    cancel.textContent = '✕';
    cancel.style.cssText = `padding:6px 10px;border-radius:8px;border:none;background:#eee;cursor:pointer;`;

    wrap.appendChild(inp);
    wrap.appendChild(ok);
    wrap.appendChild(cancel);
    peCanvasWrap.style.position = 'relative';
    peCanvasWrap.appendChild(wrap);
    peState.textInputEl = wrap;
    inp.focus();

    const commit = () => {
        const txt = inp.value.trim();
        if (txt) {
            pushPeUndo();
            const annot = {
                type: 'text',
                text: txt,
                xPct: x / peAnnotCanvas.width,
                yPct: y / peAnnotCanvas.height,
                fontSize: parseInt(peTextSize ? peTextSize.value : 16),
                fontFamily: peFontFamily ? peFontFamily.value : 'Helvetica',
                color: peTextColor ? peTextColor.value : '#000000',
            };
            const pg = state.pages[peState.pageIdx];
            if (!pg.annotations) pg.annotations = [];
            pg.annotations.push(annot);
            redrawAnnotations();
            updatePeAnnotList();
            showToast('Text added');
        }
        wrap.remove();
        peState.textInputEl = null;
    };

    ok.addEventListener('click', commit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { wrap.remove(); peState.textInputEl = null; } });
    cancel.addEventListener('click', () => { wrap.remove(); peState.textInputEl = null; });
}

/* ── Commit drawn rect/highlight ── */
function commitDrawAnnotation(type, r) {
    pushPeUndo();
    const x1 = Math.min(r.x1, r.x2) / peAnnotCanvas.width;
    const y1 = Math.min(r.y1, r.y2) / peAnnotCanvas.height;
    const x2 = Math.max(r.x1, r.x2) / peAnnotCanvas.width;
    const y2 = Math.max(r.y1, r.y2) / peAnnotCanvas.height;

    const annot = { type, x1Pct: x1, y1Pct: y1, x2Pct: x2, y2Pct: y2,
        color: type === 'highlight' ? 'rgba(255,235,0,0.45)' : (peTextColor ? peTextColor.value : '#6C63FF') };

    const pg = state.pages[peState.pageIdx];
    if (!pg.annotations) pg.annotations = [];
    pg.annotations.push(annot);
    redrawAnnotations();
    updatePeAnnotList();
    showToast(type === 'highlight' ? 'Highlight added' : 'Rectangle added');
}

/* ── Crop Apply / Cancel ── */
peCropApply.addEventListener('click', () => {
    const r = peState.cropRect;
    if (!r) return;
    pushPeUndo();
    const x1 = Math.min(r.x1, r.x2) / peAnnotCanvas.width;
    const y1 = Math.min(r.y1, r.y2) / peAnnotCanvas.height;
    const x2 = Math.max(r.x1, r.x2) / peAnnotCanvas.width;
    const y2 = Math.max(r.y1, r.y2) / peAnnotCanvas.height;

    const pg = state.pages[peState.pageIdx];
    if (!pg.annotations) pg.annotations = [];
    // Remove previous crop
    pg.annotations = pg.annotations.filter(a => a.type !== 'crop');
    pg.annotations.push({ type: 'crop', x1Pct: x1, y1Pct: y1, x2Pct: x2, y2Pct: y2 });
    clearCropRect();
    peCropConfirmBar.classList.remove('visible');
    redrawAnnotations();
    updatePeAnnotList();
    showToast('Crop area set — will be applied on Save');
});

peCropCancel.addEventListener('click', () => {
    clearCropRect();
    peCropConfirmBar.classList.remove('visible');
});

function clearCropRect() {
    peState.cropRect = null;
    redrawAnnotations();
}

/* ── Annotation List ── */
function updatePeAnnotList() {
    const pg = state.pages[peState.pageIdx];
    const annots = pg.annotations || [];
    if (!peAnnotList) return;
    if (annots.length === 0) {
        peAnnotList.innerHTML = '<div class="pe-annot-empty">No edits yet. Use the tools above.</div>';
        return;
    }
    peAnnotList.innerHTML = annots.map((a, i) => {
        const icon = a.type === 'text' ? '💬' : a.type === 'crop' ? '✂️' : a.type === 'highlight' ? '🖊️' : '▭';
        const label = a.type === 'text' ? `"${a.text.substring(0,24)}${a.text.length>24?'…':''}"` :
                      a.type === 'crop' ? `Crop area` :
                      a.type === 'highlight' ? 'Highlight' : 'Rectangle';
        return `<div class="pe-annot-item">
            <span>${icon} ${label}</span>
            <button class="pe-annot-del" data-aidx="${i}" title="Remove">✕</button>
        </div>`;
    }).join('');

    peAnnotList.querySelectorAll('.pe-annot-del').forEach(btn => {
        btn.addEventListener('click', () => {
            pushPeUndo();
            const i = parseInt(btn.dataset.aidx);
            const pg2 = state.pages[peState.pageIdx];
            pg2.annotations.splice(i, 1);
            redrawAnnotations();
            updatePeAnnotList();
            showToast('Edit removed');
        });
    });
}

/* ── Per-page Undo/Redo ── */
function pushPeUndo() {
    const pg = state.pages[peState.pageIdx];
    peState.annotHistory.push(JSON.parse(JSON.stringify(pg.annotations || [])));
    peState.annotRedoStack = [];
    updatePeHistoryBtns();
}

function updatePeHistoryBtns() {
    peUndoBtn.disabled = peState.annotHistory.length <= 1;
    peRedoBtn.disabled = peState.annotRedoStack.length === 0;
}

peUndoBtn.addEventListener('click', () => {
    if (peState.annotHistory.length <= 1) return;
    const cur = peState.annotHistory.pop();
    peState.annotRedoStack.push(cur);
    const pg = state.pages[peState.pageIdx];
    pg.annotations = JSON.parse(JSON.stringify(peState.annotHistory[peState.annotHistory.length - 1]));
    redrawAnnotations();
    updatePeAnnotList();
    updatePeHistoryBtns();
    showToast('Undone');
});

peRedoBtn.addEventListener('click', () => {
    if (peState.annotRedoStack.length === 0) return;
    const next = peState.annotRedoStack.pop();
    peState.annotHistory.push(next);
    const pg = state.pages[peState.pageIdx];
    pg.annotations = JSON.parse(JSON.stringify(next));
    redrawAnnotations();
    updatePeAnnotList();
    updatePeHistoryBtns();
    showToast('Redone');
});

/* Close on overlay click */
pageEditorModal.addEventListener('click', e => {
    if (e.target === pageEditorModal) closePageEditor();
});

/* ─────────────────────────────────────────
   TOOLBAR ACTIONS (grid level)
───────────────────────────────────────── */
btnSelectAll.addEventListener('click', () => {
    state.pages.forEach((_, i) => state.selected.add(i));
    document.querySelectorAll('.page-card').forEach((c, i) => {
        c.classList.add('selected');
        const chk = c.querySelector('[data-check]');
        if (chk) chk.innerHTML = '<span style="color:#fff;font-size:11px;font-weight:700;">✓</span>';
    });
    updateToolbarState();
    updateSaveBarInfo();
});

btnDeselectAll.addEventListener('click', () => {
    state.selected.clear();
    document.querySelectorAll('.page-card').forEach(c => {
        c.classList.remove('selected');
        const chk = c.querySelector('[data-check]');
        if (chk) chk.innerHTML = '';
    });
    updateToolbarState();
    updateSaveBarInfo();
});

btnRotL.addEventListener('click', () => rotateSel(-90));
btnRotR.addEventListener('click', () => rotateSel(90));

function rotateSel(deg) {
    if (state.selected.size === 0) { showToast('Select pages to rotate.'); return; }
    pushUndo('rotate');
    state.selected.forEach(i => {
        state.pages[i].rotation = ((state.pages[i].rotation + deg) % 360 + 360) % 360;
    });
    state.selected.forEach(i => {
        const card = document.querySelector(`.page-card[data-idx="${i}"]`);
        if (card) updateRotationBadge(card, state.pages[i].rotation);
        const wrap = document.getElementById(`thumbWrap_${i}`);
        if (wrap) { wrap.innerHTML = '<div class="spin"></div>'; wrap.classList.add('page-thumb-loading'); }
        renderThumb(i);
    });
    showToast(`Rotated ${state.selected.size} page(s) ${deg > 0 ? 'right' : 'left'}`);
}

btnRemove.addEventListener('click', () => {
    if (state.selected.size === 0) { showToast('Select pages to remove.'); return; }
    showConfirm(`Remove ${state.selected.size} page(s)?`, 'This can be undone with the Undo button.', () => {
        pushUndo('remove');
        const toRemove = Array.from(state.selected).sort((a, b) => b - a);
        toRemove.forEach(i => state.pages.splice(i, 1));
        state.selected.clear();
        renderGrid();
        showToast(`Removed ${toRemove.length} page(s). Use Undo to restore.`);
    });
});

btnExtract.addEventListener('click', async () => {
    if (state.selected.size === 0) { showToast('Select pages to extract.'); return; }
    const indices = Array.from(state.selected).sort((a, b) => a - b);
    await buildAndDownload(indices, 'extracted');
});

btnMerge.addEventListener('click', async () => {
    if (state.pages.length === 0) { showToast('No pages to merge.'); return; }
    await buildAndDownload(state.pages.map((_, i) => i), 'merged');
});

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
        const blob = await buildBlob(groups[g]);
        if (blob) state.resultBlobs.push({ blob, name: `split_part${g + 1}.pdf` });
    }
    hideProgress();
    showResultMultiple(state.resultBlobs, 'Split complete!');
    splitPanel.classList.remove('visible');
    state.splitMode = false;
    btnSplit.classList.remove('active');
});

btnUndo.addEventListener('click', () => {
    if (state.undoStack.length <= 1) { showToast('Nothing to undo.'); return; }
    const cur = state.undoStack.pop();
    state.redoStack.push(cur);
    restoreState(state.undoStack[state.undoStack.length - 1]);
    updateToolbarState();
    showToast('Undone');
});

btnRedo.addEventListener('click', () => {
    if (state.redoStack.length === 0) { showToast('Nothing to redo.'); return; }
    const next = state.redoStack.pop();
    state.undoStack.push(next);
    restoreState(next);
    updateToolbarState();
    showToast('Redone');
});

btnSave.addEventListener('click', async () => {
    if (state.pages.length === 0) return;
    await buildAndDownload(state.pages.map((_, i) => i), 'edited');
});

/* ─────────────────────────────────────────
   BUILD PDF BLOB (with annotations)
───────────────────────────────────────── */
async function buildBlob(pageIndices) {
    try {
        const out = await PDFLib.PDFDocument.create();
        const { rgb, StandardFonts, degrees } = PDFLib;

        for (const pi of pageIndices) {
            const pg = state.pages[pi];
            const srcDoc = state.pdfDocs[pg.pdfIndex];
            const [copied] = await out.copyPages(srcDoc, [pg.pageIndex]);

            // Apply rotation
            const curRot = copied.getRotation().angle;
            const totalRot = (curRot + pg.rotation) % 360;
            copied.setRotation(degrees(totalRot));

            out.addPage(copied);
            const outPage = out.getPages()[out.getPageCount() - 1];
            const { width, height } = outPage.getSize();

            // Apply annotations
            for (const a of (pg.annotations || [])) {
                if (a.type === 'text') {
                    try {
                        const fontMap = {
                            'Helvetica': StandardFonts.Helvetica,
                            'Times New Roman': StandardFonts.TimesRoman,
                            'Courier': StandardFonts.Courier,
                        };
                        const fontKey = fontMap[a.fontFamily] || StandardFonts.Helvetica;
                        const font = await out.embedFont(fontKey);
                        const hexColor = a.color || '#000000';
                        const r_ = parseInt(hexColor.slice(1,3),16)/255;
                        const g_ = parseInt(hexColor.slice(3,5),16)/255;
                        const b_ = parseInt(hexColor.slice(5,7),16)/255;
                        outPage.drawText(a.text, {
                            x: a.xPct * width,
                            y: height - (a.yPct * height),
                            size: a.fontSize || 16,
                            font,
                            color: rgb(r_, g_, b_),
                        });
                    } catch (te) { console.warn('Text annotation embed failed:', te); }
                }
                if (a.type === 'crop') {
                    const x = a.x1Pct * width;
                    const y_ = (1 - a.y2Pct) * height;
                    const w = (a.x2Pct - a.x1Pct) * width;
                    const h = (a.y2Pct - a.y1Pct) * height;
                    outPage.setCropBox(x, y_, w, h);
                }
                if (a.type === 'rect') {
                    const x = a.x1Pct * width;
                    const y_ = (1 - a.y2Pct) * height;
                    const w = (a.x2Pct - a.x1Pct) * width;
                    const h = (a.y2Pct - a.y1Pct) * height;
                    const hexC = a.color || '#6C63FF';
                    const r_ = parseInt(hexC.slice(1,3),16)/255;
                    const g_ = parseInt(hexC.slice(3,5),16)/255;
                    const b_ = parseInt(hexC.slice(5,7),16)/255;
                    outPage.drawRectangle({ x, y: y_, width: w, height: h,
                        borderColor: rgb(r_, g_, b_), borderWidth: 2, opacity: 0 });
                }
                if (a.type === 'highlight') {
                    const x = a.x1Pct * width;
                    const y_ = (1 - a.y2Pct) * height;
                    const w = (a.x2Pct - a.x1Pct) * width;
                    const h = (a.y2Pct - a.y1Pct) * height;
                    outPage.drawRectangle({ x, y: y_, width: w, height: h,
                        color: PDFLib.rgb(1, 0.95, 0), opacity: 0.4 });
                }
            }
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
        dl.href = url; dl.download = name; dl.className = 'btn-download';
        dl.style.marginBottom = '6px';
        dl.innerHTML = `<i class="fas fa-download"></i> ${name} <span style="opacity:0.7;font-size:12px;margin-left:4px;">(${sizeKB} KB)</span>`;
        resultActions.appendChild(dl);
    });
    const again = document.createElement('button');
    again.className = 'btn-edit-again';
    again.innerHTML = '<i class="fas fa-pen-to-square"></i> Edit Again';
    again.addEventListener('click', () => resultPanel.classList.remove('visible'));
    resultActions.appendChild(again);
    if (resultPanel.querySelector('h3')) resultPanel.querySelector('h3').textContent = title || 'PDF Ready';
    resultPanel.querySelector('p').textContent = `${blobs.length} file(s) ready to download`;
    resultPanel.classList.add('visible');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ─────────────────────────────────────────
   UNDO / REDO STACK (grid level)
───────────────────────────────────────── */
function pushUndo(label) {
    const snapshot = {
        label,
        pages: state.pages.map(p => ({ ...p, annotations: JSON.parse(JSON.stringify(p.annotations || [])) })),
        selected: new Set(state.selected),
    };
    state.undoStack.push(snapshot);
    state.redoStack = [];
    if (state.undoStack.length > 50) state.undoStack.shift();
    updateToolbarState();
}

function restoreState(snapshot) {
    state.pages = snapshot.pages.map(p => ({ ...p, annotations: JSON.parse(JSON.stringify(p.annotations || [])) }));
    state.selected = new Set(snapshot.selected);
    renderGrid();
}

/* ─────────────────────────────────────────
   RANGE PARSER
───────────────────────────────────────── */
function parseRanges(raw, total) {
    const groups = [];
    for (const part of raw.split(',')) {
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
        fileLabel.textContent = 'No files'; fileMeta.textContent = '';
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
    saveBarInfo.innerHTML = sel > 0
        ? `<strong>${sel}</strong> of ${total} page${total !== 1 ? 's' : ''} selected`
        : `<strong>${total}</strong> page${total !== 1 ? 's' : ''} • Click a page to edit it`;
}

function showError(msg) {
    errorBanner.classList.add('visible');
    errorMsg.textContent = msg;
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
    btnConfirmOk.onclick = () => { confirmModal.classList.remove('open'); onConfirm(); };
    btnConfirmCancel.onclick = () => confirmModal.classList.remove('open');
}
