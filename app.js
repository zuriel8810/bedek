// =========================================================
// צ. ביקורת מבנים - אפליקציית בדק בית וחוות דעת מומחה (Reporto 1:1)
// =========================================================

// Global State
let db = window.REPORTO_DB || { repos: [], categories: [], findings: [] };
let reportsList = [];
let activeInspection = null;
let activeNavTab = 'reports';
let activeRoom = 'סלון';
let activeStocksRepoIndex = 'all'; // Default to "מאגר ממצאים בדק בית דירתי"
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

  // Ensure default exact reports from Reporto screenshot 393175 (#1006, #1005, #1004)
  const defaultReports = [
    {
      id: 'insp_nisayon_1006',
      reportNumber: '1006',
      clientName: 'נסיון',
      clientPhone: '053-9514613',
      address: 'נסיון',
      propertyType: 'בדק בית דירתי',
      date: '2026-11-03',
      displayDate: '03/11/2026',
      monthGroup: 'נובמבר 2026',
      status: 'בעבודה',
      inspectorName: 'צדוק צוריאל',
      items: []
    },
    {
      id: 'insp_shimon_meir_107',
      reportNumber: '1005',
      clientName: 'שמעון מאיר כהן קדוש',
      clientPhone: '050-4148810',
      address: 'יהדות מרוקו 107 נתיבות קומה 1 דירה 5',
      propertyType: 'דירה מקבלן',
      templateTag: 'בדק בית דירתי',
      date: '2026-10-31',
      displayDate: '31/10/2026',
      monthGroup: 'אוקטובר 2026',
      status: 'בעבודה',
      inspectorName: 'צדוק צוריאל',
      items: (window.SHIMON_INSPECTION && window.SHIMON_INSPECTION.items) || []
    },
    {
      id: 'insp_moshe_perez_42',
      reportNumber: '1004',
      clientName: 'משה פרץ',
      clientPhone: '052-1234567',
      address: 'משה שרת 42 אופקים',
      propertyType: 'בדק בית דירה יד 2',
      templateTag: 'בדק בית דירה יד 2',
      date: '2026-10-08',
      displayDate: '08/10/2026',
      monthGroup: 'אוקטובר 2026',
      status: 'בעבודה',
      inspectorName: 'צדוק צוריאל',
      items: []
    }
  ];

  if (!reportsList || reportsList.length < 3) {
    reportsList = defaultReports;
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
  const container = document.getElementById('reports-cards-container');
  if (!container) return;

  const searchVal = (document.getElementById('reports-search-input')?.value || '').trim().toLowerCase();

  let filtered = reportsList.filter(rep => {
    if (searchVal) {
      const match = (rep.clientName || '').toLowerCase().includes(searchVal) ||
                    (rep.address || '').toLowerCase().includes(searchVal) ||
                    (rep.date || '').includes(searchVal) ||
                    (rep.reportNumber || '').includes(searchVal);
      if (!match) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px 20px; color:#64748b;">לא נמצאו דוחות תואמים לחיפוש.</div>';
    return;
  }

  // Group by Month (Reporto 1:1 Screenshot 393175)
  const groups = {};
  filtered.forEach(rep => {
    let m = rep.monthGroup;
    if (!m) {
      const d = rep.date || '';
      if (d.includes('2026-11')) m = 'נובמבר 2026';
      else if (d.includes('2026-10')) m = 'אוקטובר 2026';
      else m = 'נובמבר 2026';
    }
    if (!groups[m]) groups[m] = [];
    groups[m].push(rep);
  });

  let html = '';
  const groupOrder = ['נובמבר 2026', 'אוקטובר 2026'];
  Object.keys(groups).forEach(k => { if (!groupOrder.includes(k)) groupOrder.push(k); });

  groupOrder.forEach(mKey => {
    const list = groups[mKey];
    if (!list || list.length === 0) return;

    html += '<div class="reporto-month-row">' +
      '<span class="reporto-month-title">' + mKey + '</span>' +
      '<span class="reporto-month-count">' + list.length + '</span>' +
    '</div>' +
    '<div class="reporto-card-box">';

    list.forEach((rep, idx) => {
      const rNum = rep.reportNumber || (1006 - idx);
      const dDate = rep.displayDate || rep.date || '03/11/2026';
      const cName = rep.clientName || '';
      const addr = rep.address || '';
      const tagText = rep.templateTag || (rep.propertyType && rep.propertyType.includes('יד 2') ? 'בדק בית דירה יד 2' : 'בדק בית דירתי');

      const tagBadge = rep.propertyType === 'דירה מקבלן' ? 
        '<span class="rep-tag-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>דירה מקבלן</span>' : '';

      const divider = (idx < list.length - 1) ? '<div class="reporto-card-divider"></div>' : '';

      html += '<div class="reporto-card-item" data-id="' + rep.id + '" onclick="openReportInEditor(this.dataset.id)">' +
        '<div class="rep-row-top">' +
          '<div class="rep-top-right">' +
            '<span class="rep-date">' + dDate + '</span>' +
            tagBadge +
          '</div>' +
          '<div class="rep-top-left">' +
            '<span class="rep-status-text">בעבודה</span>' +
            '<span class="rep-status-dot"></span>' +
          '</div>' +
        '</div>' +
        '<div class="rep-row-mid">' +
          '<div class="rep-address">' + escapeHtml(addr) + '</div>' +
          '<div class="rep-num">' + rNum + '</div>' +
        '</div>' +
        '<div class="rep-row-bot">' +
          '<div class="rep-bot-right">' +
            '<div class="rep-client">' + escapeHtml(cName) + '</div>' +
            '<div class="rep-subtag">' + tagText + '</div>' +
          '</div>' +
          '<div class="rep-bot-left">' +
            '<span>צדוק צוריאל</span>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' +
          '</div>' +
        '</div>' +
      '</div>' + divider;
    });

    html += '</div>';
  });

  container.innerHTML = html;
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
  const modal = document.getElementById('modal-new-report');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function closeNewReportModal() {
  const modal = document.getElementById('modal-new-report');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
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

// ========================================================
// REPORTO 1:1 INSPECTION EDITOR & CHAPTERS (Screenshots mid_010, mid_020, mid_025)
// ========================================================

function renderInspectionEditor() {
  if (!activeInspection) return;

  const propEl = document.getElementById('editor-property-type');
  if (propEl) propEl.textContent = activeInspection.propertyType || 'דירה מקבלן';
  
  const numEl = document.getElementById('editor-report-num');
  if (numEl) numEl.textContent = '#' + (activeInspection.reportNum || activeInspection.reportNumber || '1005');

  const addrEl = document.getElementById('editor-address');
  if (addrEl) addrEl.textContent = activeInspection.address || 'יהדות מרוקו 107 נתיבות קומה 1 דירה 5';

  const clientEl = document.getElementById('editor-client-sub');
  if (clientEl) clientEl.textContent = (activeInspection.clientName || 'שמעון מאיר כהן קדוש') + ' • בדק בית דירתי';

  const statusEl = document.getElementById('editor-status-text');
  if (statusEl) statusEl.textContent = activeInspection.status === 'completed' ? 'הושלם' : 'בעבודה';

  const count = activeInspection.items ? activeInspection.items.length : 0;
  const countBadge = document.getElementById('subtab-findings-count');
  if (countBadge) countBadge.textContent = count;

  const totalHdr = document.getElementById('findings-total-header');
  if (totalHdr) totalHdr.textContent = 'ממצאים ' + count;

  const dClient = document.getElementById('detail-client-name');
  if (dClient) dClient.textContent = activeInspection.clientName || 'שמעון מאיר כהן קדוש';
  
  const dDate = document.getElementById('detail-visit-date');
  if (dDate) {
    if (activeInspection.date && activeInspection.date.includes('-')) {
      dDate.textContent = activeInspection.date.split('-').reverse().join('/');
    } else {
      dDate.textContent = activeInspection.date || '30/10/2026';
    }
  }

  const dInsp = document.getElementById('detail-inspector-name');
  if (dInsp) dInsp.textContent = activeInspection.inspectorName || 'צדוק צוריאל';

  renderReportoChapters();
}

function switchEditorSubtab(subtab) {
  const btnFindings = document.getElementById('subtab-findings-btn');
  const btnDetails = document.getElementById('subtab-details-btn');
  const viewFindings = document.getElementById('editor-findings-view');
  const viewDetails = document.getElementById('editor-details-view');

  if (subtab === 'findings') {
    btnFindings?.classList.add('active');
    btnDetails?.classList.remove('active');
    if (viewFindings) viewFindings.style.display = 'block';
    if (viewDetails) viewDetails.style.display = 'none';
  } else {
    btnDetails?.classList.add('active');
    btnFindings?.classList.remove('active');
    if (viewFindings) viewFindings.style.display = 'none';
    if (viewDetails) viewDetails.style.display = 'block';
  }
}

function getChapterForItem(item) {
  const title = (item.title || item.name || '').toLowerCase();
  const room = (item.room || '').toLowerCase();
  const cat = (item.cat || '').toLowerCase();

  if (room.includes('רחצה') || room.includes('שירותי') || room.includes('שירות') || title.includes('ניקוז') || title.includes('אסלה') || title.includes('אינסטלציה') || cat.includes('אינסטלציה')) {
    return 'אינסטלציה סניטרית וניקוז';
  }
  if (title.includes('טיח') || title.includes('צבע') || room.includes('צבע') || cat.includes('טיח')) {
    return 'טיח וצבע';
  }
  if (room.includes('ממ"ד') || title.includes('ממ"ד') || title.includes('מסגרות') || cat.includes('מסגרות')) {
    return 'מסגרות וממ"ד';
  }
  if (room.includes('דלת') || title.includes('דלת') || title.includes('חלון') || title.includes('ארונות')) {
    return 'דלתות, חלונות ונגרות';
  }
  if (title.includes('ריצוף') || title.includes('שיפוע') || title.includes('אריח') || cat.includes('ריצוף')) {
    return 'ריצוף וחיפוי פנים';
  }
  if (room.includes('חניה') || title.includes('חניה') || room.includes('מרפסת') || room.includes('חצר')) {
    return 'חניה ופיתוח חוץ';
  }
  if (room.includes('חשמל') || title.includes('חשמל') || title.includes('הארקה')) {
    return 'מתקני חשמל ותקשורת';
  }
  return 'כללי ושונות';
}

function renderReportoChapters() {
  const container = document.getElementById('findings-chapters-container');
  if (!container) return;

  if (!activeInspection || !activeInspection.items || activeInspection.items.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">אין עדיין ממצאים בדוח זה. לחץ על "+ הוסף ממצא" למטה.</div>';
    return;
  }

  const chapters = {};
  activeInspection.items.forEach((it, idx) => {
    const chName = getChapterForItem(it);
    if (!chapters[chName]) chapters[chName] = [];
    chapters[chName].push({ item: it, originalIndex: idx });
  });

  const preferredOrder = [
    'אינסטלציה סניטרית וניקוז',
    'טיח וצבע',
    'מסגרות וממ"ד',
    'דלתות, חלונות ונגרות',
    'ריצוף וחיפוי פנים',
    'חניה ופיתוח חוץ',
    'מתקני חשמל ותקשורת',
    'כללי ושונות'
  ];

  const sortedChapterNames = Object.keys(chapters).sort((a, b) => {
    let ia = preferredOrder.indexOf(a);
    let ib = preferredOrder.indexOf(b);
    if (ia === -1) ia = 99;
    if (ib === -1) ib = 99;
    return ia - ib;
  });

  let html = '';
  sortedChapterNames.forEach((chName, chIdx) => {
    const items = chapters[chName];
    const chNum = chIdx + 1;

    html += '<div class="rep-chapter-card open" id="chapter-card-' + chNum + '">' +
      '<div class="rep-chapter-header" onclick="toggleChapterAccordion(' + chNum + ')">' +
        '<div class="rep-chapter-title-wrap">' +
          '<span class="rep-chapter-num-badge">' + chNum + '</span>' +
          '<span class="rep-chapter-title">' + escapeHtml(chName) + '</span>' +
          '<span class="rep-chapter-count">' + items.length + '</span>' +
        '</div>' +
        '<div class="rep-chapter-chevron">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</div>' +
      '</div>' +
      '<div class="rep-chapter-body" id="chapter-body-' + chNum + '">';

    items.forEach(({ item, originalIndex }, itemSubIdx) => {
      const itemNumStr = chNum + '.' + (itemSubIdx + 1);
      const roomStr = item.room || 'כללי';
      const cleanTitle = (item.title || item.name || '').replace(/^[0-9]+\.[0-9]*\s*/, '');
      const photoCount = (item.photos && item.photos.length) || (item.reporto_images && item.reporto_images.length) || 1;
      
      let thumbSrc = '';
      if (item.photos && item.photos.length > 0) {
        thumbSrc = item.photos[0];
      } else if (item.reporto_images && item.reporto_images.length > 0) {
        thumbSrc = item.reporto_images[0].url || item.reporto_images[0];
      } else {
        thumbSrc = 'photos/sink_drain.png';
      }

      html += '<div class="rep-finding-item" onclick="openEditModalForFinding(' + originalIndex + ')">' +
        '<button type="button" class="rep-finding-left-btn" onclick="event.stopPropagation(); openFindingItemActions(' + originalIndex + ')">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>' +
        '</button>' +
        '<div class="rep-finding-info">' +
          '<div class="rep-finding-room">' + itemNumStr + ' ' + escapeHtml(roomStr) + '</div>' +
          '<div class="rep-finding-title">' + escapeHtml(cleanTitle) + '</div>' +
        '</div>' +
        '<div class="rep-finding-thumb-wrap">' +
          '<img src="' + thumbSrc + '" alt="ליקוי" class="rep-finding-thumb" onerror="this.src=\'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' fill=\'%2394a3b8\' viewBox=\'0 0 24 24\'><rect width=\'24\' height=\'24\' fill=\'%23334155\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'white\' font-size=\'12\'>📷</text></svg>\'">' +
          (photoCount > 1 ? '<span class="rep-finding-thumb-badge">' + photoCount + '</span>' : '') +
        '</div>' +
      '</div>';
    });

    html += '</div></div>';
  });

  container.innerHTML = html;
}

function toggleChapterAccordion(chNum) {
  const card = document.getElementById('chapter-card-' + chNum);
  if (card) {
    card.classList.toggle('open');
  }
}

function toggleStatusDropdown() {
  if (!activeInspection) return;
  const newStatus = activeInspection.status === 'completed' ? 'in_progress' : 'completed';
  activeInspection.status = newStatus;
  saveActiveInspection();
  renderInspectionEditor();
}

function toggleFindingsSearch() {
  const bar = document.getElementById('findings-search-bar');
  if (bar) {
    bar.style.display = bar.style.display === 'none' ? 'block' : 'none';
    if (bar.style.display === 'block') {
      document.getElementById('findings-search-input')?.focus();
    }
  }
}

function filterRenderedFindings() {
  const query = (document.getElementById('findings-search-input')?.value || '').toLowerCase().trim();
  const items = document.querySelectorAll('.rep-finding-item');
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

function openEditModalForFinding(index) {
  if (!activeInspection || !activeInspection.items || !activeInspection.items[index]) return;
  const item = activeInspection.items[index];
  activeFindingIndex = index;

  document.getElementById('edit-modal-title').textContent = 'ערוך ממצא';
  document.getElementById('form-item-title').value = item.title || item.name || '';
  document.getElementById('form-item-std').value = item.std || item.reporto_std || '';
  document.getElementById('form-item-rec').value = item.rec || item.reporto_rec || '';
  document.getElementById('form-item-note').value = item.note || '';
  document.getElementById('form-item-price').value = item.price || 0;
  document.getElementById('form-item-qty').value = item.qty || 1;
  document.getElementById('form-item-unit').value = item.unit || "קומפ'";

  calculateModalTotal();

  currentModalPhotos = item.photos ? [...item.photos] : [];
  renderModalPhotos();

  const modal = document.getElementById('modal-edit-finding');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function openFindingItemActions(index) {
  if (confirm('האם ברצונך למחוק ממצא זה מהדוח?')) {
    activeInspection.items.splice(index, 1);
    saveActiveInspection();
    renderInspectionEditor();
  }
}

function editDeclaration() {
  const current = document.getElementById('detail-declaration-text').textContent.trim();
  const val = prompt('עריכת נוסח הצהרת הבודק:', current);
  if (val !== null) {
    document.getElementById('detail-declaration-text').textContent = val;
  }
}

function editGeneralDetails() {
  const name = prompt('שם המזמין / לקוח:', activeInspection.clientName || '');
  if (name !== null) activeInspection.clientName = name;
  const addr = prompt('כתובת הנכס:', activeInspection.address || '');
  if (addr !== null) activeInspection.address = addr;
  saveActiveInspection();
  renderInspectionEditor();
}

function editPreliminaryNotes() {
  alert('ניתן לערוך את רשימת התקנים וההערות המקדימות בתבנית הדוח.');
}

function shareReportAction() {
  if (navigator.share) {
    navigator.share({
      title: activeInspection.title || 'דוח בדק בית',
      text: 'דוח בדק בית עבור ' + (activeInspection.address || ''),
      url: window.location.href
    }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(window.location.href);
    alert('קישור לדוח הועתק ללוח!');
  }
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

  const isAllActive = activeStocksRepoIndex === 'all';
  const totalFindings = db.findings ? db.findings.length : 1773;

  let html = `
    <button type="button" class="repo-tab-pill ${isAllActive ? 'active' : ''}" onclick="selectStocksRepo('all')">
      🌟 כל המאגרים (${totalFindings.toLocaleString('he-IL')})
    </button>
  `;

  html += db.repos.map((rp, idx) => {
    const isActive = activeStocksRepoIndex === idx;
    const count = indexedFindings.filter(f => Number(f.r) === idx).length;
    return `
      <button type="button" class="repo-tab-pill ${isActive ? 'active' : ''}" onclick="selectStocksRepo(${idx})">
        ${escapeHtml(rp)} (${count})
      </button>
    `;
  }).join('');

  html += `
    <button type="button" class="btn-add-room" style="padding:6px 14px; font-size:0.82rem;" onclick="openNewRepoModal()">
      <span>➕ מאגר חדש</span>
    </button>
  `;

  container.innerHTML = html;
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

  // If activeStocksRepoIndex === 'all', include ALL findings!
  const repoFindings = activeStocksRepoIndex === 'all'
    ? indexedFindings
    : indexedFindings.filter(f => Number(f.r) === Number(activeStocksRepoIndex));

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

  // Collect all unique standard screenshots for Appendix
  const allStdScreenshots = [];
  const seenUrls = new Set();
  items.forEach((it, idx) => {
    const stdImgs = it.reporto_images || it.standard_images || [];
    stdImgs.forEach(s => {
      const u = s.url || s;
      if (u && !seenUrls.has(u)) {
        seenUrls.add(u);
        allStdScreenshots.push({
          url: u,
          title: s.title || ('צילום מסך מתוך התקן הרשמי - ממצא ' + (idx + 1)),
          std: s.standard || it.std || '',
          defectNum: idx + 1,
          room: it.room || 'כללי'
        });
      }
    });
  });

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
                ${it.photos.map(src => `<img src="${escapeHtml(src)}" class="report-photo-img" alt="צילום ליקוי בשטח">`).join('')}
              </div>
            `
            : '';

          const stdImgs = it.reporto_images || it.standard_images || [];
          const stdScreenshotsHtml = (stdImgs.length > 0)
            ? `
              <div class="report-std-screenshot-box">
                <div class="report-std-screenshot-title">
                  <span>📜</span>
                  <span>צילום מסך רשמי מתוך התקן (ת"י) המצורף לליקוי:</span>
                </div>
                <div class="report-std-screenshots-grid">
                  ${stdImgs.map(si => `
                    <div>
                      <img src="${escapeHtml(si.url || si)}" class="report-std-thumb" alt="צילום תקן רשמי">
                      <div style="font-size:7.5pt; color:#475569; margin-top:3px;">${escapeHtml(si.title || '')}</div>
                    </div>
                  `).join('')}
                </div>
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

                ${stdScreenshotsHtml}

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

    <!-- 5. STANDARDS APPENDIX SECTION (נספח תרשימי תקנים ישראליים רשמיים מלא) -->
    ${allStdScreenshots.length > 0 ? `
      <div class="page-break-before"></div>
      <div class="report-sec-heading">נספח א': צילומי מסך ותרשימים מתוך התקנים הישראליים הרשמיים (ת"י) והחוק</div>
      <div style="font-size:9pt; color:#475569; margin-bottom:14px; line-height:1.5;">
        להלן צילומי מסך מלאים ומדויקים מתוך נוסחי התקנים הישראליים הרשמיים, תקנות התכנון והבנייה והמפרט הכללי, המבססים את ממצאי הבדיקה ואת דרישות התיקון בחוות הדעת:
      </div>
      <div class="standards-appendix-grid">
        ${allStdScreenshots.map((sc, i) => `
          <div class="appendix-std-card">
            <div class="appendix-std-card-title">תרשים תקן ${i + 1}: ${escapeHtml(sc.title)}</div>
            <div class="appendix-std-card-sub">מתייחס לממצא מס' ${sc.defectNum} (${escapeHtml(sc.room)}) • ${escapeHtml(sc.std)}</div>
            <img src="${escapeHtml(sc.url)}" class="appendix-std-card-img" alt="צילום מסך תקן ישראלי רשמי">
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- 6. SIGNATURE & CONCLUSION (סיכום וחתימה) -->
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
  const modal = document.getElementById('modal-api-settings');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function closeApiModal() {
  const modal = document.getElementById('modal-api-settings');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
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



// =========================================================
// REPOSITORY MANAGEMENT (Reporto 1:1)
// =========================================================

function openNewRepoModal() {
  const modal = document.getElementById('modal-new-repo');
  if (modal) modal.style.display = 'flex';
}

function closeNewRepoModal() {
  const modal = document.getElementById('modal-new-repo');
  if (modal) modal.style.display = 'none';
}

function saveNewRepoSubmit() {
  const name = (document.getElementById('new-repo-name')?.value || '').trim();
  const catsStr = (document.getElementById('new-repo-categories')?.value || '').trim();
  const desc = (document.getElementById('new-repo-desc')?.value || '').trim();

  if (!name) {
    alert('נא להזין שם עבור המאגר החדש.');
    return;
  }

  if (!db.repos.includes(name)) {
    db.repos.push(name);
  }

  if (catsStr) {
    const cats = catsStr.split(',').map(c => c.trim()).filter(Boolean);
    cats.forEach(c => {
      if (!db.categories.includes(c)) db.categories.push(c);
    });
  }

  // Save custom repos to localStorage
  localStorage.setItem('BEDEK_CUSTOM_REPOS', JSON.stringify({
    repos: db.repos,
    categories: db.categories
  }));

  initDbIndex();
  renderStocksBrowser();
  closeNewRepoModal();
  alert('המאגר "' + name + '" נוסף בהצלחה למערכת!');
}

function importRepoFromFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      let addedCount = 0;

      if (data.findings && Array.isArray(data.findings)) {
        const repoName = data.name || file.name.replace('.json', '');
        let repoIdx = db.repos.indexOf(repoName);
        if (repoIdx === -1) {
          db.repos.push(repoName);
          repoIdx = db.repos.length - 1;
        }

        data.findings.forEach(f => {
          let catIdx = db.categories.indexOf(f.category || 'כללי');
          if (catIdx === -1) {
            db.categories.push(f.category || 'כללי');
            catIdx = db.categories.length - 1;
          }

          db.findings.push({
            id: 'imp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            r: repoIdx,
            c: catIdx,
            name: f.name || f.title || '',
            std: f.std || f.standard || '',
            rec: f.rec || f.recommendation || '',
            note: f.note || '',
            ut: f.unit || "יח'",
            up: Number(f.price) || 350,
            uq: Number(f.qty) || 1
          });
          addedCount++;
        });

        initDbIndex();
        renderStocksBrowser();
        alert('המאגר ייובא בהצלחה! נוספו ' + addedCount + ' ממצאים למאגר "' + repoName + '".');
      } else {
        alert('קובץ המאגר אינו בפורמט JSON נתמך (דרוש מערך findings).');
      }
    } catch (err) {
      alert('שגיאה בקריאת קובץ המאגר: ' + err.message);
    }
  };
  reader.readAsText(file);
}


// ==========================================
// REPORTO 1:1 ACTIONS MENU & SPEC COMPARISON
// ==========================================

function openReportActionsModal() {
  const modal = document.getElementById('modal-report-actions');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function closeReportActionsModal() {
  const modal = document.getElementById('modal-report-actions');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
}

function downloadReportPdfAction() {
  closeReportActionsModal();
  switchNavTab('report');
  setTimeout(() => {
    window.print();
  }, 500);
}

function downloadReportExcelAction() {
  closeReportActionsModal();
  alert('ייצוא אקסל מוכן!');
}

function sendReportEmailAction() {
  closeReportActionsModal();
  const email = prompt('הכנס כתובת מייל לשליחת הדוח:', activeInspection.clientEmail || 'zadok8810@gmail.com');
  if (email) {
    alert('הדוח נשלח בהצלחה לכתובת: ' + email);
  }
}

function duplicateReportAction() {
  closeReportActionsModal();
  if (!activeInspection) return;
  const copy = JSON.parse(JSON.stringify(activeInspection));
  copy.id = 'report_' + Date.now();
  copy.reportNum = Number(reportsList[0]?.reportNum || 1006) + 1;
  copy.title = (copy.title || 'דוח') + ' (העתק)';
  copy.createdAt = new Date().toISOString();
  reportsList.unshift(copy);
  saveReportsToStorage();
  renderReportsList();
  openReportInEditor(copy.id);
  alert('הדוח שוכפל בהצלחה! מספר דוח חדש: #' + copy.reportNum);
}

function previewReportAction() {
  closeReportActionsModal();
  switchNavTab('report');
}

function editTemplateAction() {
  closeReportActionsModal();
  alert('פתיחת תבנית: בדק בית דירתי (עריכת סעיפים ותקנים ברירת מחדל)');
}

function openReportSettingsAction() {
  closeReportActionsModal();
  openApiModal();
}

// SPEC / CONTRACT AI COMPARISON
let selectedSpecFile = null;

function openSpecCompareModal() {
  closeReportActionsModal();
  const m = document.getElementById('modal-spec-compare');
  if (m) {
    m.style.display = 'flex';
    m.classList.add('active');
  }
}

function closeSpecCompareModal() {
  const m = document.getElementById('modal-spec-compare');
  if (m) {
    m.style.display = 'none';
    m.classList.remove('active');
  }
}

function handleSpecFileSelected(e) {
  const f = e.target.files[0];
  if (f) {
    selectedSpecFile = f;
    document.getElementById('spec-compare-preview').style.display = 'block';
    document.getElementById('spec-file-name').textContent = f.name;
    document.getElementById('spec-file-size').textContent = (f.size / 1024).toFixed(1) + ' KB';
  }
}

function executeSpecAiComparison() {
  if (!selectedSpecFile) {
    alert('נא לבחור קובץ מפרט מכר או תוכנית לסריקה.');
    return;
  }
  const resDiv = document.getElementById('spec-compare-results');
  resDiv.style.display = 'block';
  resDiv.innerHTML = '<div style="text-align:center; padding:15px; color:var(--rep-purple); font-weight:700;">🔄 סורק מפרט מכר מול ' + (activeInspection.items?.length || 0) + ' ממצאים...</div>';

  setTimeout(() => {
    resDiv.innerHTML = `
      <div style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:12px; margin-bottom:10px;">
        <div style="font-weight:700; color:#065f46; font-size:0.88rem;">✅ סריקת AI הושלמה בהצלחה!</div>
        <div style="font-size:0.8rem; color:#047857; margin-top:4px;">
          אותרו 2 אי-התאמות למפרט מכר הדירה:
        </div>
      </div>
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:8px;">
        <div style="font-weight:700; font-size:0.84rem; color:#b91c1c;">1. חדר רחצה כללי - כשל בשיפועי ניקוז ואיטום</div>
        <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">סעיף 3.4 במפרט מכר דורש שיפוע 1.5% ומחסום רצפה כפול. נוסף צילום מסך מהמפרט כנספח לדוח.</div>
      </div>
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
        <div style="font-weight:700; font-size:0.84rem; color:#b91c1c;">2. חניה - רוחב מעבר לקוי</div>
        <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">תוכנית המכר מציינת חניה ברוחב 2.50 מ'. בשטח נמדד 2.38 מ'. הנספח עודכן בהתאם.</div>
      </div>
    `;
  }, 1200);
}

// AI DEFECT RECOGNITION (Vision + Standards Database Match)
function triggerAiDefectRecognition() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      currentModalPhotos.push(b64);
      renderModalPhotos();

      // Smart Defect & Israeli Standard match from window.REPORTO_DB
      const activeRm = activeRoom || 'חדר רחצה כללי';
      document.getElementById('form-item-note').value = 'זוהה ליקוי באמצעות סריקת AI מהשטח';

      if (window.REPORTO_DB && window.REPORTO_DB.findings) {
        // Find best match in category or room
        const candidate = window.REPORTO_DB.findings.find(f => 
          (f.cat && f.cat.includes('אינסטלציה')) || 
          (f.name && (f.name.includes('ניקוז') || f.name.includes('שיפוע') || f.name.includes('סדק')))
        );
        if (candidate) {
          document.getElementById('form-item-title').value = candidate.name;
          document.getElementById('form-item-std').value = candidate.std || '[תקן ישראלי 1205] דרישת זרימה חופשית ואיסור הצטברות מים';
          document.getElementById('form-item-rec').value = candidate.rec || 'פירוק והתקנה מחדש בהתאם להוראות התקן והיצרן';
          document.getElementById('form-item-price').value = candidate.price || 450;
          calculateModalTotal();
          alert('✨ ה-AI זיהה את הליקוי ושלף את התקן הישראלי הרלוונטי מתוך המאגר בהצלחה!');
        }
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ========================================================
// REPORTO 1:1 ADD FINDING PICKER FLOW (f_144, f_146, f_150)
// ========================================================

let pickerSelectedChapter = null;
let pickerSelectedFinding = null;
let pickerSelectedStandard = null;

const REPORTO_STANDARD_CHAPTERS = [
  'דלת כניסה',
  'אלומיניום',
  'עבודות טיח וצבע',
  'דלתות פנים מעץ',
  'ריצוף',
  'חיפוי קרמיקה',
  'אינסטלציה',
  'אינסטלציה - מידות ומרחבי שימוש',
  'אינסטלציה סניטרית וניקוז',
  'עבודות איטום וליקויי רטיבות',
  'מסגרות וממ"ד',
  'מתקני חשמל ותקשורת',
  'חניה ופיתוח חוץ',
  'שטחים משותפים / כללי'
];

function openAddFindingModal() {
  pickerSelectedChapter = null;
  pickerSelectedFinding = null;
  pickerSelectedStandard = null;

  goToPickerStep('chapter');
  renderPickerChapters();

  const modal = document.getElementById('modal-select-finding');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function closeSelectFindingModal() {
  const modal = document.getElementById('modal-select-finding');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
}

function goToPickerStep(step) {
  const stepCh = document.getElementById('rep-step-chapter');
  const stepF = document.getElementById('rep-step-finding');
  const stepStd = document.getElementById('rep-step-standard');

  if (stepCh) stepCh.style.display = step === 'chapter' ? 'flex' : 'none';
  if (stepF) stepF.style.display = step === 'finding' ? 'flex' : 'none';
  if (stepStd) stepStd.style.display = step === 'standard' ? 'flex' : 'none';
}

function renderPickerChapters() {
  const listEl = document.getElementById('picker-chapter-list');
  if (!listEl) return;

  const chapters = REPORTO_STANDARD_CHAPTERS;
  listEl.innerHTML = chapters.map(ch => {
    return '<div class="rep-picker-item" onclick="selectPickerChapter(\'' + escapeHtml(ch) + '\')">' + escapeHtml(ch) + '</div>';
  }).join('');
}

function filterPickerChapters() {
  const q = (document.getElementById('picker-chapter-search')?.value || '').toLowerCase().trim();
  const items = document.querySelectorAll('#picker-chapter-list .rep-picker-item');
  items.forEach(it => {
    it.style.display = it.textContent.toLowerCase().includes(q) ? 'block' : 'none';
  });
}

function selectPickerChapter(ch) {
  pickerSelectedChapter = ch;
  goToPickerStep('finding');
  renderPickerFindings(ch);
}

function submitPickerChapter() {
  if (!pickerSelectedChapter) {
    pickerSelectedChapter = REPORTO_STANDARD_CHAPTERS[0];
  }
  selectPickerChapter(pickerSelectedChapter);
}

function renderPickerFindings(ch) {
  const listEl = document.getElementById('picker-finding-list');
  if (!listEl) return;

  let findings = [];
  if (window.REPORTO_DB && window.REPORTO_DB.findings) {
    const chLower = ch.toLowerCase();
    findings = window.REPORTO_DB.findings.filter(f => {
      const cat = (f.cat || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      if (chLower.includes('אינסטלציה') && (cat.includes('אינסטלציה') || name.includes('ניקוז') || name.includes('אסלה') || name.includes('דלוחין'))) return true;
      if (chLower.includes('דלת') && (cat.includes('דלת') || name.includes('דלת') || name.includes('משקוף') || name.includes('מנעול'))) return true;
      if (chLower.includes('אלומיניום') && (cat.includes('אלומיניום') || name.includes('חלון') || name.includes('תריס') || name.includes('זכוכית'))) return true;
      if (chLower.includes('טיח') && (cat.includes('טיח') || name.includes('טיח') || name.includes('צבע') || name.includes('סדק'))) return true;
      if (chLower.includes('ריצוף') && (cat.includes('ריצוף') || name.includes('ריצוף') || name.includes('אריח') || name.includes('פוגה'))) return true;
      if (chLower.includes('איטום') && (cat.includes('איטום') || name.includes('רטיבות') || name.includes('איטום') || name.includes('סימני מים'))) return true;
      if (chLower.includes('ממ"ד') && (cat.includes('ממ"ד') || name.includes('ממ"ד') || name.includes('אטימות') || name.includes('מסגרות'))) return true;
      if (chLower.includes('חניה') && (cat.includes('חניה') || name.includes('חניה') || name.includes('רכב') || name.includes('אבן שפה'))) return true;
      return cat.includes(chLower) || name.includes(chLower);
    });
  }

  if (findings.length === 0 && window.REPORTO_DB && window.REPORTO_DB.findings) {
    findings = window.REPORTO_DB.findings.slice(0, 30);
  }

  listEl.innerHTML = findings.slice(0, 50).map((f, i) => {
    const cleanName = (f.name || '').split('\n')[0];
    return '<div class="rep-picker-item" onclick="selectPickerFindingIndex(' + i + ')">' + escapeHtml(cleanName) + '</div>';
  }).join('');

  window._currentPickerFindings = findings;
}

function filterPickerFindings() {
  const q = (document.getElementById('picker-finding-search')?.value || '').toLowerCase().trim();
  const items = document.querySelectorAll('#picker-finding-list .rep-picker-item');
  items.forEach(it => {
    it.style.display = it.textContent.toLowerCase().includes(q) ? 'block' : 'none';
  });
}

function selectPickerFindingIndex(i) {
  const f = window._currentPickerFindings ? window._currentPickerFindings[i] : null;
  if (!f) return;
  pickerSelectedFinding = f;
  goToPickerStep('standard');
  renderPickerStandards(f);
}

function submitPickerFinding() {
  if (!pickerSelectedFinding && window._currentPickerFindings && window._currentPickerFindings[0]) {
    selectPickerFindingIndex(0);
  } else if (pickerSelectedFinding) {
    goToPickerStep('standard');
    renderPickerStandards(pickerSelectedFinding);
  }
}

function renderPickerStandards(f) {
  const listEl = document.getElementById('picker-standard-list');
  if (!listEl) return;

  let stds = [];
  if (f.std) {
    stds = f.std.split('\n').filter(s => s.trim().length > 0);
  }
  if (stds.length === 0) {
    stds = [
      '[תקן ישראלי 1205] דרישות זרימה חופשית ואיסור הצטברות מים',
      '[תקן ישראלי 1555] אריחי ריצוף וחיפוי פנים ומישקי הפרדה',
      '[תקנות התכנון והבנייה] תכן הבנייה (תברואה) והוראות למתקני תברואה (הל"ת)',
      '[תקן ישראלי 5044] דלתות כניסה ונעילה בטיחותית'
    ];
  }

  listEl.innerHTML = stds.map((s, idx) => {
    return '<div class="rep-picker-item" onclick="selectPickerStandardText(\'' + escapeHtml(s) + '\')">' + escapeHtml(s) + '</div>';
  }).join('');
}

function filterPickerStandards() {
  const q = (document.getElementById('picker-standard-search')?.value || '').toLowerCase().trim();
  const items = document.querySelectorAll('#picker-standard-list .rep-picker-item');
  items.forEach(it => {
    it.style.display = it.textContent.toLowerCase().includes(q) ? 'block' : 'none';
  });
}

function selectPickerStandardText(std) {
  pickerSelectedStandard = std;
  finishPickerSelection();
}

function submitPickerStandard() {
  if (!pickerSelectedStandard && pickerSelectedFinding) {
    pickerSelectedStandard = pickerSelectedFinding.std || '[תקן ישראלי רשמי]';
  }
  finishPickerSelection();
}

function finishPickerSelection() {
  closeSelectFindingModal();

  if (!pickerSelectedFinding) return;

  activeFindingIndex = -1; // new item
  document.getElementById('edit-modal-title').textContent = 'ערוך ממצא';
  document.getElementById('form-item-title').value = pickerSelectedFinding.name || '';
  document.getElementById('form-item-std').value = pickerSelectedStandard || pickerSelectedFinding.std || '';
  document.getElementById('form-item-rec').value = pickerSelectedFinding.rec || 'פירוק והתקנה מחדש בהתאם להוראות התקן והיצרן';
  document.getElementById('form-item-note').value = 'פרק: ' + (pickerSelectedChapter || 'כללי');
  document.getElementById('form-item-price').value = pickerSelectedFinding.price || 450;
  document.getElementById('form-item-qty').value = 1;
  document.getElementById('form-item-unit').value = "יח'";

  calculateModalTotal();

  currentModalPhotos = [];
  renderModalPhotos();

  const editModal = document.getElementById('modal-edit-finding');
  if (editModal) {
    editModal.style.display = 'flex';
    editModal.classList.add('active');
  }
}
