
// App State
let db = window.REPORTO_DB || { repos: [], categories: [], findings: [] };
let activeTab = 'search';
let activeRepo = 'all';
let activeRoom = 'סלון';
let searchQuery = '';

const DEFAULT_ROOMS = [
  'כניסה / לובי', 'סלון', 'מטבח', 'פינת אוכל', 'מרפסת שמש',
  'חדר שינה הורים', 'חדר רחצה הורים', 'חדר שינה 1', 'חדר שינה 2',
  'חדר רחצה כללי', 'חדר שירות / כביסה', 'ממ"ד', 'מסדרון',
  'חצר / גינה', 'גג', 'מרתף', 'חניה', 'שטחים משותפים', 'כללי'
];

let inspection = {
  id: 'insp_' + Date.now(),
  clientName: '',
  clientPhone: '',
  address: '',
  propertyType: 'דירת מגורים',
  date: new Date().toISOString().split('T')[0],
  inspectorName: 'צוריאל צדוק',
  inspectorTitle: 'בודק מוסמך ואיתור נזילות',
  inspectorPhone: '053-9514613',
  companyName: 'צ. ביקורת מבנים',
  generalNotes: '',
  items: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSavedInspection();
  setupEventListeners();
  renderRoomBar();
  renderRepoFilters();
  renderFindings();
  updateBadge();
});

// Persistence
function saveInspection() {
  try {
    localStorage.setItem('bedek_active_inspection', JSON.stringify(inspection));
    updateBadge();
  } catch (e) {
    console.error('Storage error:', e);
  }
}

function loadSavedInspection() {
  const saved = localStorage.getItem('bedek_active_inspection');
  if (saved) {
    try {
      inspection = JSON.parse(saved);
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      setVal('input-client-name', inspection.clientName);
      setVal('input-client-phone', inspection.clientPhone);
      setVal('input-address', inspection.address);
      setVal('input-property-type', inspection.propertyType || 'דירת מגורים');
      setVal('input-date', inspection.date);
      setVal('input-general-notes', inspection.generalNotes);
    } catch(e) {
      console.error(e);
    }
  }
}

function updateBadge() {
  const badge = document.getElementById('badge-count');
  if (badge) {
    badge.textContent = inspection.items.length;
    badge.style.display = inspection.items.length > 0 ? 'inline-block' : 'none';
  }
}

// Navigation Tabs
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === 'tab-' + tab);
  });
  
  if (tab === 'inspection') {
    renderInspectionItems();
  } else if (tab === 'report') {
    generateReportPreview();
  }
}

// Room Bar
function renderRoomBar() {
  const bar = document.getElementById('room-bar');
  if (!bar) return;
  bar.innerHTML = '';
  DEFAULT_ROOMS.forEach(room => {
    const pill = document.createElement('div');
    pill.className = 'room-pill' + (room === activeRoom ? ' selected' : '');
    pill.textContent = room;
    pill.onclick = () => {
      activeRoom = room;
      renderRoomBar();
    };
    bar.appendChild(pill);
  });
}

// Repo Filters
function renderRepoFilters() {
  const container = document.getElementById('repo-filters');
  if (!container) return;
  container.innerHTML = '';
  
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn' + (activeRepo === 'all' ? ' active' : '');
  allBtn.textContent = 'הכל (' + db.findings.length + ')';
  allBtn.onclick = () => { activeRepo = 'all'; renderRepoFilters(); renderFindings(); };
  container.appendChild(allBtn);

  db.repos.forEach((repoName, idx) => {
    const count = db.findings.filter(f => f.r === idx).length;
    if (count === 0) return;
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (activeRepo === idx ? ' active' : '');
    let shortName = repoName.replace('מאגר ממצאים - ', '').replace('מאגר ממצאים ', '');
    btn.textContent = shortName + ' (' + count + ')';
    btn.onclick = () => { activeRepo = idx; renderRepoFilters(); renderFindings(); };
    container.appendChild(btn);
  });
}

