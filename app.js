// =========================================================
// צ. ביקורת מבנים - אפליקציית בדק בית וחוות דעת מומחה (Reporto 1:1)
// =========================================================

// Global State
let db = window.REPORTO_DB || { repos: [], categories: [], findings: [] };
let reportsList = [];
let activeInspection = null;
let activeNavTab = 'reports';
let activeRoom = 'סלון';
let activeStocksRepoIndex = 3; // Default to "מאגר ממצאים בדק בית דירתי"
let editingItemIndex = -1; // -1 for new item
let currentModalPhotos = [];
let chatSelectedImageBase64 = null;

// Standard Default Rooms
const DEFAULT_ROOMS = [
  'כניסה / מבואת כניסה', 'סלון', 'מטבח', 'פינת אוכל', 'מרפסת שמש',
  'ממ"ד', 'חדר שינה הורים', 'חדר רחצה הורים', 'חדר שינה 1', 'חדר שינה 2',
  'חדר רחצה כללי', 'חדר שירות / כביסה', 'מסדרון', 'חניה',
  'שטחים משותפים / לובי קומתי', 'חצר / גינה', 'גג', 'כללי'
];

let customRooms = [];

// Initialize Application
function startApp() {
  initDbIndex();
  loadReportsFromStorage();
  initActiveInspection();
  setupEventListeners();
  renderReportsList();
  renderInspectionEditor();
  renderStocksBrowser();
  updateNavBadges();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// Build Fast Search Indices for Findings DB
let indexedFindings = [];
function initDbIndex() {
  if (!db || !db.findings) return;
  indexedFindings = db.findings.map((f, idx) => {
    const repoName = db.repos[f.r] || '';
    const catName = db.categories[f.c] || '';
    const searchText = (f.name + ' ' + (f.std || '') + ' ' + (f.rec || '') + ' ' + catName + ' ' + repoName).toLowerCase();
    return { ...f, origIndex: idx, repoName, catName, searchText };
  });
}

// ---------------------------------------------------------
// Storage & Reports Management
// ---------------------------------------------------------
function loadReportsFromStorage() {
  const saved = localStorage.getItem('bedek_reports_list');
  if (saved) {
    try {
      reportsList = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading reports list from storage', e);
      reportsList = [];
    }
  }

  // Pre-populate with Shimon Meir Cohen Kadosh report if empty
  if (reportsList.length === 0 && window.SHIMON_INSPECTION) {
    reportsList.push(JSON.parse(JSON.stringify(window.SHIMON_INSPECTION)));
    saveReportsToStorage();
  }
}

function saveReportsToStorage() {
  try {
    localStorage.setItem('bedek_reports_list', JSON.stringify(reportsList));
  } catch (e) {
    console.warn('LocalStorage limit reached when saving reports list', e);
  }
}

function initActiveInspection() {
  const activeId = localStorage.getItem('bedek_active_report_id');
  if (activeId && reportsList.length > 0) {
    const found = reportsList.find(r => r.id === activeId);
    if (found) {
      activeInspection = found;
      collectCustomRooms();
      return;
    }
  }

  if (reportsList.length > 0) {
    activeInspection = reportsList[0];
  } else {
    activeInspection = createDefaultInspectionObj('דוח חדש', 'רחוב ראשי 1, ישראל');
    reportsList.push(activeInspection);
    saveReportsToStorage();
  }
  localStorage.setItem('bedek_active_report_id', activeInspection.id);
  collectCustomRooms();
}

function createDefaultInspectionObj(clientName, address) {
  return {
    id: 'insp_' + Date.now(),
    clientName: clientName || '',
    clientPhone: '',
    address: address || '',
    propertyType: 'דירת מגורים (חדשה מקבלן)',
    date: new Date().toISOString().split('T')[0],
    inspectorName: 'צוריאל צדוק',
    inspectorTitle: 'בודק מוסמך ואיתור נזילות',
    inspectorPhone: '053-9514613',
    companyName: 'צ. ביקורת מבנים',
    status: 'טיוטה',
    generalNotes: 'חוות דעת מומחה לבית משפט - ביקורת מבנים ובדק בית',
    items: []
  };
}

function collectCustomRooms() {
  if (!activeInspection || !activeInspection.items) return;
  const existingRooms = new Set(DEFAULT_ROOMS);
  activeInspection.items.forEach(item => {
    if (item.room && !existingRooms.has(item.room) && !customRooms.includes(item.room)) {
      customRooms.push(item.room);
    }
  });
}

function saveActiveInspection() {
  if (!activeInspection) return;
  const idx = reportsList.findIndex(r => r.id === activeInspection.id);
  if (idx !== -1) {
    reportsList[idx] = activeInspection;
  } else {
    reportsList.push(activeInspection);
  }
  saveReportsToStorage();
  updateNavBadges();
}

// ---------------------------------------------------------
// Navigation (Reporto 1:1)
// ---------------------------------------------------------
function switchNavTab(tabName) {
  activeNavTab = tabName;

  // Update Top Nav Tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update Bottom Nav Tabs (Mobile)
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Switch Active Main Section
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });

  const activeSection = document.getElementById('tab-' + tabName);
  if (activeSection) {
    activeSection.classList.add('active');
  }

  // Trigger relevant view renderers
  if (tabName === 'reports') renderReportsList();
  if (tabName === 'editor') renderInspectionEditor();
  if (tabName === 'stocks') renderStocksBrowser();
  if (tabName === 'report') generateReportDocument();
  if (tabName === 'chat') scrollChatToBottom();

  window.scrollTo(0, 0);
}

function updateNavBadges() {
  const reportsCount = reportsList.length;
  const itemsCount = activeInspection && activeInspection.items ? activeInspection.items.length : 0;

  const bReports = document.getElementById('top-badge-reports');
  if (bReports) bReports.textContent = reportsCount;

  const bEditor = document.getElementById('top-badge-editor');
  if (bEditor) bEditor.textContent = itemsCount;
}

// ---------------------------------------------------------
// SCREEN 1: Reports Dashboard (דוחות)
// ---------------------------------------------------------
let currentReportsFilter = 'all';

function filterReports(status, btnElement) {
  currentReportsFilter = status;
  document.querySelectorAll('.reports-filter-btn').forEach(b => b.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderReportsList();
}

function renderReportsList() {
  const tbody = document.getElementById('reports-table-body');
  const cardsGrid = document.getElementById('reports-cards-grid');

  const searchVal = (document.getElementById('reports-search-input')?.value || '').trim().toLowerCase();

  let filtered = reportsList.filter(rep => {
    if (currentReportsFilter === 'draft' && rep.status === 'הושלם') return false;
    if (currentReportsFilter === 'completed' && rep.status !== 'הושלם') return false;
    if (searchVal) {
      const match = (rep.clientName || '').toLowerCase().includes(searchVal) ||
                    (rep.address || '').toLowerCase().includes(searchVal) ||
                    (rep.date || '').includes(searchVal);
      if (!match) return false;
    }
    return true;
  });

  // Update stats cards
  const totalReps = reportsList.length;
  const inProg = reportsList.filter(r => r.status !== 'הושלם').length;
  const comp = reportsList.filter(r => r.status === 'הושלם').length;
  let totalFindingsCount = 0;
  reportsList.forEach(r => totalFindingsCount += (r.items ? r.items.length : 0));

  if (document.getElementById('stat-total-reports')) document.getElementById('stat-total-reports').textContent = totalReps;
  if (document.getElementById('stat-in-progress')) document.getElementById('stat-in-progress').textContent = inProg;
  if (document.getElementById('stat-completed')) document.getElementById('stat-completed').textContent = comp;
  if (document.getElementById('stat-total-findings')) document.getElementById('stat-total-findings').textContent = totalFindingsCount;

  if (filtered.length === 0) {
    const emptyMsg = '<div style="text-align:center; padding:35px 20px; color:var(--text-muted); grid-column: 1 / -1;">לא נמצאו דוחות תואמים. לחץ על "+ דוח חדש" כדי להתחיל בדיקה חדשה.</div>';
    if (cardsGrid) cardsGrid.innerHTML = emptyMsg;
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">' + emptyMsg + '</td></tr>';
    return;
  }

  // 1. Render Reporto 1:1 Inspection Cards (Mobile & Desktop)
  if (cardsGrid) {
    cardsGrid.innerHTML = filtered.map((rep, idx) => {
      const isCurrentActive = activeInspection && activeInspection.id === rep.id;
      const itemsCount = rep.items ? rep.items.length : 0;
      let totalCost = 0;
      if (rep.items) {
        rep.items.forEach(it => {
          totalCost += (Number(it.price) || 0) * (Number(it.qty) || 1);
        });
      }

      const isCompleted = rep.status === 'הושלם';
      const statusPillHtml = isCompleted
        ? '<span class="status-pill status-completed"><span class="status-dot"></span>הושלם</span>'
        : '<span class="status-pill status-in-progress"><span class="status-dot"></span>בתהליך</span>';

      const reportNumber = rep.reportNumber || ('#' + (1005 - idx));

      return `
        <div class="reporto-card ${isCurrentActive ? 'active-border' : ''}">
          <div class="reporto-card-top">
            <div class="reporto-card-num">${reportNumber}</div>
            <div class="reporto-card-date">📅 ${escapeHtml(rep.date || '')}</div>
            <div>${statusPillHtml}</div>
          </div>

          <div class="reporto-card-address">
            📍 ${escapeHtml(rep.address || 'ללא כתובת')}
          </div>

          <div class="reporto-card-meta">
            <span>👤 <b>${escapeHtml(rep.clientName || 'שמעון מאיר כהן קדוש')}</b></span>
            <span>👷 צדוק צוריאל</span>
            <span class="reporto-type-tag">🏷️ ${escapeHtml(rep.propertyType || 'בדק בית דירתי')}</span>
          </div>

          <div class="reporto-metrics-strip">
            <div class="reporto-metric-item">🔍 <b>${itemsCount} ליקויים</b></div>
            <div class="reporto-metric-cost">₪${totalCost.toLocaleString('he-IL')} אומדן</div>
          </div>

          <div class="reporto-card-actions">
            <button type="button" class="btn btn-primary" onclick="openReportInEditor('${rep.id}')">
              <span>✏️ ערוך בדיקה</span>
            </button>
            <button type="button" class="btn btn-gold" onclick="openReportInPreview('${rep.id}')">
              <span>📄 הפק דוח</span>
            </button>
            <button type="button" class="btn btn-outline" style="color:var(--danger); width:44px; flex:none;" onclick="deleteReport('${rep.id}')" title="מחק דוח">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Table View for desktop toggle
  if (tbody) {
    tbody.innerHTML = filtered.map(rep => {
      const isCurrentActive = activeInspection && activeInspection.id === rep.id;
      const itemsCount = rep.items ? rep.items.length : 0;
      let totalCost = 0;
      if (rep.items) {
        rep.items.forEach(it => {
          totalCost += (Number(it.price) || 0) * (Number(it.qty) || 1);
        });
      }

      const isCompleted = rep.status === 'הושלם';
      const statusPillHtml = isCompleted
        ? '<span class="status-pill status-completed"><span class="status-dot"></span>הושלם</span>'
        : '<span class="status-pill status-in-progress"><span class="status-dot"></span>בתהליך</span>';

      return `
        <tr style="${isCurrentActive ? 'background:#fdfaf3;' : ''}">
          <td>
            <div style="font-weight:700; color:var(--primary); font-size:0.95rem;">${escapeHtml(rep.clientName || 'ללא שם לקוח')}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">📍 ${escapeHtml(rep.address || 'ללא כתובת')}</div>
          </td>
          <td style="font-size:0.82rem; color:#475569;">
            ${escapeHtml(rep.propertyType || 'בדק בית')}
          </td>
          <td>${statusPillHtml}</td>
          <td style="font-weight:700;">${itemsCount} ליקויים</td>
          <td style="font-weight:700; color:var(--primary);">₪${totalCost.toLocaleString('he-IL')}</td>
          <td style="font-size:0.82rem; color:var(--text-muted);">${escapeHtml(rep.date || '')}</td>
          <td style="text-align:left;">
            <div style="display:inline-flex; gap:6px;">
              <button type="button" class="btn btn-sm btn-primary" onclick="openReportInEditor('${rep.id}')">✏️ ערוך</button>
              <button type="button" class="btn btn-sm btn-gold" onclick="openReportInPreview('${rep.id}')">📄 דוח</button>
              <button type="button" class="btn btn-sm btn-outline" style="color:var(--danger);" onclick="deleteReport('${rep.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

function openReportInEditor(reportId) {
  const found = reportsList.find(r => r.id === reportId);
  if (found) {
    activeInspection = found;
    localStorage.setItem('bedek_active_report_id', found.id);
    collectCustomRooms();
    renderInspectionEditor();
    switchNavTab('editor');
  }
}

function openReportInPreview(reportId) {
  const found = reportsList.find(r => r.id === reportId);
  if (found) {
    activeInspection = found;
    localStorage.setItem('bedek_active_report_id', found.id);
    collectCustomRooms();
    switchNavTab('report');
  }
}

function deleteReport(reportId) {
  if (!confirm('האם אתה בטוח שברצונך למחוק דוח זה? הפעולה אינה ניתנת לביטול.')) return;
  reportsList = reportsList.filter(r => r.id !== reportId);
  saveReportsToStorage();
  if (activeInspection && activeInspection.id === reportId) {
    initActiveInspection();
  }
  renderReportsList();
  renderInspectionEditor();
}

function openNewReportModal() {
  document.getElementById('new-client-name').value = '';
  document.getElementById('new-client-phone').value = '';
  document.getElementById('new-address').value = '';
  document.getElementById('new-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('new-general-notes').value = '';
  document.getElementById('modal-new-report').classList.add('active');
}

function closeNewReportModal() {
  document.getElementById('modal-new-report').classList.remove('active');
}

function createNewReportSubmit() {
  const clientName = document.getElementById('new-client-name').value.trim();
  const clientPhone = document.getElementById('new-client-phone').value.trim();
  const address = document.getElementById('new-address').value.trim();
  const propertyType = document.getElementById('new-property-type').value;
  const date = document.getElementById('new-date').value;
  const generalNotes = document.getElementById('new-general-notes').value.trim();

  if (!clientName || !address) {
    alert('נא למלא שם לקוח וכתובת נכס כדי להתחיל בדיקה.');
    return;
  }

  const newInsp = createDefaultInspectionObj(clientName, address);
  newInsp.clientPhone = clientPhone;
  newInsp.propertyType = propertyType;
  newInsp.date = date;
  newInsp.generalNotes = generalNotes || 'חוות דעת מומחה לבית משפט - ביקורת מבנים ובדק בית';

  reportsList.unshift(newInsp);
  activeInspection = newInsp;
  localStorage.setItem('bedek_active_report_id', newInsp.id);
  saveReportsToStorage();

  closeNewReportModal();
  renderReportsList();
  renderInspectionEditor();
  switchNavTab('editor');
}

// ---------------------------------------------------------
// SCREEN 2: Inspection Editor (עורך בדיקה לפי חדרים 1:1)
// ---------------------------------------------------------
function renderInspectionEditor() {
  if (!activeInspection) return;

  // Header Banner Details
  document.getElementById('editor-insp-client').textContent = activeInspection.clientName || 'ללא שם לקוח';
  document.getElementById('editor-insp-address').textContent = activeInspection.address || 'ללא כתובת נכס';

  const totalItems = activeInspection.items ? activeInspection.items.length : 0;
  let totalCost = 0;
  if (activeInspection.items) {
    activeInspection.items.forEach(it => {
      totalCost += (Number(it.price) || 0) * (Number(it.qty) || 1);
    });
  }
  document.getElementById('editor-metric-items').textContent = totalItems;
  document.getElementById('editor-metric-cost').textContent = '₪' + totalCost.toLocaleString('he-IL');

  // Render Horizontal Rooms Bar (Reporto 1:1)
  renderRoomsBar();

  // Render Defect Cards in Active Room
  renderActiveRoomFindings();
}

function getAllAvailableRooms() {
  const set = new Set([...DEFAULT_ROOMS, ...customRooms]);
  if (activeInspection && activeInspection.items) {
    activeInspection.items.forEach(it => {
      if (it.room) set.add(it.room);
    });
  }
  return Array.from(set);
}

function renderRoomsBar() {
  const container = document.getElementById('editor-room-bar');
  if (!container) return;

  const allRooms = getAllAvailableRooms();

  // If activeRoom is not set or not in list, set to first
  if (!activeRoom || !allRooms.includes(activeRoom)) {
    activeRoom = allRooms[0] || 'סלון';
  }

  // Count items per room
  const roomCounts = {};
  if (activeInspection && activeInspection.items) {
    activeInspection.items.forEach(it => {
      const rm = it.room || 'כללי';
      roomCounts[rm] = (roomCounts[rm] || 0) + 1;
    });
  }

  let html = allRooms.map(rm => {
    const isActive = rm === activeRoom;
    const count = roomCounts[rm] || 0;
    const hasItems = count > 0;
    return `
      <button type="button" class="room-tab-btn ${isActive ? 'active' : ''} ${hasItems ? 'has-items' : ''}" onclick="selectActiveRoom('${escapeHtml(rm)}')">
        <span>${escapeHtml(rm)}</span>
        <span class="room-tab-count">${count}</span>
      </button>
    `;
  }).join('');

  html += `
    <button type="button" class="btn-add-room" onclick="promptAddNewRoom()">
      <span>➕ הוסף חדר</span>
    </button>
  `;

  container.innerHTML = html;
}

function selectActiveRoom(roomName) {
  activeRoom = roomName;
  renderRoomsBar();
  renderActiveRoomFindings();
}

function promptAddNewRoom() {
  const newName = prompt('הזן את שם החדר / החלל החדש לבדיקה (למשל: יחידת דיור, מחסן, חצר קדמית):');
  if (newName && newName.trim()) {
    const trimmed = newName.trim();
    if (!customRooms.includes(trimmed)) {
      customRooms.push(trimmed);
    }
    selectActiveRoom(trimmed);
  }
}

function renderActiveRoomFindings() {
  const container = document.getElementById('room-findings-list');
  const titleEl = document.getElementById('active-room-title');
  const summaryEl = document.getElementById('active-room-summary');

  if (titleEl) titleEl.textContent = activeRoom;

  if (!activeInspection || !activeInspection.items) {
    if (container) container.innerHTML = '';
    return;
  }

  // Filter items in active room
  const roomItems = [];
  activeInspection.items.forEach((it, idx) => {
    if ((it.room || 'כללי') === activeRoom) {
      roomItems.push({ item: it, index: idx });
    }
  });

  let roomTotal = 0;
  roomItems.forEach(({ item }) => {
    roomTotal += (Number(item.price) || 0) * (Number(item.qty) || 1);
  });

  if (summaryEl) {
    summaryEl.textContent = `(${roomItems.length} ליקויים • ₪${roomTotal.toLocaleString('he-IL')})`;
  }

  if (roomItems.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:35px 20px; color:var(--text-muted); background:#ffffff;">
        <div style="font-size:2.2rem; margin-bottom:10px;">📋</div>
        <div style="font-weight:700; font-size:1.05rem; color:var(--text); margin-bottom:6px;">אין עדיין ליקויים ב${escapeHtml(activeRoom)}</div>
        <div style="font-size:0.85rem; margin-bottom:16px;">
          לחץ על "➕ הוסף ממצא לחדר" כדי לבחור מתוך 1,773 הממצאים בריפורטו, או סרוק תמונה באמצעות ה-AI.
        </div>
        <button type="button" class="btn btn-primary" onclick="openAddFindingModal()">
          <span>➕ הוסף ממצא ראשון ל${escapeHtml(activeRoom)}</span>
        </button>
      </div>
    `;
    return;
  }

  // Render modular defect cards (note:9210)
  container.innerHTML = roomItems.map(({ item, index }, cardIdx) => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const total = qty * price;

    const photosHtml = (item.photos && item.photos.length > 0)
      ? item.photos.map(p => `<img src="${escapeHtml(p)}" class="defect-photo-thumb" onclick="openImageLightbox('${escapeHtml(p)}')">`).join('')
      : '';

    return `
      <div class="defect-card">
        <div class="defect-card-header">
          <div class="defect-card-title-wrap">
            <span class="defect-num-badge">#${cardIdx + 1}</span>
            <div class="defect-card-title">${escapeHtml(item.title || '')}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-sm btn-outline" onclick="openEditFindingModal(${index})">✏️ ערוך</button>
            <button type="button" class="btn btn-sm btn-outline" style="color:var(--danger);" onclick="deleteFinding(${index})">🗑️</button>
          </div>
        </div>

        <div class="defect-card-body">
          ${item.std ? `
            <div class="defect-section-box defect-box-std">
              <div class="defect-box-title">📜 דרישת התקן הישראלי הרשמי (ת"י) / החוק:</div>
              <div>${escapeHtml(item.std)}</div>
            </div>
          ` : ''}

          ${item.rec ? `
            <div class="defect-section-box defect-box-rec">
              <div class="defect-box-title">🛠️ אופן התיקון והמלצה מקצועית:</div>
              <div>${escapeHtml(item.rec)}</div>
            </div>
          ` : ''}

          ${item.note ? `
            <div class="defect-section-box defect-box-note">
              <div class="defect-box-title">✍️ הערת בודק מהשטח:</div>
              <div>${escapeHtml(item.note)}</div>
            </div>
          ` : ''}

          <!-- Cost Calculation Strip -->
          <div class="defect-cost-strip">
            <div>
              <span>כמות: <b>${qty} ${escapeHtml(item.unit || "יח'")}</b></span>
              <span style="margin-right:12px;">מחיר יח': <b>₪${price.toLocaleString('he-IL')}</b></span>
            </div>
            <div class="defect-cost-total">
              סה"כ: ₪${total.toLocaleString('he-IL')}
            </div>
          </div>

          <!-- Photos -->
          ${photosHtml ? `
            <div class="defect-photos-strip">
              ${photosHtml}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------
// ADD FINDING MODAL (1:1 Selection from 1,773 Reporto findings)
// ---------------------------------------------------------
function openAddFindingModal() {
  document.getElementById('select-finding-room-title').textContent = `➕ הוספת ממצא ל${activeRoom}`;
  document.getElementById('modal-finding-search').value = '';

  // Populate Repo select
  const repoSelect = document.getElementById('modal-filter-repo');
  if (repoSelect && repoSelect.options.length <= 1) {
    db.repos.forEach((rp, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = rp;
      repoSelect.appendChild(opt);
    });
  }

  // Populate Category select
  const catSelect = document.getElementById('modal-filter-cat');
  if (catSelect && catSelect.options.length <= 1) {
    db.categories.forEach((cat, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
  }

  document.getElementById('modal-select-finding').classList.add('active');
  filterModalFindings();
}

function closeSelectFindingModal() {
  document.getElementById('modal-select-finding').classList.remove('active');
}

function filterModalFindings() {
  const searchVal = (document.getElementById('modal-finding-search')?.value || '').trim().toLowerCase();
  const repoFilter = document.getElementById('modal-filter-repo')?.value;
  const catFilter = document.getElementById('modal-filter-cat')?.value;
  const resultsContainer = document.getElementById('modal-findings-results');

  let matches = indexedFindings.filter(f => {
    if (repoFilter && repoFilter !== 'all' && Number(f.r) !== Number(repoFilter)) return false;
    if (catFilter && catFilter !== 'all' && Number(f.c) !== Number(catFilter)) return false;
    if (searchVal) {
      if (!f.searchText.includes(searchVal)) return false;
    }
    return true;
  });

  const displayMatches = matches.slice(0, 50);

  if (displayMatches.length === 0) {
    resultsContainer.innerHTML = `
      <div style="text-align:center; padding:20px; color:var(--text-muted);">
        לא נמצאו ממצאים מתאימים. נסה מילות חיפוש אחרות או לחץ על "ליקוי ידני מותאם אישית".
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = displayMatches.map(f => {
    return `
      <div class="repo-finding-row" style="cursor:pointer;" onclick="selectFindingFromRepo(${f.origIndex})">
        <div class="repo-finding-content">
          <div style="font-size:0.75rem; color:var(--gold-dark); font-weight:700;">${escapeHtml(f.catName)} • ${escapeHtml(f.repoName)}</div>
          <div class="repo-finding-title">${escapeHtml(f.name)}</div>
          ${f.std ? `<div class="repo-finding-std">📜 ${escapeHtml(f.std.slice(0, 160))}...</div>` : ''}
          ${f.rec ? `<div class="repo-finding-rec">🛠️ ${escapeHtml(f.rec.slice(0, 140))}...</div>` : ''}
        </div>
        <button type="button" class="btn btn-sm btn-gold" style="white-space:nowrap;">
          ➕ בחר
        </button>
      </div>
    `;
  }).join('');
}

function selectFindingFromRepo(findingIndex) {
  const finding = db.findings[findingIndex];
  if (!finding) return;

  closeSelectFindingModal();

  // Open Edit modal with preloaded finding
  editingItemIndex = -1;
  document.getElementById('edit-modal-title').textContent = `הוספת ממצא ל${activeRoom}`;
  document.getElementById('form-item-title').value = finding.name || '';
  document.getElementById('form-item-std').value = finding.std || '';
  document.getElementById('form-item-rec').value = finding.rec || '';
  document.getElementById('form-item-note').value = finding.note || '';
  document.getElementById('form-item-price').value = finding.up || 350;
  document.getElementById('form-item-qty').value = finding.uq || 1;
  document.getElementById('form-item-unit').value = finding.ut || "יח'";
  calculateModalTotal();

  currentModalPhotos = [];
  renderModalPhotos();

  document.getElementById('btn-delete-finding').style.display = 'none';
  document.getElementById('modal-edit-finding').classList.add('active');
}

function openCustomFindingModal() {
  closeSelectFindingModal();
  editingItemIndex = -1;
  document.getElementById('edit-modal-title').textContent = `ליקוי מותאם אישית ב${activeRoom}`;
  document.getElementById('form-item-title').value = '';
  document.getElementById('form-item-std').value = '';
  document.getElementById('form-item-rec').value = '';
  document.getElementById('form-item-note').value = '';
  document.getElementById('form-item-price').value = 400;
  document.getElementById('form-item-qty').value = 1;
  document.getElementById('form-item-unit').value = "יח'";
  calculateModalTotal();

  currentModalPhotos = [];
  renderModalPhotos();

  document.getElementById('btn-delete-finding').style.display = 'none';
  document.getElementById('modal-edit-finding').classList.add('active');
}

function openEditFindingModal(itemIndex) {
  if (!activeInspection || !activeInspection.items || !activeInspection.items[itemIndex]) return;
  const item = activeInspection.items[itemIndex];
  editingItemIndex = itemIndex;

  document.getElementById('edit-modal-title').textContent = `עריכת ליקוי ב${item.room || activeRoom}`;
  document.getElementById('form-item-title').value = item.title || '';
  document.getElementById('form-item-std').value = item.std || '';
  document.getElementById('form-item-rec').value = item.rec || '';
  document.getElementById('form-item-note').value = item.note || '';
  document.getElementById('form-item-price').value = item.price || 0;
  document.getElementById('form-item-qty').value = item.qty || 1;
  document.getElementById('form-item-unit').value = item.unit || "יח'";
  calculateModalTotal();

  currentModalPhotos = item.photos ? [...item.photos] : [];
  renderModalPhotos();

  document.getElementById('btn-delete-finding').style.display = 'block';
  document.getElementById('modal-edit-finding').classList.add('active');
}

function closeEditModal() {
  document.getElementById('modal-edit-finding').classList.remove('active');
}

function calculateModalTotal() {
  const p = Number(document.getElementById('form-item-price')?.value) || 0;
  const q = Number(document.getElementById('form-item-qty')?.value) || 1;
  const total = p * q;
  document.getElementById('form-item-total').value = '₪' + total.toLocaleString('he-IL');
}

function handleFindingPhotoUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      compressImage(e.target.result, 1200, 0.8, (compressed) => {
        currentModalPhotos.push(compressed);
        renderModalPhotos();
      });
    };
    reader.readAsDataURL(file);
  });
}

function compressImage(base64Str, maxDimension, quality, callback) {
  const img = new Image();
  img.src = base64Str;
  img.onload = () => {
    let width = img.width;
    let height = img.height;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
}

function renderModalPhotos() {
  const container = document.getElementById('form-photos-grid');
  if (!container) return;

  container.innerHTML = currentModalPhotos.map((p, idx) => {
    return `
      <div style="position:relative; display:inline-block;">
        <img src="${escapeHtml(p)}" class="defect-photo-thumb">
        <button type="button" onclick="removeModalPhoto(${idx})" style="position:absolute; top:-6px; right:-6px; background:var(--danger); color:#fff; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; line-height:1;">✕</button>
      </div>
    `;
  }).join('');
}

function removeModalPhoto(index) {
  currentModalPhotos.splice(index, 1);
  renderModalPhotos();
}

function saveFindingModalSubmit() {
  const title = document.getElementById('form-item-title').value.trim();
  const std = document.getElementById('form-item-std').value.trim();
  const rec = document.getElementById('form-item-rec').value.trim();
  const note = document.getElementById('form-item-note').value.trim();
  const price = Number(document.getElementById('form-item-price').value) || 0;
  const qty = Number(document.getElementById('form-item-qty').value) || 1;
  const unit = document.getElementById('form-item-unit').value.trim() || "יח'";

  if (!title) {
    alert('נא להזין תיאור ליקוי.');
    return;
  }

  if (!activeInspection.items) activeInspection.items = [];

  const findingData = {
    id: editingItemIndex >= 0 ? activeInspection.items[editingItemIndex].id : 'item_' + Date.now(),
    room: editingItemIndex >= 0 ? activeInspection.items[editingItemIndex].room : activeRoom,
    title,
    std,
    rec,
    note,
    price,
    qty,
    unit,
    photos: [...currentModalPhotos]
  };

  if (editingItemIndex >= 0) {
    activeInspection.items[editingItemIndex] = findingData;
  } else {
    activeInspection.items.push(findingData);
  }

  saveActiveInspection();
  closeEditModal();
  renderInspectionEditor();
}

function deleteFinding(itemIndex) {
  if (!confirm('האם למחוק ממצא זה?')) return;
  activeInspection.items.splice(itemIndex, 1);
  saveActiveInspection();
  renderInspectionEditor();
}

function deleteActiveFinding() {
  if (editingItemIndex >= 0) {
    deleteFinding(editingItemIndex);
    closeEditModal();
  }
}

// ---------------------------------------------------------
// SCREEN 3: Repositories Browser (מאגרים 1:1 Reporto)
// ---------------------------------------------------------
function renderStocksBrowser() {
  renderStocksRepoTabs();
  renderStocksCategoryList();
}

function renderStocksRepoTabs() {
  const container = document.getElementById('stocks-repo-tabs');
  if (!container || !db.repos) return;

  container.innerHTML = db.repos.map((rp, idx) => {
    const isActive = idx === activeStocksRepoIndex;
    return `
      <button type="button" class="repo-tab-pill ${isActive ? 'active' : ''}" onclick="selectStocksRepo(${idx})">
        ${escapeHtml(rp)}
      </button>
    `;
  }).join('');
}

function selectStocksRepo(idx) {
  activeStocksRepoIndex = idx;
  renderStocksRepoTabs();
  renderStocksCategoryList();
}

function renderStocksCategoryList() {
  const container = document.getElementById('stocks-categories-list');
  const summaryEl = document.getElementById('stocks-count-summary');
  if (!container) return;

  const searchVal = (document.getElementById('stocks-search-input')?.value || '').trim().toLowerCase();

  // Filter findings in active repository
  const repoFindings = indexedFindings.filter(f => Number(f.r) === Number(activeStocksRepoIndex));

  // If searchVal, match across findings
  const matchedFindings = searchVal
    ? repoFindings.filter(f => f.searchText.includes(searchVal))
    : repoFindings;

  if (summaryEl) {
    summaryEl.textContent = `נמצאו ${matchedFindings.length} ממצאים במאגר נבחר`;
  }

  // Group by category
  const catGroups = {};
  matchedFindings.forEach(f => {
    const cat = f.catName || 'כללי';
    if (!catGroups[cat]) catGroups[cat] = [];
    catGroups[cat].push(f);
  });

  const categories = Object.keys(catGroups);

  if (categories.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--text-muted);">
        לא נמצאו ממצאים מתאימים לחיפוש זה.
      </div>
    `;
    return;
  }

  container.innerHTML = categories.map((catName, catIdx) => {
    const findings = catGroups[catName];
    return `
      <div class="category-accordion-card" id="cat-card-${catIdx}">
        <div class="category-accordion-header" onclick="toggleCategoryAccordion('cat-card-${catIdx}')">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>📁</span>
            <span>${escapeHtml(catName)}</span>
          </div>
          <span class="category-badge-count">${findings.length} ממצאים</span>
        </div>
        <div class="category-accordion-body">
          ${findings.map((f, fIdx) => `
            <div class="repo-finding-row">
              <div class="repo-finding-content">
                <div class="repo-finding-title">${fIdx + 1}. ${escapeHtml(f.name)}</div>
                ${f.std ? `<div class="repo-finding-std">📜 <b>תקן:</b> ${escapeHtml(f.std)}</div>` : ''}
                ${f.rec ? `<div class="repo-finding-rec">🛠️ <b>תיקון:</b> ${escapeHtml(f.rec)}</div>` : ''}
              </div>
              <button type="button" class="btn btn-sm btn-gold" onclick="addFindingDirectlyToActiveRoom(${f.origIndex})">
                ➕ הוסף ל${escapeHtml(activeRoom)}
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function toggleCategoryAccordion(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle('open');
}

function addFindingDirectlyToActiveRoom(findingIndex) {
  const finding = db.findings[findingIndex];
  if (!finding || !activeInspection) return;

  if (!activeInspection.items) activeInspection.items = [];

  const newItem = {
    id: 'item_' + Date.now(),
    room: activeRoom,
    title: finding.name || '',
    std: finding.std || '',
    rec: finding.rec || '',
    note: finding.note || '',
    price: finding.up || 350,
    qty: finding.uq || 1,
    unit: finding.ut || "יח'",
    photos: []
  };

  activeInspection.items.push(newItem);
  saveActiveInspection();
  alert(`הממצא נוסף בהצלחה לחדר "${activeRoom}"!`);
}

// ---------------------------------------------------------
// SCREEN 4: Report Generation (הפקת דוח A4 1:1 Reporto)
// ---------------------------------------------------------
function generateReportDocument() {
  const paper = document.getElementById('report-paper');
  if (!paper || !activeInspection) return;

  const items = activeInspection.items || [];

  // Group items by room
  const itemsByRoom = {};
  items.forEach(it => {
    const rm = it.room || 'כללי';
    if (!itemsByRoom[rm]) itemsByRoom[rm] = [];
    itemsByRoom[rm].push(it);
  });

  // Calculate totals
  let grandTotal = 0;
  let totalFindings = items.length;
  items.forEach(it => {
    grandTotal += (Number(it.price) || 0) * (Number(it.qty) || 1);
  });

  const vatAmount = grandTotal * 0.18;
  const grandTotalWithVat = grandTotal + vatAmount;

  paper.innerHTML = `
    <!-- 1. COVER PAGE (שער מהודר) -->
    <div class="report-cover">
      <div class="report-cover-brand">🏗️ צ. ביקורת מבנים</div>
      <div class="report-cover-tagline">בדק בית • איתור נזילות • חוות דעת מומחה לבית משפט</div>
      <div style="font-size:8.5pt; color:var(--text-muted); margin-bottom:12px;">
        בס"ד | טלפון: 053-9514613 | דוא"ל: zadok8810@gmail.com
      </div>

      <div class="report-cover-title">
        חוות דעת מומחה לבית משפט - ביקורת מבנים ובדק בית
      </div>
      <div style="font-size:9.5pt; color:#475569; font-weight:600; margin-bottom:20px;">
        ערוכה לפי סעיף 24 לפקודת הראיות [נוסח חדש], תשל"א-1971
      </div>

      <!-- Metadata Table -->
      <table class="report-meta-table">
        <tr>
          <th>שם המזמין / לקוח:</th>
          <td><b>${escapeHtml(activeInspection.clientName || '—')}</b></td>
          <th>תאריך הבדיקה:</th>
          <td>${escapeHtml(activeInspection.date || '—')}</td>
        </tr>
        <tr>
          <th>כתובת הנכס הנבדק:</th>
          <td>${escapeHtml(activeInspection.address || '—')}</td>
          <th>סוג הנכס:</th>
          <td>${escapeHtml(activeInspection.propertyType || '—')}</td>
        </tr>
        <tr>
          <th>שם הבודק המומחה:</th>
          <td><b>צוריאל צדוק</b></td>
          <th>הסמכה ותפקיד:</th>
          <td>בודק מוסמך ואיתור נזילות (צ. ביקורת מבנים)</td>
        </tr>
        <tr>
          <th>טלפון להתקשרות:</th>
          <td>053-9514613</td>
          <th>סטטוס הדוח:</th>
          <td>דוח סופי ומאושר לעיון ובית משפט</td>
        </tr>
      </table>
    </div>

    <!-- 2. DECLARATION OF EXPERT (הצהרת מומחה לפי פקודת הראיות) -->
    <div class="report-declaration-box">
      <div style="font-weight:800; font-size:10pt; color:var(--primary); margin-bottom:8px;">
        📜 הצהרת המומחה על פי פקודת הראיות:
      </div>
      <div style="margin-bottom:8px;">
        אני החתום מטה, <b>צוריאל צדוק</b>, בודק מוסמך בתחום ביקורת מבנים ואיתור נזילות, נותן חוות דעתי זו במקום עדות בבית המשפט, ומצהיר בזאת כי ידוע לי היטב שלעניין הוראות החוק הפלילי בדבר עדות שקר בשבועה בבית המשפט, דין חוות דעתי זו כשהיא חתומה על ידי כדין עדות בשבועה שניתנה בבית המשפט.
      </div>
      <div style="margin-bottom:8px;">
        <b>כלי ומכשירי המדידה ששימשו בבדיקה:</b> מצלמה תרמית מקצועית, מד לחות דיגיטלי מתקדם (פרוטימטר), פלס לייזר ומד שיפועים דיגיטלי, מד מרחק לייזר מכויל, פנס בדיקה בעוצמה גבוהה וציוד בדיקת לחצים.
      </div>
      <div>
        <b>בסיס הבדיקה והתקנים:</b> חוק המכר (דירות), תשל"ג-1973; תקנות התכנון והבנייה; תקני מכון התקנים הישראלי (ת"י); המפרט הכללי לעבודות בנייה; והוראות למתקני תברואה (הל"ת).
      </div>
    </div>

    <!-- 3. SUMMARY TABLE BY ROOM (טבלת ריכוז ליקויים ואומדן עלויות) -->
    <div class="report-sec-heading">טבלת ריכוז ממצאים ואומדן עלויות לפי חללים</div>
    <table class="report-summary-table">
      <thead>
        <tr>
          <th style="width:10%;">מס'</th>
          <th style="width:40%;">שם החלל / החדר</th>
          <th style="width:25%;">כמות ליקויים</th>
          <th style="width:25%;">אומדן עלות תיקון (₪)</th>
        </tr>
      </thead>
      <tbody>
        ${Object.keys(itemsByRoom).map((rm, idx) => {
          const rmItems = itemsByRoom[rm];
          let rmCost = 0;
          rmItems.forEach(it => {
            rmCost += (Number(it.price) || 0) * (Number(it.qty) || 1);
          });
          return `
            <tr>
              <td>${idx + 1}</td>
              <td><b>${escapeHtml(rm)}</b></td>
              <td>${rmItems.length} ליקויים</td>
              <td>₪${rmCost.toLocaleString('he-IL')}</td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td colspan="2"><b>סה"כ כללי (לפני מע"מ)</b></td>
          <td><b>${totalFindings} ליקויים</b></td>
          <td><b>₪${grandTotal.toLocaleString('he-IL')}</b></td>
        </tr>
        <tr style="background:#f8fafc; font-weight:700;">
          <td colspan="3">מע"מ כחוק (18%)</td>
          <td>₪${vatAmount.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
        </tr>
        <tr style="background:#f1f5f9; font-weight:900; font-size:11pt; color:var(--primary);">
          <td colspan="3"><b>סה"כ אומדן עלויות תיקון כולל מע"מ</b></td>
          <td><b>₪${grandTotalWithVat.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</b></td>
        </tr>
      </tbody>
    </table>

    <!-- 4. DETAILED FINDINGS BY ROOM (פירוט מלא של כל הממצאים) -->
    <div class="page-break-before"></div>
    <div class="report-sec-heading">פירוט מלא של הממצאים, התקנים והנחיות התיקון</div>

    ${Object.keys(itemsByRoom).map(rm => {
      const rmItems = itemsByRoom[rm];
      return `
        <div style="margin-top:20px; margin-bottom:12px;">
          <div style="background:var(--primary); color:#ffffff; padding:6px 12px; border-radius:4px; font-weight:800; font-size:11pt;">
            📍 חלל: ${escapeHtml(rm)} (${rmItems.length} ממצאים)
          </div>
        </div>

        ${rmItems.map((it, itemIdx) => {
          const q = Number(it.qty) || 1;
          const p = Number(it.price) || 0;
          const tot = q * p;

          const photosHtml = (it.photos && it.photos.length > 0)
            ? `
              <div class="report-photos-grid">
                ${it.photos.map(src => `<img src="${escapeHtml(src)}" class="report-photo-img">`).join('')}
              </div>
            `
            : '';

          return `
            <div class="report-defect-card">
              <div class="report-defect-head">
                <div>ממצא ${itemIdx + 1}: ${escapeHtml(it.title || '')}</div>
                <div style="font-size:8.5pt;">חלל: ${escapeHtml(rm)}</div>
              </div>
              <div class="report-defect-body">
                ${photosHtml}

                ${it.std ? `
                  <div class="report-std-box">
                    <b>📜 דרישת התקן הישראלי הרשמי (ת"י) / החוק:</b><br>
                    ${escapeHtml(it.std)}
                  </div>
                ` : ''}

                ${it.rec ? `
                  <div class="report-rec-box">
                    <b>🛠️ אופן התיקון והמלצה מקצועית:</b><br>
                    ${escapeHtml(it.rec)}
                  </div>
                ` : ''}

                ${it.note ? `
                  <div style="font-size:8.5pt; color:#475569; margin-top:6px;">
                    <b>הערת הבודק:</b> ${escapeHtml(it.note)}
                  </div>
                ` : ''}
              </div>

              <div class="report-defect-footer">
                <div>כמות: <b>${q} ${escapeHtml(it.unit || "יח'")}</b> | מחיר יח': <b>₪${p.toLocaleString('he-IL')}</b></div>
                <div>אומדן עלות לתיקון: <b>₪${tot.toLocaleString('he-IL')}</b></div>
              </div>
            </div>
          `;
        }).join('')}
      `;
    }).join('')}

    <!-- 5. SIGNATURE & CONCLUSION (סיכום וחתימה) -->
    <div class="report-sig-block">
      <div>
        <div style="font-weight:800; font-size:10.5pt; color:var(--primary);">צ. ביקורת מבנים</div>
        <div style="font-size:8.5pt; color:var(--text-muted);">שירותי בדק בית, איתור נזילות וליקויי בנייה</div>
        <div style="font-size:8.5pt; color:var(--text-muted);">תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:9.5pt; font-weight:800; color:var(--primary);">צוריאל צדוק</div>
        <div style="font-size:8.5pt; color:#475569;">בודק מוסמך ואיתור נזילות</div>
        <div style="margin-top:6px; font-family:cursive; font-size:14pt; color:#0f2942;">צוריאל צדוק</div>
      </div>
    </div>
  `;
}

function printReport() {
  generateReportDocument();
  setTimeout(() => {
    window.print();
  }, 200);
}

function exportInspectionJSON() {
  if (!activeInspection) return;
  const jsonStr = JSON.stringify(activeInspection, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bedek_report_${(activeInspection.clientName || 'report').replace(/\s+/g, '_')}_${activeInspection.date || 'date'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ---------------------------------------------------------
// SCREEN 5: AI Chat & Vision (עוזר AI)
// ---------------------------------------------------------
function handleChatImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    compressImage(e.target.result, 1024, 0.75, (compressed) => {
      chatSelectedImageBase64 = compressed;
      document.getElementById('chat-preview-img').src = compressed;
      document.getElementById('chat-image-preview-strip').style.display = 'flex';
    });
  };
  reader.readAsDataURL(file);
}

function clearChatImage() {
  chatSelectedImageBase64 = null;
  document.getElementById('chat-image-preview-strip').style.display = 'none';
  document.getElementById('chat-file-input').value = '';
}

function startVisionScan() {
  switchNavTab('chat');
  document.getElementById('chat-file-input').click();
}

async function sendChatMessage() {
  const inputEl = document.getElementById('chat-input-text');
  const userText = inputEl.value.trim();
  const hasImage = !!chatSelectedImageBase64;

  if (!userText && !hasImage) return;

  // Append user bubble
  appendChatBubble('user', userText, chatSelectedImageBase64);
  inputEl.value = '';
  const sentImage = chatSelectedImageBase64;
  clearChatImage();

  // Show typing indicator
  const typingId = 'typing_' + Date.now();
  appendChatTyping(typingId);

  // Call Client AI (Gemini or OpenAI)
  const apiKey = localStorage.getItem('bedek_ai_api_key') || '';
  const provider = localStorage.getItem('bedek_ai_provider') || 'gemini';

  if (!apiKey) {
    removeChatTyping(typingId);
    appendChatBubble('bot', `
      <b>נא להזין מפתח API:</b> לצורך ניתוח תמונות בשטח מול מודלי AI (Gemini או OpenAI), לחץ על כפתור <b>⚙️ מפתח API</b> למעלה והזן מפתח אישי.
      <br><br>
      <i>בינתיים, איתרתי במאגר 1,773 התקנים את ההתאמה הקרובה ביותר לטקסט שכתבת:</i>
    `);
    // Fallback local match
    showLocalMatchInChat(userText);
    return;
  }

  try {
    const aiResponse = await callClientAi(provider, apiKey, userText, sentImage);
    removeChatTyping(typingId);
    appendChatBubble('bot', aiResponse);
  } catch (err) {
    removeChatTyping(typingId);
    console.error('AI call error:', err);
    appendChatBubble('bot', `שגיאה בתקשורת מול ה-AI: ${err.message}. מציג תוצאות ממאגר התקנים המקומי:`);
    showLocalMatchInChat(userText);
  }
}

function showLocalMatchInChat(query) {
  if (!query) return;
  const q = query.toLowerCase();
  const matches = indexedFindings.filter(f => f.searchText.includes(q)).slice(0, 3);
  if (matches.length > 0) {
    const html = matches.map(m => `
      <div style="background:#f1f5f9; padding:8px 10px; border-radius:6px; margin-top:8px; border-right:3px solid var(--primary);">
        <b>${escapeHtml(m.name)}</b><br>
        <small>📜 ${escapeHtml((m.std || '').slice(0, 120))}</small><br>
        <button type="button" class="btn btn-sm btn-gold" style="margin-top:6px;" onclick="addFindingDirectlyToActiveRoom(${m.origIndex})">
          ➕ הוסף ל${escapeHtml(activeRoom)}
        </button>
      </div>
    `).join('');
    appendChatBubble('bot', html);
  }
}

async function callClientAi(provider, apiKey, promptText, imageBase64) {
  const systemPrompt = `אתה מומחה בכיר לבדק בית, ביקורת מבנים ואיתור נזילות של עסק 'צ. ביקורת מבנים' בבעלות צוריאל צדוק.
חוק ברזל מחייב: איסור מוחלט על שימוש במילים משורש ה.נ.ד.ס! זהו דוח בדק בית וחוות דעת מומחה לבית משפט.
נתח את התמונה או השאלה, ציין את שם הליקוי, דרישת התקן הישראלי הרשמי (ת"י), אופן התיקון המקצועי ואומדן מחיר מוערך בש"ח.`;

  if (provider === 'gemini') {
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [];
    if (imageBase64) {
      const b64Data = imageBase64.split(',')[1] || imageBase64;
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: b64Data
        }
      });
    }
    parts.push({ text: systemPrompt + '\n\n' + (promptText || 'זהה ליקויים בתמונה זו והתאם לתקן הישראלי:') });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || res.statusText);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'לא התקבלה תשובה מ-Gemini.';
  } else {
    // OpenAI fallback
    const url = 'https://api.openai.com/v1/chat/completions';
    const messages = [{ role: 'system', content: systemPrompt }];

    const content = [];
    if (promptText) content.push({ type: 'text', text: promptText });
    if (imageBase64) {
      content.push({ type: 'image_url', image_url: { url: imageBase64 } });
    }
    messages.push({ role: 'user', content });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 800
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || res.statusText);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'לא התקבלה תשובה מ-OpenAI.';
  }
}

function appendChatBubble(role, textHtml, imageBase64) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const isUser = role === 'user';
  const bubble = document.createElement('div');
  bubble.style.marginBottom = '12px';
  bubble.style.display = 'flex';
  bubble.style.flexDirection = 'column';
  bubble.style.alignItems = isUser ? 'flex-start' : 'flex-end';

  let imgHtml = imageBase64 ? `<img src="${imageBase64}" style="max-width:180px; border-radius:6px; margin-bottom:6px; border:1px solid var(--border);">` : '';

  bubble.innerHTML = `
    <div style="background:${isUser ? '#0f2942' : '#ffffff'}; color:${isUser ? '#ffffff' : '#1e293b'}; border:1px solid ${isUser ? '#0f2942' : 'var(--border)'}; padding:10px 14px; border-radius:10px; max-width:85%; font-size:0.88rem; line-height:1.5;">
      ${imgHtml}
      <div>${textHtml}</div>
    </div>
  `;

  container.appendChild(bubble);
  scrollChatToBottom();
}

function appendChatTyping(id) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const el = document.createElement('div');
  el.id = id;
  el.style.fontSize = '0.8rem';
  el.style.color = 'var(--text-muted)';
  el.style.marginBottom = '10px';
  el.textContent = '🤖 מנתח ממצאים בשטח מול 1,773 תקנים...';
  container.appendChild(el);
  scrollChatToBottom();
}

function removeChatTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ---------------------------------------------------------
// API Settings Modal
// ---------------------------------------------------------
function openApiModal() {
  const provider = localStorage.getItem('bedek_ai_provider') || 'gemini';
  const key = localStorage.getItem('bedek_ai_api_key') || '';
  document.getElementById('api-provider').value = provider;
  document.getElementById('api-key-value').value = key;
  document.getElementById('modal-api-settings').classList.add('active');
}

function closeApiModal() {
  document.getElementById('modal-api-settings').classList.remove('active');
}

function saveApiSettings() {
  const provider = document.getElementById('api-provider').value;
  const key = document.getElementById('api-key-value').value.trim();
  localStorage.setItem('bedek_ai_provider', provider);
  localStorage.setItem('bedek_ai_api_key', key);
  closeApiModal();
  alert('הגדרות בינה מלאכותית נשמרו בהצלחה במכשיר זה!');
}

function handleApiProviderChange() {
  // Can adapt placeholder if needed
}

// ---------------------------------------------------------
// Lightbox Modal for Photos
// ---------------------------------------------------------
function openImageLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.style.zIndex = '3000';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <div style="position:relative; max-width:90vw; max-height:90vh;">
      <img src="${src}" style="max-width:100%; max-height:85vh; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
      <button style="position:absolute; top:-12px; right:-12px; background:#ef4444; color:#fff; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; font-weight:800; font-size:16px;">✕</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupEventListeners() {
  // Any extra global listeners
}

// =========================================================
// REPORTO 1:1 ENHANCEMENTS: CARDS, DRAWER, SYNC & QUICK PHOTO
// =========================================================

let reportsViewMode = 'cards';

function setReportsViewMode(mode) {
  reportsViewMode = mode;
  const cardsGrid = document.getElementById('reports-cards-grid');
  const tableWrap = document.getElementById('reports-table-wrap');
  const btnCards = document.getElementById('btn-view-cards');
  const btnTable = document.getElementById('btn-view-table');

  if (mode === 'cards') {
    if (cardsGrid) cardsGrid.style.display = 'grid';
    if (tableWrap) tableWrap.style.display = 'none';
    btnCards?.classList.add('active');
    btnTable?.classList.remove('active');
  } else {
    if (cardsGrid) cardsGrid.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';
    btnCards?.classList.remove('active');
    btnTable?.classList.add('active');
  }
}

function toggleSideDrawer() {
  const drawer = document.getElementById('side-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (!drawer || !overlay) return;

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    overlay.classList.remove('active');
  } else {
    drawer.classList.add('open');
    overlay.classList.add('active');
  }
}

function openSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (modal) modal.style.display = 'flex';
}

function closeSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (modal) modal.style.display = 'none';
}

async function triggerManualSync() {
  const statusEl = document.getElementById('sync-modal-status-text');
  const headerText = document.getElementById('header-sync-text');
  if (statusEl) statusEl.textContent = '🔄 מסנכרן עם הענן...';
  if (headerText) headerText.textContent = 'מסנכרן...';

  try {
    const payload = {
      reports: reportsList,
      activeInspection: activeInspection,
      updated_at: new Date().toISOString()
    };
    
    // Save to localStorage immediately
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reportsList));

    // Try cloud sync endpoint if available
    const syncUrl = 'https://latest-hair-theft-reporter.trycloudflare.com/api/sync';
    const resp = await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => null);

    if (resp && resp.ok) {
      if (statusEl) statusEl.textContent = '🟢 סנכרון ענן הושלם בהצלחה!';
    } else {
      if (statusEl) statusEl.textContent = '🟢 שמור ומסונכרן מקומית (Offline-First)';
    }
    if (headerText) headerText.textContent = 'מסונכרן';
  } catch (e) {
    if (statusEl) statusEl.textContent = '🟢 שמור ומסונכרן מקומית';
    if (headerText) headerText.textContent = 'מסונכרן';
  }
}