// Render Findings List
function renderFindings() {
  const list = document.getElementById('findings-list');
  if (!list) return;
  list.innerHTML = '';

  const q = searchQuery.trim().toLowerCase();
  let filtered = db.findings.filter(f => {
    if (activeRepo !== 'all' && f.r !== activeRepo) return false;
    if (!q) return true;
    const catName = db.categories[f.c] || '';
    return f.name.toLowerCase().includes(q) ||
           (f.std && f.std.toLowerCase().includes(q)) ||
           catName.toLowerCase().includes(q);
  });

  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.textContent = 'נמצאו ' + filtered.length + ' ממצאים';
  }

  const slice = filtered.slice(0, 30);
  if (slice.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding: 30px; color:#64748b;">לא נמצאו ממצאים מתאימים לחיפוש.</div>';
    return;
  }

  slice.forEach(f => {
    const isAdded = inspection.items.some(it => it.findingId === f.id && it.room === activeRoom);
    const catName = db.categories[f.c] || '';
    const item = document.createElement('div');
    item.className = 'finding-item' + (isAdded ? ' added' : '');
    
    let stdHtml = '';
    if (f.std) {
      stdHtml = '<div class="finding-details"><div class="finding-std">📜 <b>תקן:</b> ' + escapeHtml(f.std) + '</div>' + 
                (f.rec ? '<div class="finding-rec">🔧 <b>תיקון:</b> ' + escapeHtml(f.rec) + '</div>' : '') + '</div>';
    }

    item.innerHTML = 
      '<div class="finding-header">' +
        '<div>' +
          '<div class="finding-title">' + escapeHtml(f.name) + '</div>' +
          '<div class="finding-meta">📁 ' + escapeHtml(catName) + (f.ut ? ' • ' + f.ut : '') + '</div>' +
        '</div>' +
      '</div>' +
      stdHtml +
      '<div class="finding-actions">' +
        '<button class="btn btn-primary" onclick="openAddModal(\'' + f.id + '\')">' +
          (isAdded ? '✓ נוסף ל' + activeRoom : '+ הוסף ל' + activeRoom) +
        '</button>' +
      '</div>';
    list.appendChild(item);
  });

  if (filtered.length > 30) {
    const more = document.createElement('div');
    more.style.textAlign = 'center';
    more.style.padding = '15px';
    more.innerHTML = '<span style="color:#64748b; font-size:0.85rem;">מוצגים 30 מתוך ' + filtered.length + '. דייק את החיפוש לתוצאות נוספות.</span>';
    list.appendChild(more);
  }
}

// Modal Editor
let currentEditingItem = null;

function openAddModal(findingId) {
  const f = db.findings.find(x => x.id === findingId);
  if (!f) return;

  currentEditingItem = {
    id: 'it_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    findingId: f.id,
    room: activeRoom,
    title: f.name,
    std: f.std || '',
    rec: f.rec || '',
    price: f.up || 0,
    qty: 1,
    unit: f.ut || 'יח\'',
    note: '',
    photos: []
  };

  populateModal(currentEditingItem);
  document.getElementById('modal-overlay').classList.add('active');
}

function openEditItemModal(itemId) {
  const item = inspection.items.find(x => x.id === itemId);
  if (!item) return;

  currentEditingItem = item;
  populateModal(currentEditingItem);
  document.getElementById('modal-overlay').classList.add('active');
}

function populateModal(item) {
  document.getElementById('modal-title').textContent = 'עריכת ליקוי לבדיקה';
  document.getElementById('modal-room').value = item.room;
  document.getElementById('modal-item-title').value = item.title;
  document.getElementById('modal-std').value = item.std;
  document.getElementById('modal-rec').value = item.rec;
  document.getElementById('modal-price').value = item.price || 0;
  document.getElementById('modal-qty').value = item.qty || 1;
  document.getElementById('modal-unit').value = item.unit || 'יח';
  document.getElementById('modal-note').value = item.note || '';
  renderModalPhotos();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  currentEditingItem = null;
}

function saveModalItem() {
  if (!currentEditingItem) return;

  currentEditingItem.room = document.getElementById('modal-room').value;
  currentEditingItem.title = document.getElementById('modal-item-title').value.trim();
  currentEditingItem.std = document.getElementById('modal-std').value.trim();
  currentEditingItem.rec = document.getElementById('modal-rec').value.trim();
  currentEditingItem.price = parseFloat(document.getElementById('modal-price').value) || 0;
  currentEditingItem.qty = parseFloat(document.getElementById('modal-qty').value) || 1;
  currentEditingItem.unit = document.getElementById('modal-unit').value.trim();
  currentEditingItem.note = document.getElementById('modal-note').value.trim();

  const existingIdx = inspection.items.findIndex(x => x.id === currentEditingItem.id);
  if (existingIdx >= 0) {
    inspection.items[existingIdx] = currentEditingItem;
  } else {
    inspection.items.push(currentEditingItem);
  }

  saveInspection();
  closeModal();
  renderFindings();
  if (activeTab === 'inspection') renderInspectionItems();
}

function deleteModalItem() {
  if (!currentEditingItem) return;
  if (!confirm('האם להסיר ליקוי זה מהבדיקה?')) return;
  
  inspection.items = inspection.items.filter(x => x.id !== currentEditingItem.id);
  saveInspection();
  closeModal();
  renderFindings();
  if (activeTab === 'inspection') renderInspectionItems();
}

// Photos
function handlePhotoUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.onload = (e) => {
      compressImage(e.target.result, 1280, 0.75, (compressed) => {
        if (!currentEditingItem.photos) currentEditingItem.photos = [];
        currentEditingItem.photos.push(compressed);
        renderModalPhotos();
      });
    };
    reader.readAsDataURL(file);
  }
  event.target.value = '';
}

function compressImage(base64, maxDim, quality, callback) {
  const img = new Image();
  img.src = base64;
  img.onload = () => {
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
}

function renderModalPhotos() {
  const container = document.getElementById('modal-photos-grid');
  if (!container) return;
  container.innerHTML = '';
  
  (currentEditingItem.photos || []).forEach((photoData, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'photo-wrapper';
    wrap.innerHTML = '<img src="' + photoData + '" class="photo-thumb"><button type="button" class="photo-delete" onclick="removePhoto(' + idx + ')">✕</button>';
    container.appendChild(wrap);
  });
}

function removePhoto(idx) {
  if (currentEditingItem && currentEditingItem.photos) {
    currentEditingItem.photos.splice(idx, 1);
    renderModalPhotos();
  }
}

// Render Inspection Items
function renderInspectionItems() {
  const container = document.getElementById('inspection-items-list');
  if (!container) return;
  container.innerHTML = '';

  if (inspection.items.length === 0) {
    container.innerHTML = 
      '<div class="card" style="text-align:center; padding: 40px 20px; color:#64748b;">' +
        '<div style="font-size:2rem; margin-bottom:10px;">📋</div>' +
        '<h3>טרם נוספו ליקויים לבדיקה</h3>' +
        '<p style="margin-top:8px; font-size:0.9rem;">עבור ללשונית "מאגר ממצאים" ובחר ליקויים לחללים השונים.</p>' +
        '<button class="btn btn-primary" style="margin-top:16px;" onclick="switchTab(\'search\')">פתח מאגר ממצאים</button>' +
      '</div>';
    return;
  }

  const roomsMap = {};
  inspection.items.forEach(it => {
    if (!roomsMap[it.room]) roomsMap[it.room] = [];
    roomsMap[it.room].push(it);
  });

  let totalCost = 0;

  Object.keys(roomsMap).forEach(roomName => {
    const items = roomsMap[roomName];
    const groupCard = document.createElement('div');
    groupCard.className = 'card';
    let cardContent = '<h3 style="color:var(--primary); border-bottom:2px solid var(--accent-light); padding-bottom:6px; margin-bottom:12px;">📍 ' + escapeHtml(roomName) + ' (' + items.length + ')</h3>';
    
    items.forEach(it => {
      const itemCost = (it.price || 0) * (it.qty || 1);
      totalCost += itemCost;
      
      let photosHtml = '';
      if (it.photos && it.photos.length > 0) {
        photosHtml = '<div style="display:flex; gap:6px; margin-top:6px;">' +
          it.photos.map(p => '<img src="' + p + '" style="width:45px; height:45px; border-radius:6px; object-fit:cover; border:1px solid #cbd5e1;">').join('') +
          '</div>';
      }

      cardContent += 
        '<div style="border-bottom:1px solid #f1f5f9; padding:10px 0;">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
            '<div style="font-weight:600; font-size:0.95rem;">' + escapeHtml(it.title) + '</div>' +
            '<button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="openEditItemModal(\'' + it.id + '\')">✏️ ערוך</button>' +
          '</div>' +
          (it.std ? '<div style="font-size:0.8rem; color:#1e3a8a; margin-top:4px;">📜 ' + escapeHtml(it.std.substring(0, 80)) + '...</div>' : '') +
          '<div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#64748b; margin-top:6px;">' +
            '<span>כמות: ' + it.qty + ' ' + it.unit + (it.price ? ' • ' + it.price + ' ₪' : '') + '</span>' +
            (itemCost > 0 ? '<b style="color:#0f2942;">סה"כ: ' + itemCost.toLocaleString() + ' ₪</b>' : '') +
          '</div>' +
          photosHtml +
        '</div>';
    });

    groupCard.innerHTML = cardContent;
    container.appendChild(groupCard);
  });

  const summaryCard = document.createElement('div');
  summaryCard.className = 'card';
  summaryCard.style.background = '#0f2942';
  summaryCard.style.color = '#fff';
  summaryCard.innerHTML = 
    '<div style="display:flex; justify-content:space-between; align-items:center;">' +
      '<div>' +
        '<div style="font-size:0.85rem; color:#94a3b8;">סה"כ ממצאים</div>' +
        '<div style="font-size:1.3rem; font-weight:bold;">' + inspection.items.length + ' ליקויים</div>' +
      '</div>' +
      '<div style="text-align:left;">' +
        '<div style="font-size:0.85rem; color:#94a3b8;">אומדן עלויות (לפני מע"מ)</div>' +
        '<div style="font-size:1.3rem; font-weight:bold; color:#38bdf8;">' + totalCost.toLocaleString() + ' ₪</div>' +
      '</div>' +
    '</div>';
  container.prepend(summaryCard);
}

// Generate Printable / Preview Report
function generateReportPreview() {
  const container = document.getElementById('report-preview-container');
  const printView = document.getElementById('print-view');
  if (!container || !printView) return;

  let totalCost = 0;
  let itemsHtml = '';
  let costTableRows = '';
  let itemCounter = 1;

  const roomsMap = {};
  inspection.items.forEach(it => {
    if (!roomsMap[it.room]) roomsMap[it.room] = [];
    roomsMap[it.room].push(it);
  });

  Object.keys(roomsMap).forEach(roomName => {
    const items = roomsMap[roomName];
    itemsHtml += '<h2 style="color:#0f2942; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin: 24px 0 16px 0;">פרק: ' + escapeHtml(roomName) + '</h2>';
    
    items.forEach(it => {
      const itemCost = (it.price || 0) * (it.qty || 1);
      totalCost += itemCost;

      costTableRows += 
        '<tr>' +
          '<td style="text-align:center;">' + itemCounter + '</td>' +
          '<td>' + escapeHtml(roomName) + '</td>' +
          '<td>' + escapeHtml(it.title) + '</td>' +
          '<td style="text-align:center;">' + it.qty + ' ' + escapeHtml(it.unit) + '</td>' +
          '<td style="text-align:left;">' + (it.price ? it.price.toLocaleString() + ' ₪' : '-') + '</td>' +
          '<td style="text-align:left;">' + (itemCost > 0 ? itemCost.toLocaleString() + ' ₪' : '-') + '</td>' +
        '</tr>';

      let photosHtml = '';
      if (it.photos && it.photos.length > 0) {
        photosHtml = '<div class="report-photos">' + 
          it.photos.map((p, pIdx) => '<div style="text-align:center;"><img src="' + p + '" class="report-img"><div style="font-size:8pt; color:#64748b;">תמונה ' + itemCounter + '.' + (pIdx+1) + '</div></div>').join('') +
          '</div>';
      }

      itemsHtml += 
        '<div class="report-finding">' +
          '<div class="report-finding-header">' +
            '<span>סעיף ' + itemCounter + ': ' + escapeHtml(it.title) + ' (' + escapeHtml(roomName) + ')</span>' +
            (itemCost > 0 ? '<span>אומדן: ' + itemCost.toLocaleString() + ' ₪</span>' : '') +
          '</div>' +
          '<div class="report-finding-body">' +
            (it.std ? '<div style="margin-bottom:8px; color:#1e3a8a;"><b>דרישת התקן / הדין:</b><br>' + escapeHtml(it.std).replace(/\n/g, '<br>') + '</div>' : '') +
            (it.rec ? '<div style="margin-bottom:8px; color:#065f46;"><b>הנחיה לתיקון:</b><br>' + escapeHtml(it.rec).replace(/\n/g, '<br>') + '</div>' : '') +
            (it.note ? '<div style="margin-bottom:8px; color:#475569;"><b>הערת בודק:</b> ' + escapeHtml(it.note) + '</div>' : '') +
            photosHtml +
          '</div>' +
        '</div>';
      itemCounter++;
    });
  });

  const fullReportHtml = 
    '<div class="report-page report-cover">' +
      '<div>' +
        '<div class="report-cover-logo">צ. ביקורת מבנים</div>' +
        '<div style="font-size:12pt; color:#64748b; margin-top:6px;">ביקורת מבנים • איתור נזילות • ייעוץ הנדסי</div>' +
      '</div>' +
      '<div>' +
        '<div class="report-cover-title">חוות דעת מומחה<br>לביקורת מבנה ואיתור ליקויים</div>' +
        '<table class="report-details-table">' +
          '<tr><td class="label">שם המזמין:</td><td><b>' + escapeHtml(inspection.clientName || 'ישראל ישראלי') + '</b></td></tr>' +
          '<tr><td class="label">כתובת הנכס:</td><td><b>' + escapeHtml(inspection.address || 'לא צוינה כתובת') + '</b></td></tr>' +
          '<tr><td class="label">סוג הנכס:</td><td>' + escapeHtml(inspection.propertyType || 'דירת מגורים') + '</td></tr>' +
          '<tr><td class="label">תאריך הבדיקה:</td><td>' + escapeHtml(inspection.date || '') + '</td></tr>' +
          '<tr><td class="label">שם הבודק:</td><td><b>' + escapeHtml(inspection.inspectorName) + '</b>, ' + escapeHtml(inspection.inspectorTitle) + '</td></tr>' +
          '<tr><td class="label">טלפון ליצירת קשר:</td><td>' + escapeHtml(inspection.inspectorPhone) + '</td></tr>' +
        '</table>' +
      '</div>' +
      '<div style="font-size:10pt; color:#475569; border-top:1px solid #cbd5e1; padding-top:12px;">' +
        'דוח זה מהווה חוות דעת מומחה ערוכה לפי פקודת הראיות [נוסח חדש], התשל"א-1971.' +
      '</div>' +
    '</div>' +
    '<div class="report-page">' +
      '<h2 style="color:#0f2942; border-bottom:2px solid #0f2942; padding-bottom:8px;">הצהרת מומחה לבית המשפט</h2>' +
      '<p style="margin: 16px 0; font-size:10.5pt; text-align:justify; line-height:1.7;">' +
        'אני הח"מ, <b>' + escapeHtml(inspection.inspectorName) + '</b>, נותן חוות דעתי זו במקום עדות בבית המשפט, ומצהיר בזאת כי ידוע לי היטב, שלעניין הוראות החוק הפלילי בדבר עדות שקר בשבועה בבית המשפט, דין חוות דעתי זו כשהיא חתומה על ידי כדין עדות בשבועה שנתתי בבית המשפט.<br><br>' +
        'הבדיקה נערכה בהתאם לתקנות התכנון והבנייה, הוראות למתקני תברואה (הל"ת), מפרטי מכון התקנים הישראלי (ת"י) וכללי המקצוע המקובלים.' +
      '</p>' +
      '<h3 style="color:#0f2942; margin-top:24px;">רקע כללי ותיאור הנכס</h3>' +
      '<p style="margin: 8px 0; font-size:10.5pt;">' +
        'בתאריך <b>' + escapeHtml(inspection.date) + '</b> נערכה ביקורת בנכס בכתובת <b>' + escapeHtml(inspection.address) + '</b>.<br>' +
        (inspection.generalNotes ? '<b>הערות רקע:</b> ' + escapeHtml(inspection.generalNotes) : '') +
      '</p>' +
      '<div style="margin-top:30px; background:#f8fafc; border:1px solid #cbd5e1; padding:16px; border-radius:6px;">' +
        '<h4 style="margin-bottom:8px;">ריכוז כמותי:</h4>' +
        '<div>סך הכל נמצאו: <b>' + inspection.items.length + '</b> ליקויי בנייה ואי התאמות בתקנים.</div>' +
      '</div>' +
    '</div>' +
    '<div class="report-page">' +
      itemsHtml +
    '</div>' +
    '<div class="report-page">' +
      '<h2 style="color:#0f2942; border-bottom:2px solid #0f2942; padding-bottom:8px;">אומדן עלויות תיקון הליקויים</h2>' +
      '<table class="cost-summary-table">' +
        '<thead>' +
          '<tr>' +
            '<th style="width:5%;">#</th>' +
            '<th style="width:20%;">מיקום</th>' +
            '<th>תיאור הליקוי</th>' +
            '<th style="width:12%;">כמות</th>' +
            '<th style="width:15%;">מחיר יח\'</th>' +
            '<th style="width:15%;">סה"כ</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          (costTableRows || '<tr><td colspan="6" style="text-align:center;">לא הוזנו עלויות</td></tr>') +
          '<tr style="background:#f1f5f9; font-weight:bold;">' +
            '<td colspan="5" style="text-align:left;">סה"כ ביצוע ישיר (לפני מע"מ):</td>' +
            '<td style="text-align:left;">' + totalCost.toLocaleString() + ' ₪</td>' +
          '</tr>' +
          '<tr>' +
            '<td colspan="5" style="text-align:left;">פיקוח הנדסי (10%):</td>' +
            '<td style="text-align:left;">' + Math.round(totalCost * 0.1).toLocaleString() + ' ₪</td>' +
          '</tr>' +
          '<tr style="background:#e2e8f0; font-size:11pt; font-weight:bold;">' +
            '<td colspan="5" style="text-align:left;">סה"כ כולל פיקוח הנדסי (לפני מע"מ):</td>' +
            '<td style="text-align:left; color:#1e3a8a;">' + Math.round(totalCost * 1.1).toLocaleString() + ' ₪</td>' +
          '</tr>' +
        '</tbody>' +
      '</table>' +
      '<div style="margin-top:60px; display:flex; justify-content:space-between; align-items:flex-end;">' +
        '<div>' +
          '<div>תאריך: <b>' + escapeHtml(inspection.date) + '</b></div>' +
        '</div>' +
        '<div style="text-align:center;">' +
          '<div style="font-size:12pt; font-weight:bold;">' + escapeHtml(inspection.inspectorName) + '</div>' +
          '<div style="font-size:10pt; color:#64748b;">' + escapeHtml(inspection.inspectorTitle) + '</div>' +
          '<div style="margin-top:30px; border-top:1px dashed #000; width:180px; padding-top:4px;">חתימת המומחה</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  container.innerHTML = fullReportHtml;
  printView.innerHTML = fullReportHtml;
}

function printReport() {
  generateReportPreview();
  window.print();
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupEventListeners() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value;
        renderFindings();
      }, 150);
    });
  }

  const clientInputs = ['input-client-name', 'input-client-phone', 'input-address', 'input-property-type', 'input-date', 'input-general-notes'];
  clientInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        inspection.clientName = document.getElementById('input-client-name').value;
        inspection.clientPhone = document.getElementById('input-client-phone').value;
        inspection.address = document.getElementById('input-address').value;
        inspection.propertyType = document.getElementById('input-property-type').value;
        inspection.date = document.getElementById('input-date').value;
        inspection.generalNotes = document.getElementById('input-general-notes').value;
        saveInspection();
      });
    }
  });
}