function copySyncCode() {
  const code = document.getElementById('sync-quick-code')?.textContent || '8810-BEDEK';
  navigator.clipboard.writeText(code).then(() => {
    alert('קוד הסנכרון הועתק ללוח: ' + code);
  }).catch(() => {
    prompt('העתק את קוד הסנכרון:', code);
  });
}

function exportBackupJson() {
  const data = {
    appName: 'צ. ביקורת מבנים',
    version: '2.1',
    exportedAt: new Date().toISOString(),
    reports: reportsList,
    activeInspection: activeInspection
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bedek_reports_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackupJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.reports && Array.isArray(parsed.reports)) {
        reportsList = parsed.reports;
        saveReportsToStorage();
        if (parsed.activeInspection) {
          activeInspection = parsed.activeInspection;
          saveActiveInspection();
        }
        renderReportsList();
        updateNavBadges();
        alert('הגיבוי יובא בהצלחה! סה"כ ' + reportsList.length + ' דוחות נטענו למערכת.');
        closeSyncModal();
      } else {
        alert('קובץ הגיבוי אינו בפורמט תקין.');
      }
    } catch (err) {
      alert('שגיאה בקריאת קובץ הגיבוי: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function openRoomActionSheet() {
  const sheet = document.getElementById('room-action-sheet');
  const sheetTitle = document.getElementById('sheet-room-name');
  if (sheetTitle) sheetTitle.textContent = activeRoom;
  if (sheet) sheet.style.display = 'flex';
}

function closeRoomActionSheet() {
  const sheet = document.getElementById('room-action-sheet');
  if (sheet) sheet.style.display = 'none';
}

function duplicateCurrentRoom() {
  const newRoomName = prompt('הזן שם עבור החדר המשוכפל:', activeRoom + ' (נוסף)');
  if (!newRoomName || !newRoomName.trim()) return;

  const trimmed = newRoomName.trim();
  if (!customRooms.includes(trimmed)) customRooms.push(trimmed);

  // Copy items from active room
  if (activeInspection && activeInspection.items) {
    const itemsToCopy = activeInspection.items.filter(it => (it.room || 'כללי') === activeRoom);
    itemsToCopy.forEach(it => {
      const copy = JSON.parse(JSON.stringify(it));
      copy.room = trimmed;
      copy.id = 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      activeInspection.items.push(copy);
    });
    saveActiveInspection();
  }

  selectActiveRoom(trimmed);
  alert('החדר ' + trimmed + ' שוכפל בהצלחה עם כל הליקויים!');
}

function handleQuickPhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    
    // Create new defect with photo in active room
    if (!activeInspection) return;
    if (!activeInspection.items) activeInspection.items = [];

    const newDefect = {
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      room: activeRoom,
      title: 'ממצא חדש ב' + activeRoom,
      location: activeRoom,
      std: '',
      rec: 'נדרש תיקון מקצועי',
      note: 'צולם ישירות בשטח',
      price: 350,
      qty: 1,
      unit: "יח'",
      photos: [dataUrl]
    };

    activeInspection.items.push(newDefect);
    saveActiveInspection();
    renderActiveRoomFindings();
    updateNavBadges();
    alert('התמונה צולמה וצורפה כליקוי חדש ב' + activeRoom + '!');
  };
  reader.readAsDataURL(file);
}