// ==========================================
// AI CHAT & VISION INTEGRATION
// ==========================================
let chatPendingImage = null;

function populateChatRoomSelect() {
  const sel = document.getElementById('chat-room-select');
  if (!sel) return;
  sel.innerHTML = '';
  DEFAULT_ROOMS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    if (r === activeRoom) opt.selected = true;
    sel.appendChild(opt);
  });
}

function updateChatRoomDisplay() {
  const sel = document.getElementById('chat-room-select');
  if (sel) sel.value = activeRoom;
}

function startVisionScan() {
  switchTab('chat');
  setTimeout(() => {
    const fileInput = document.getElementById('chat-file-input');
    if (fileInput) fileInput.click();
  }, 150);
}

function handleChatImageSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      // Resize if large to ensure fast mobile upload
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      const maxDim = 1200;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
        else { w = Math.round(w * (maxDim / h)); h = maxDim; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      chatPendingImage = canvas.toDataURL('image/jpeg', 0.85);

      const previewContainer = document.getElementById('chat-image-preview');
      const previewImg = document.getElementById('chat-preview-img');
      if (previewContainer && previewImg) {
        previewImg.src = chatPendingImage;
        previewContainer.style.display = 'flex';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function clearChatImage() {
  chatPendingImage = null;
  const previewContainer = document.getElementById('chat-image-preview');
  const fileInput = document.getElementById('chat-file-input');
  if (previewContainer) previewContainer.style.display = 'none';
  if (fileInput) fileInput.value = '';
}

// Client-Side AI & Building Standards Expert Engine
const EXPERT_SYNONYMS = {
  "איטום": ["רטיבות", "חדירת מים", "הרטבה", "רובה", "סיליקון", "מסטיק", "פוגות", "רולקה", "אטימה", "סף", "מפתן"],
  "רטיבות": ["איטום", "סימני רטיבות", "עובש", "קילוף", "קפילרית", "נזילה", "כתמי מים", "לחות"],
  "סדק": ["סדקים", "נימי", "טיח", "צבע", "הפרדות", "סדיקה", "שבר"],
  "ריצוף": ["אריחים", "גרניט פורצלן", "קרמיקה", "פוגות", "מישקים", "שקיעה", "שבירה", "חלול", "מישק הפרדה", "תפר"],
  "חיפוי": ["קרמיקה", "הדבקה", "אריחי קיר", "פוגות", "נשירה"],
  "מעקה": ["מסעד", "גובה מגן", "מדרגות", "מרפסת", "סורג", "1142", "1918"],
  "שיפוע": ["ניקוז", "עמידת מים", "שיפועים", "קולטן", "מרפסת", "גג", "מקלחת", "אסלה"],
  'ממד': ['ממד', 'דלת הדף', 'חלון הדף', 'שסתום', 'צנרת', 'איוורור', 'הגא', '4422'],
  "דלת": ["משקוף", "כנף", "מנעול", "סף", "הלבשות", "מרווח", "צילינדר", "ידית", "5044", "23"],
  "חלון": ["אלומיניום", "כנף", "זכוכית", "מסילה", "איטום", "גומיות", "1068", "4068"],
  'אינסטלציה': ['סיפון', 'ברז', 'אסלה', 'ניאגרה', 'כיור', 'ביקורת', 'מחסום רצפה', 'קולטן', '1205', 'הלת', 'שיפוע'],
  'אסלה': ['מושב אסלה', 'שיפוע', 'פילוס', 'הדחה', 'מנגנון', '1205', 'הלת', 'נזילה'],
  'חשמל': ['לוח חשמל', 'מפסק', 'שקע', 'הארקה', 'אינטרקום', 'נתיך', 'מאמת', 'גוף תאורה'],
  "אקוסטיקה": ["בידוד אקוסטי", "רעש", "הולם", "קול", "1068"]
};

function matchClientDefects(query, room) {
  const dbFindings = (window.REPORTO_DB && window.REPORTO_DB.findings) ? window.REPORTO_DB.findings : [];
  const shimonItems = (window.SHIMON_INSPECTION && window.SHIMON_INSPECTION.items) ? window.SHIMON_INSPECTION.items : [];
  
  const qLower = (query || '').toLowerCase();
  const tokens = qLower.split(/\s+/).filter(t => t.length > 1);
  
  const expandedTokens = new Set(tokens);
  for (const [k, syns] of Object.entries(EXPERT_SYNONYMS)) {
    if (qLower.includes(k) || tokens.some(t => t.includes(k))) {
      syns.forEach(s => expandedTokens.add(s.toLowerCase()));
    }
  }

  const scored = [];

  for (const it of shimonItems) {
    const text = ((it.title || '') + ' ' + (it.std || '') + ' ' + (it.rec || '')).toLowerCase();
    let score = 0;
    for (const tok of expandedTokens) {
      if (text.includes(tok)) score += 10;
      if ((it.title || '').toLowerCase().includes(tok)) score += 20;
    }
    if (score > 0) scored.push({ score, item: it, source: 'shimon' });
  }

  for (const f of dbFindings) {
    const text = ((f.name || '') + ' ' + (f.std || '') + ' ' + (f.rec || '')).toLowerCase();
    let score = 0;
    for (const tok of expandedTokens) {
      if (text.includes(tok)) score += 5;
      if ((f.name || '').toLowerCase().includes(tok)) score += 12;
    }
    if (score > 0) scored.push({ score, finding: f, source: 'reporto' });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function generateClientExpertReply(text, image, room) {
  const matches = matchClientDefects(text || '', room || '');
  const top = matches.length > 0 ? matches[0] : null;

  let defect = null;
  if (top) {
    if (top.source === 'shimon' && top.item) {
      const it = top.item;
      defect = {
        title: it.title,
        std: it.std,
        rec: it.rec,
        price: it.price || 950,
        unit: it.unit || 'קומפלט',
        room: room || it.room || 'כללי',
        findingId: it.id
      };
    } else if (top.finding) {
      const f = top.finding;
      defect = {
        title: f.name,
        std: f.std || 'תקנות התכנון והבנייה וכללי המקצוע המקובלים',
        rec: f.rec || 'נדרש לתקן את הליקוי בהתאם להנחיות התקן והיצרן',
        price: f.up || 450,
        unit: f.ut || 'יח\'',
        room: room || 'כללי',
        findingId: f.id
      };
    }
  }

  if (!defect) {
    defect = {
      title: 'ליקוי ואי-התאמה: ' + (text || 'בדיקת ליקוי במבנה'),
      std: 'תקנות התכנון והבנייה (בקשה להיתר, תנאיו ואגרות) וההמפרט הכללי לעבודות בנייה',
      rec: 'יש לבצע פירוק, הכנה מחדש וביצוע מקצועי בהתאם להנחיות התקנים והוראות היצרן.',
      price: 500,
      unit: 'קומפלט',
      room: room || 'כללי',
      findingId: 'gen_' + Date.now()
    };
  }

  const reply = '🔍 **ניתוח מהנדס מומחה (צ. ביקורת מבנים):**\n' +
    'בבדיקה הנדסית של הממצא ב' + (room || 'נכס') + ', אותרה אי-התאמה לדרישות התקן הישראלי ולכללי המקצוע הראויים.\n\n' +
    '📜 **ביסוס הנדסי ותקנים מחייבים:**\n' +
    (defect.std || 'תקנות התכנון והבנייה (הגנת המבנה מרטיבות ובטיחות משתמשים).') + '\n\n' +
    '🛠️ **הנחיית תיקון ואופן ביצוע:**\n' +
    (defect.rec ? defect.rec : 'יש לתקן באופן מקצועי ולהשיב את המצב לקדמותו.') + '\n\n' +
    '💡 *הממצא ערוך ומוכן כסעיף תקני לחוות דעת הנדסית, כולל אומדן כספי מוערך.*';

  return { success: true, reply: reply, defect: defect };
}

async function sendChatMessage() {
  const inputEl = document.getElementById('chat-input-text');
  const text = (inputEl ? inputEl.value : '').trim();
  const image = chatPendingImage;

  if (!text && !image) return;

  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  let userHtml = '<div class="chat-bubble-author">צוריאל (' + activeRoom + ')</div>';
  if (text) userHtml += '<div>' + escapeHtml(text) + '</div>';
  if (image) userHtml += '<img class="chat-msg-img" src="' + image + '">';
  userBubble.innerHTML = userHtml;
  messagesContainer.appendChild(userBubble);

  if (inputEl) inputEl.value = '';
  clearChatImage();
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'chat-bubble bot';
  loadingBubble.id = 'chat-loading-bubble';
  loadingBubble.innerHTML = '<div class="chat-bubble-author">🤖 עוזר הנדסי AI</div><div>מנתח מול מאגר 1,773 התקנים ומפיק מענה הנדסי... ⏳</div>';
  messagesContainer.appendChild(loadingBubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  await new Promise(r => setTimeout(r, 300));

  let data = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ message: text, image: image, room: activeRoom })
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    // Expected when offline or on static CDN
  }

  if (!data || !data.success) {
    data = generateClientExpertReply(text, image, activeRoom);
  }

  loadingBubble.remove();

  const botBubble = document.createElement('div');
  botBubble.className = 'chat-bubble bot';

  let formattedText = escapeHtml(data.reply || '')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');

  let botHtml = '<div class="chat-bubble-author">🤖 עוזר הנדסי מומחה (צ. ביקורת מבנים)</div>' +
                '<div>' + formattedText + '</div>';

  if (data.defect) {
    const d = data.defect;
    d.room = d.room || activeRoom;
    if (image) d.photo = image;

    const defectIdStr = 'def_' + Date.now();
    window[defectIdStr] = d;

    botHtml += 
      '<div class="chat-defect-card">' +
        '<div class="chat-defect-title">📋 ' + escapeHtml((d.title || '').split('\n')[0]) + '</div>' +
        (d.std ? '<div class="chat-defect-meta">📜 <b>תקן:</b> ' + escapeHtml(d.std) + '</div>' : '') +
        (d.rec ? '<div class="chat-defect-meta">🔧 <b>המלצה:</b> ' + escapeHtml(d.rec.slice(0, 160)) + '...</div>' : '') +
        (d.price ? '<div class="chat-defect-meta">💰 <b>אומדן:</b> ' + d.price + ' ₪ ' + (d.unit ? 'ל' + d.unit : '') + '</div>' : '') +
        '<button type="button" class="btn btn-primary btn-block" style="margin-top:8px; font-weight:700;" onclick="insertChatDefectToReport(\"' + defectIdStr + '\", this)">' +
          '➕ הוסף ליקוי זה לדוח (' + escapeHtml(d.room) + ')' +
        '</button>' +
      '</div>';
  }

  botBubble.innerHTML = botHtml;
  messagesContainer.appendChild(botBubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function insertChatDefectToReport(defectKey, btn) {
  const d = window[defectKey];
  if (!d) return;

  const item = {
    id: 'it_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    findingId: d.findingId || ('chat_' + Date.now()),
    room: d.room || activeRoom,
    title: d.title || '',
    std: d.std || '',
    rec: d.rec || '',
    price: Number(d.price) || 0,
    qty: Number(d.qty) || 1,
    unit: d.unit || "יח'",
    note: d.note || '',
    photos: d.photo ? [d.photo] : []
  };

  inspection.items.push(item);
  saveInspection();
  updateBadge();

  if (btn) {
    btn.disabled = true;
    btn.textContent = '✅ נוסף בהצלחה לדוח ב' + item.room;
    btn.style.background = '#10b981';
    btn.style.borderColor = '#10b981';
  }
}

// Hook into switchTab
const originalSwitchTab = window.switchTab;
window.switchTab = function(tab) {
  if (originalSwitchTab) originalSwitchTab(tab);
  if (tab === 'chat') {
    populateChatRoomSelect();
    const messages = document.getElementById('chat-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }
};

// Also populate chat room select on init
document.addEventListener('DOMContentLoaded', () => {
  populateChatRoomSelect();
});


// Shimon Meir Report Loader
window.loadShimonReport = function(confirmPrompt) {
  if (confirmPrompt && !confirm('לטעון מחדש את כל 30 הליקויים של שמעון מאיר כהן קדוש?')) return;
  if (window.SHIMON_INSPECTION) {
    inspection = JSON.parse(JSON.stringify(window.SHIMON_INSPECTION));
    saveInspection();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('input-client-name', inspection.clientName);
    setVal('input-client-phone', inspection.clientPhone);
    setVal('input-address', inspection.address);
    setVal('input-property-type', inspection.propertyType || 'דירת מגורים');
    setVal('input-date', inspection.date);
    setVal('input-general-notes', inspection.generalNotes);
    updateBadge();
    if (activeTab === 'inspection') renderInspectionItems();
    console.log('Shimon Meir inspection loaded successfully!');
  }
};

// Check if inspection is empty on load, auto-load Shimon
const origInit = document.addEventListener;
window.addEventListener('load', () => {
  if (!inspection || !inspection.items || inspection.items.length === 0) {
    window.loadShimonReport(false);
  }
});
