// State
let currentWeekStart = getSunday(new Date());
let events = []; // STRICT: Empty initial state with zero dummy data
let tables = []; // STRICT: Empty initial state for tables
let deletedTables = []; // Deleted Tables Archive
let permanentlyDeletedIds = []; // Registry of permanently deleted table IDs to prevent resurrection
let editingEventId = null;
let editingTableId = null;
let currentTab = 'all'; // Single active tab: 'all' | 'today' | 'life' | 'work' | 'fun'
let subCategoriesByTab = {
  all: [],
  today: [],
  life: [],
  work: [],
  fun: []
};
let currentSubCategory = 'all';
let googleIcalUrl = localStorage.getItem('allmylifeishere_google_ical_url') || '';
let googleEvents = [];
let activeGoogleEvent = null;

// History Stack for Ctrl+Z (Undo) & Ctrl+Shift+Z (Redo)
let historyStack = [];
let redoStack = [];
const MAX_HISTORY_STEPS = 50;

function parseICSContent(icsText) {
  const parsedEvents = [];
  const veventBlocks = icsText.split('BEGIN:VEVENT');

  veventBlocks.forEach((block, idx) => {
    if (idx === 0) return;

    let summary = 'אירוע גוגל קלנדר';
    let dtstart = '';
    let dtend = '';
    let recurrence = 'none';

    const summaryMatch = block.match(/SUMMARY:(.*)/);
    if (summaryMatch) summary = summaryMatch[1].replace(/\\,/g, ',').replace(/\\;/g, ';').trim();

    const dtstartMatch = block.match(/DTSTART(?:;[^:]+)?:([0-9T]+)/);
    if (dtstartMatch) dtstart = dtstartMatch[1].trim();

    const dtendMatch = block.match(/DTEND(?:;[^:]+)?:([0-9T]+)/);
    if (dtendMatch) dtend = dtendMatch[1].trim();

    const rruleMatch = block.match(/RRULE:(.*)/);
    if (rruleMatch) {
      if (rruleMatch[1].includes('FREQ=WEEKLY')) recurrence = 'weekly';
      else if (rruleMatch[1].includes('FREQ=MONTHLY')) recurrence = 'monthly';
    }

    if (dtstart) {
      let dateStr = '';
      let startTimeStr = '09:00';
      let endTimeStr = '10:00';

      if (dtstart.length >= 8) {
        const y = dtstart.substring(0, 4);
        const m = dtstart.substring(4, 6);
        const d = dtstart.substring(6, 8);
        dateStr = `${y}-${m}-${d}`;
      }

      if (dtstart.includes('T') && dtstart.length >= 13) {
        const tIdx = dtstart.indexOf('T');
        const hh = dtstart.substring(tIdx + 1, tIdx + 3);
        const mm = dtstart.substring(tIdx + 3, tIdx + 5);
        startTimeStr = `${hh}:${mm}`;
      }

      if (dtend && dtend.includes('T') && dtend.length >= 13) {
        const tIdx = dtend.indexOf('T');
        const hh = dtend.substring(tIdx + 1, tIdx + 3);
        const mm = dtend.substring(tIdx + 3, tIdx + 5);
        endTimeStr = `${hh}:${mm}`;
      }

      if (dateStr) {
        parsedEvents.push({
          id: 'g_event_' + idx + '_' + dateStr,
          title: summary,
          date: dateStr,
          endDate: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          category: 'google',
          recurrence: recurrence,
          isReadOnly: true,
          source: 'google_calendar'
        });
      }
    }
  });

  return parsedEvents;
}

function fetchGoogleICSFeed(url) {
  if (!url) return;

  // Automatically clean webcal:// protocol to https://
  url = url.trim().replace(/^webcal:\/\//i, 'https://');

  const statusEl = document.getElementById('googleIcalStatus');
  const clearBtn = document.getElementById('clearGoogleIcalBtn');
  const inputEl = document.getElementById('googleIcalUrlInput');

  if (inputEl) inputEl.value = url;
  if (statusEl) {
    statusEl.textContent = '⏳ קורא אירועים מיומן גוגל...';
    statusEl.classList.remove('hidden');
  }

  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

  fetch(proxyUrl)
    .then(res => {
      if (!res.ok) throw new Error('CORS fetch error');
      return res.text();
    })
    .then(text => {
      const parsed = parseICSContent(text);
      if (parsed.length > 0) {
        googleEvents = parsed;
        googleIcalUrl = url;
        localStorage.setItem('allmylifeishere_google_ical_url', url);
        if (statusEl) {
          statusEl.textContent = `✅ יומן גוגל מסונכרן! נטענו ${parsed.length} אירועים מ-Google Calendar`;
          statusEl.classList.remove('hidden');
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
        renderHeaderDays();
        renderGridRows();
        showToast(`📅 נטענו ${parsed.length} אירועים מ-Google Calendar!`);
      } else {
        if (statusEl) {
          statusEl.textContent = '⚠️ לא נמצאו אירועים בקישור iCal זה. תוכל גם להעלות קובץ .ics ישירות!';
          statusEl.classList.remove('hidden');
        }
      }
    })
    .catch(err => {
      console.warn('Google iCal primary proxy notice, trying secondary proxy:', err);
      const fallbackUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      fetch(fallbackUrl)
        .then(r => r.text())
        .then(text => {
          const parsed = parseICSContent(text);
          if (parsed.length > 0) {
            googleEvents = parsed;
            googleIcalUrl = url;
            localStorage.setItem('allmylifeishere_google_ical_url', url);
            if (statusEl) {
              statusEl.textContent = `✅ יומן גוגל מסונכרן! נטענו ${parsed.length} אירועים מ-Google Calendar`;
              statusEl.classList.remove('hidden');
            }
            if (clearBtn) clearBtn.classList.remove('hidden');
            renderHeaderDays();
            renderGridRows();
            showToast(`📅 נטענו ${parsed.length} אירועים מ-Google Calendar!`);
          }
        })
        .catch(e => {
          if (statusEl) {
            statusEl.textContent = '❌ לא ניתן לקרוא את קישור ה-iCal באינטרנט. נסה להעלות את קובץ ה-ics. ישירות למעלה!';
            statusEl.classList.remove('hidden');
          }
        });
    });
}

function handleGoogleIcsFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = parseICSContent(e.target.result);
      if (parsed.length > 0) {
        googleEvents = parsed;
        const statusEl = document.getElementById('googleIcalStatus');
        const clearBtn = document.getElementById('clearGoogleIcalBtn');
        if (statusEl) {
          statusEl.textContent = `✅ קובץ יומן גוגל נטען! נטענו ${parsed.length} אירועים מ-Google Calendar`;
          statusEl.classList.remove('hidden');
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
        renderHeaderDays();
        renderGridRows();
        showToast(`📅 נטענו ${parsed.length} אירועים מקובץ Google Calendar!`);
      } else {
        alert('⚠️ לא נמצאו אירועים תקינים בקובץ ה-ICS שהועלה.');
      }
    } catch (err) {
      alert('❌ שגיאה בקריאת קובץ ה-ICS.');
    }
  };
  reader.readAsText(file);
}

function saveStateToHistory() {
  const snapshot = JSON.stringify({
    tables: tables,
    events: events,
    deletedTables: deletedTables
  });
  if (historyStack.length > 0 && historyStack[historyStack.length - 1] === snapshot) {
    return;
  }
  historyStack.push(snapshot);
  if (historyStack.length > MAX_HISTORY_STEPS) {
    historyStack.shift();
  }
  // Clear redo stack on new action
  redoStack = [];

  // ALWAYS Save Backup to LocalStorage
  saveStateToLocalStorage();

  // Trigger Real-Time Cloud Sync
  if (typeof saveDataToCloud === 'function') {
    saveDataToCloud();
  }
}

function getUserStorageKey(email) {
  if (!email) return null;
  const rawKey = email.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  return `allmylifeishere_board_backup_${rawKey}`;
}

function saveStateToLocalStorage() {
  try {
    if (!currentUser || !currentUser.email) return;
    const key = getUserStorageKey(currentUser.email);
    if (key) {
      localStorage.setItem(key, JSON.stringify({ tables, events, deletedTables, permanentlyDeletedIds, subCategoriesByTab }));
    }
    saveVaultSnapshot();
  } catch (e) {
    console.warn('LocalStorage save backup notice:', e);
  }
}

function saveVaultSnapshot() {
  if (!currentUser || !currentUser.email || (tables.length === 0 && events.length === 0)) return;
  try {
    const vaultStr = localStorage.getItem('allmylifeishere_history_vault');
    let vault = vaultStr ? JSON.parse(vaultStr) : [];
    const newSnapshot = {
      timestamp: new Date().toISOString(),
      tables: JSON.parse(JSON.stringify(tables)),
      events: JSON.parse(JSON.stringify(events)),
      deletedTables: JSON.parse(JSON.stringify(deletedTables)),
      permanentlyDeletedIds: JSON.parse(JSON.stringify(permanentlyDeletedIds)),
      subCategoriesByTab: JSON.parse(JSON.stringify(subCategoriesByTab))
    };
    if (vault.length > 0 && JSON.stringify(vault[0].tables) === JSON.stringify(newSnapshot.tables)) return;
    vault.unshift(newSnapshot);
    if (vault.length > 10) vault = vault.slice(0, 10);
    localStorage.setItem('allmylifeishere_history_vault', JSON.stringify(vault));
  } catch (e) {
    console.warn('Vault snapshot notice:', e);
  }
}

function loadBackupFromLocalStorage() {
  try {
    tables = [];
    events = [];
    deletedTables = [];

    if (!currentUser || !currentUser.email) return;

    const key = getUserStorageKey(currentUser.email);
    let backupStr = key ? localStorage.getItem(key) : null;
    const userEmailClean = currentUser.email.toLowerCase();
    if (!backupStr && (userEmailClean.includes('ziv') || userEmailClean.includes('admin') || userEmailClean.includes('user'))) {
      backupStr = localStorage.getItem('allmylifeishere_board_backup');
      if (backupStr && key) {
        localStorage.setItem(key, backupStr);
      }
    }

    if (backupStr) {
      const backup = JSON.parse(backupStr);
      if (backup) {
        if (backup.tables && Array.isArray(backup.tables)) {
          tables = backup.tables;
        }
        if (backup.events && Array.isArray(backup.events)) {
          events = backup.events;
        }
        if (backup.deletedTables && Array.isArray(backup.deletedTables)) {
          deletedTables = backup.deletedTables;
        }
        if (backup.permanentlyDeletedIds && Array.isArray(backup.permanentlyDeletedIds)) {
          backup.permanentlyDeletedIds.forEach(id => {
            if (!permanentlyDeletedIds.includes(id)) permanentlyDeletedIds.push(id);
          });
        }
        if (backup.subCategoriesByTab && typeof backup.subCategoriesByTab === 'object') {
          subCategoriesByTab = backup.subCategoriesByTab;
        }
      }
    }
  } catch (e) {
    console.warn('LocalStorage backup load notice:', e);
  }
}

function undoLastAction() {
  if (historyStack.length === 0) return;

  const currentStateSnapshot = JSON.stringify({
    tables: tables,
    events: events,
    deletedTables: deletedTables
  });
  redoStack.push(currentStateSnapshot);

  const previousStateJSON = historyStack.pop();
  try {
    const state = JSON.parse(previousStateJSON);
    tables = state.tables || [];
    events = state.events || [];
    deletedTables = state.deletedTables || [];

    renderGridRows();
    renderFilteredTables();
    showToast('↩️ הפעולה בוטלה (Ctrl+Z)');
  } catch (e) {
    console.error('Failed to undo action:', e);
  }
}

function redoLastAction() {
  if (redoStack.length === 0) return;

  const currentStateSnapshot = JSON.stringify({
    tables: tables,
    events: events,
    deletedTables: deletedTables
  });
  historyStack.push(currentStateSnapshot);

  const nextStateJSON = redoStack.pop();
  try {
    const state = JSON.parse(nextStateJSON);
    tables = state.tables || [];
    events = state.events || [];
    deletedTables = state.deletedTables || [];

    renderGridRows();
    renderFilteredTables();
    showToast('↪️ הפעולה בוצעה מחדש (Ctrl+Shift+Z)');
  } catch (e) {
    console.error('Failed to redo action:', e);
  }
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('undoToast');
  if (!toast) return;
  const isRedo = message.includes('בוצעה מחדש');
  toast.innerHTML = `<span>${isRedo ? '↪️' : '↩️'}</span> <span>${message}</span>`;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// 6. **גרירה חיונית בלייב ועמידה סטטית (Real-Time Live Floating Cutout Dragging)**:
//    - **גרירה רציפה בלייב בכל גוף הצורה (Continuous Live Drag)**:
//      - ברגע השלמת גזירת הלאסו, האזור הנבחר הופך מידית לשכבה צפה תלת-ממדית (`<canvas class="floating-cutout-canvas">`) עם צל רך.
//      - בלחיצה וגרירה, **כל גוף הצורה זז ברציפות ובלייב ביחד עם תנועת הסמן של העכבר/האצבע!**
//    - **מיקום סטטי מושלם בעת שחרור העכבר**:
//      - הצורה עומדת באופן סטטי ומדויק במקום בו שחררת אותה ומוטבעת על הלוח באופן נקי!
//    - **אפס נתוני דמו**: המערכת נקייה לחלוטין ומוכנה לעבודה.

let activeCanvasStudio = null;

// Global Keyboard Listener for Ctrl+Z / Cmd+Z (Undo), Ctrl+Shift+Z (Redo), and Canvas Ctrl+C, Ctrl+X, Ctrl+V
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  if (!isCtrlOrCmd) return;

  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  const isTextInput = activeTag === 'input' && document.activeElement.type === 'text';

  // Redo: Ctrl+Shift+Z OR Cmd+Shift+Z OR Ctrl+Y
  if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault();
    if (isTextInput) document.activeElement.blur();
    redoLastAction();
  }
  // Undo: Ctrl+Z OR Cmd+Z
  else if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (isTextInput) document.activeElement.blur();
    undoLastAction();
  }
  // Copy: Ctrl+C OR Cmd+C
  else if (key === 'c' && activeCanvasStudio && activeCanvasStudio.hasSelection) {
    if (!isTextInput || document.activeElement.value === '') {
      e.preventDefault();
      activeCanvasStudio.copy();
    }
  }
  // Cut: Ctrl+X OR Cmd+X
  else if (key === 'x' && activeCanvasStudio && activeCanvasStudio.hasSelection) {
    if (!isTextInput || document.activeElement.value === '') {
      e.preventDefault();
      activeCanvasStudio.cut();
    }
  }
  // Paste: Ctrl+V OR Cmd+V
  else if (key === 'v' && activeCanvasStudio && activeCanvasStudio.hasClipboard) {
    if (!isTextInput || document.activeElement.value === '') {
      e.preventDefault();
      activeCanvasStudio.paste();
    }
  }
});

// Standalone Backspace / Delete key listener for removing active canvas selection
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'backspace' || key === 'delete') {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const activeType = document.activeElement ? document.activeElement.type : '';
    const isTextInput = (activeTag === 'input' && activeType === 'text') || activeTag === 'textarea';
    
    if (!isTextInput && activeCanvasStudio && activeCanvasStudio.hasSelection) {
      e.preventDefault();
      activeCanvasStudio.deleteSelection();
    }
  }
});

// DOM Elements
const gridHeader = document.getElementById('gridHeader');
const gridBody = document.getElementById('gridBody');
const currentWeekRange = document.getElementById('currentWeekRange');
const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const todayBtn = document.getElementById('todayBtn');
const createEventBtn = document.getElementById('createEventBtn');
const googleSyncBtn = document.getElementById('googleSyncBtn');

// Bottom Tabs & List DOM Elements
const filteredListTitle = document.getElementById('filteredListTitle');
const filteredListCount = document.getElementById('filteredListCount');
const filteredTablesList = document.getElementById('filteredTablesList');
const tabButtons = document.querySelectorAll('.tab-btn');
const createTableBtn = document.getElementById('createTableBtn');
const createEventBottomBtn = document.getElementById('createEventBottomBtn');

// Table Modal Elements
const tableModal = document.getElementById('tableModal');
const tableModalTitle = document.querySelector('#tableModal h2');
const tableForm = document.getElementById('tableForm');
const closeTableModalBtn = document.getElementById('closeTableModalBtn');
const cancelTableBtn = document.getElementById('cancelTableBtn');
const tableTitleInput = document.getElementById('tableTitle');
const tableResetFrequencyInput = document.getElementById('tableResetFrequency');
const gridDimensionsGroup = document.getElementById('gridDimensionsGroup');
const gridRowsInput = document.getElementById('gridRowsInput');
const gridColsInput = document.getElementById('gridColsInput');
const tableTodayInput = document.getElementById('tableTodayInput');
const tableCompactInput = document.getElementById('tableCompactInput');
const tableTypeRadios = document.querySelectorAll('input[name="tableType"]');

// Modal Elements
const eventModal = document.getElementById('eventModal');
const modalTitle = document.getElementById('modalTitle');
const eventForm = document.getElementById('eventForm');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEventBtn = document.getElementById('cancelEventBtn');
const deleteEventBtn = document.getElementById('deleteEventBtn');
const duplicateEventBtn = document.getElementById('duplicateEventBtn');
const syncSingleGoogleBtn = document.getElementById('syncSingleGoogleBtn');

const eventTitleInput = document.getElementById('eventTitle');
const eventDateInput = document.getElementById('eventDate');
const eventEndDateInput = document.getElementById('eventEndDate');
const eventStartTimeInput = document.getElementById('eventStartTime');
const eventEndTimeInput = document.getElementById('eventEndTime');
const eventRecurrenceInput = document.getElementById('eventRecurrence');

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const GRID_START_HOUR = 0; // 00:00 (24 Hours)
const GRID_END_HOUR = 23;  // 23:00
const SLOT_HEIGHT = 54;    // 54px per hour slot

const isMobileDevice = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let isScheduleMinimized = localStorage.getItem('allmylifeishere_schedule_minimized') !== null
  ? (localStorage.getItem('allmylifeishere_schedule_minimized') === 'true')
  : isMobileDevice;

function updateScheduleToggleUI() {
  const scheduleContainer = document.getElementById('scheduleContainer');
  const scheduleToggleBtn = document.getElementById('scheduleToggleBtn');
  const scheduleToggleText = document.getElementById('scheduleToggleText');
  const scheduleToggleIcon = document.getElementById('scheduleToggleIcon');

  if (!scheduleContainer || !scheduleToggleBtn) return;

  if (isScheduleMinimized) {
    scheduleContainer.classList.add('minimized-schedule');
    if (scheduleToggleText) scheduleToggleText.textContent = 'הרחב מערכת שעות';
    if (scheduleToggleIcon) scheduleToggleIcon.textContent = '▼';
  } else {
    scheduleContainer.classList.remove('minimized-schedule');
    if (scheduleToggleText) scheduleToggleText.textContent = 'מזער מערכת שעות';
    if (scheduleToggleIcon) scheduleToggleIcon.textContent = '▲';
  }
}

function initScheduleToggle() {
  const scheduleToggleBtn = document.getElementById('scheduleToggleBtn');
  if (scheduleToggleBtn) {
    const handleToggle = (e) => {
      if (e) e.preventDefault();
      isScheduleMinimized = !isScheduleMinimized;
      localStorage.setItem('allmylifeishere_schedule_minimized', isScheduleMinimized ? 'true' : 'false');
      updateScheduleToggleUI();
    };

    scheduleToggleBtn.addEventListener('click', handleToggle);
  }
  updateScheduleToggleUI();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const savedUserStr = localStorage.getItem('allmylifeishere_user') || getCookie('allmylifeishere_user');
  if (savedUserStr) {
    try {
      currentUser = JSON.parse(savedUserStr);
    } catch (e) {
      currentUser = null;
    }
  }

  if (currentUser && currentUser.email) {
    const rawKey = currentUser.email.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    currentSyncKey = 'USER-' + rawKey;
    loadBackupFromLocalStorage();
  } else {
    currentUser = null;
    currentSyncKey = null;
    tables = [];
    events = [];
    deletedTables = [];
  }

  populateDateDropdowns();
  populateTimeDropdowns();
  renderHeaderDays();
  renderGridRows();
  updateWeekRangeLabel();
  scrollToSixAM();
  renderFilteredTables();
  initScheduleToggle();

  // Sub-Category Modal Listeners
  const subCategoryForm = document.getElementById('subCategoryForm');
  const closeSubCatModalBtn = document.getElementById('closeSubCatModalBtn');
  const cancelSubCatBtn = document.getElementById('cancelSubCatBtn');
  const subCategoryModal = document.getElementById('subCategoryModal');

  if (subCategoryForm) subCategoryForm.addEventListener('submit', handleSubCategoryFormSubmit);
  if (closeSubCatModalBtn) closeSubCatModalBtn.addEventListener('click', closeSubCategoryModal);
  if (cancelSubCatBtn) cancelSubCatBtn.addEventListener('click', closeSubCategoryModal);
  if (subCategoryModal) {
    subCategoryModal.addEventListener('click', (e) => {
      if (e.target === subCategoryModal) closeSubCategoryModal();
    });
  }

  // Global click delegation for sub-category bar & pills
  document.addEventListener('click', (e) => {
    // Delete sub-category x click
    const deleteX = e.target.closest('[data-delete-subcat]');
    if (deleteX) {
      e.preventDefault();
      e.stopPropagation();
      const subCatName = deleteX.dataset.deleteSubcat;
      if (subCatName && confirm(`האם למחוק את תת-הקטגוריה "${subCatName}"?`)) {
        saveStateToHistory();
        if (!subCategoriesByTab[currentTab]) subCategoriesByTab[currentTab] = [];
        subCategoriesByTab[currentTab] = subCategoriesByTab[currentTab].filter(sc => sc !== subCatName);
        if (currentSubCategory === subCatName) currentSubCategory = 'all';
        saveStateToLocalStorage();
        if (typeof saveDataToCloud === 'function') saveDataToCloud();
        renderFilteredTables();
      }
      return;
    }

    // Click sub-category pill
    const pillBtn = e.target.closest('.sub-cat-pill');
    if (pillBtn && !e.target.classList.contains('delete-subcat-x')) {
      e.preventDefault();
      const subCat = pillBtn.dataset.subcat;
      if (subCat) {
        currentSubCategory = subCat;
        renderFilteredTables();
      }
      return;
    }

    // Click + תת-קטגוריה button
    const addSubCatBtn = e.target.closest('#addSubCatHeaderBtn') || e.target.closest('.add-subcat-btn');
    if (addSubCatBtn) {
      e.preventDefault();
      openSubCategoryModal();
    }
  });

  // Navigation Event Listeners
  if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => changeWeek(-7));
  if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => changeWeek(7));
  if (todayBtn) todayBtn.addEventListener('click', () => {
    currentWeekStart = getSunday(new Date());
    updateView();
    scrollToSixAM();
  });

  // Table Type Selection toggle dimensions
  tableTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateGridDimensionsVisibility);
  });

  // Table Modal Listeners
  if (createTableBtn) createTableBtn.addEventListener('click', () => openTableModal());
  if (createEventBottomBtn) createEventBottomBtn.addEventListener('click', () => openModal());
  if (closeTableModalBtn) closeTableModalBtn.addEventListener('click', closeTableModal);
  if (cancelTableBtn) cancelTableBtn.addEventListener('click', closeTableModal);
  if (tableModal) {
    tableModal.addEventListener('click', (e) => {
      if (e.target === tableModal) closeTableModal();
    });
  }
  if (tableForm) tableForm.addEventListener('submit', handleTableFormSubmit);

  // Single-Select Unified 5-Tabs Listener (Live DOM Query)
  const liveTabButtons = document.querySelectorAll('.tab-btn');
  liveTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab) return;
      currentTab = tab;
      currentSubCategory = 'all';

      liveTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      renderFilteredTables();
    });
  });

  // Modal Event Listeners
  createEventBtn.addEventListener('click', () => openModal());
  googleSyncBtn.addEventListener('click', handleGlobalGoogleSync);
  syncSingleGoogleBtn.addEventListener('click', handleSingleEventGoogleSync);
  closeModalBtn.addEventListener('click', closeModal);
  cancelEventBtn.addEventListener('click', closeModal);
  deleteEventBtn.addEventListener('click', handleDeleteEvent);
  duplicateEventBtn.addEventListener('click', handleDuplicateEvent);
  eventModal.addEventListener('click', (e) => {
    if (e.target === eventModal) closeModal();
  });

  // Always sync End Date default to match Start Date automatically
  eventDateInput.addEventListener('change', () => {
    eventEndDateInput.value = eventDateInput.value;
  });

  // Auto adjust end time when start time changes
  eventStartTimeInput.addEventListener('change', () => {
    const startMin = parseTimeToMinutes(eventStartTimeInput.value);
    const endMin = parseTimeToMinutes(eventEndTimeInput.value);
    if (endMin <= startMin && eventDateInput.value === eventEndDateInput.value) {
      const newEndMin = startMin + 60; // default 1 hour duration
      const h = Math.min(Math.floor(newEndMin / 60), 23);
      const m = newEndMin % 60;
      eventEndTimeInput.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  });

  eventForm.addEventListener('submit', handleFormSubmit);
});

// Format date object to label format "13/8/26 ה'"
function formatDateOptionLabel(dateObj) {
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const shortYear = String(dateObj.getFullYear()).slice(-2);
  const dayLetter = DAY_LETTERS[dateObj.getDay()];
  return `${day}/${month}/${shortYear} ${dayLetter}'`;
}

// Populate Date Select Dropdowns (60 days back to 365 days forward)
function populateDateDropdowns() {
  eventDateInput.innerHTML = '';
  eventEndDateInput.innerHTML = '';

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 60);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 365);

  const curr = new Date(startDate);
  while (curr <= endDate) {
    const isoStr = formatDateISO(curr);
    const labelStr = formatDateOptionLabel(curr);

    const opt1 = document.createElement('option');
    opt1.value = isoStr;
    opt1.textContent = labelStr;
    eventDateInput.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = isoStr;
    opt2.textContent = labelStr;
    eventEndDateInput.appendChild(opt2);

    curr.setDate(curr.getDate() + 1);
  }
}

// Helper: Calculate effective bounds for multi-day and recurring events on a specific target date
function getEventBoundsForDate(ev, targetDateISO) {
  const startDateStr = ev.date;
  const endDateStr = ev.endDate || ev.date;

  const startDate = new Date(startDateStr + 'T00:00:00');
  const endDate = new Date(endDateStr + 'T00:00:00');
  const targetDate = new Date(targetDateISO + 'T00:00:00');

  if (targetDate < startDate) return null;

  const durationDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
  const diffDaysFromStart = Math.round((targetDate - startDate) / (1000 * 60 * 60 * 24));
  const recurrence = ev.recurrence || 'none';

  let isMatch = false;
  let dayOffsetInCycle = 0;

  if (recurrence === 'none') {
    if (targetDate >= startDate && targetDate <= endDate) {
      isMatch = true;
      dayOffsetInCycle = diffDaysFromStart;
    }
  } else if (recurrence === 'weekly') {
    const cycleDay = diffDaysFromStart % 7;
    if (cycleDay <= durationDays) {
      isMatch = true;
      dayOffsetInCycle = cycleDay;
    }
  } else if (recurrence === 'biweekly') {
    const cycleDay = diffDaysFromStart % 14;
    if (cycleDay <= durationDays) {
      isMatch = true;
      dayOffsetInCycle = cycleDay;
    }
  } else if (recurrence === 'monthly') {
    // Check if target date falls within the multi-day span relative to same day-of-month
    const targetDayOfMonth = targetDate.getDate();
    const startDayOfMonth = startDate.getDate();
    const dayDiff = targetDayOfMonth - startDayOfMonth;
    if (dayDiff >= 0 && dayDiff <= durationDays) {
      isMatch = true;
      dayOffsetInCycle = dayDiff;
    }
  }

  if (!isMatch) return null;

  const startTime = (dayOffsetInCycle === 0) ? ev.startTime : '00:00';
  const endTime = (dayOffsetInCycle === durationDays) ? ev.endTime : '23:59';
  const isMultiDay = durationDays > 0;

  return {
    startTime,
    endTime,
    isMultiDay,
    dayIndex: dayOffsetInCycle + 1,
    totalDays: durationDays + 1
  };
}

// Scroll grid body directly to 06:00 AM (like Google Calendar)
function scrollToSixAM() {
  requestAnimationFrame(() => {
    gridBody.scrollTop = 6 * SLOT_HEIGHT; // 06:00 AM
  });
}

// Helper: Check if recurring event falls on dateISO
function doesEventOccurOnDate(ev, targetDateISO) {
  const startDate = new Date(ev.date + 'T00:00:00');
  const targetDate = new Date(targetDateISO + 'T00:00:00');

  if (targetDate < startDate) return false;

  const recurrence = ev.recurrence || 'none';
  const diffDays = Math.round((targetDate - startDate) / (1000 * 60 * 60 * 24));

  switch (recurrence) {
    case 'weekly':
      return diffDays % 7 === 0;
    case 'biweekly':
      return diffDays % 14 === 0;
    case 'monthly':
      return targetDate.getDate() === startDate.getDate();
    case 'none':
    default:
      return startDate.getTime() === targetDate.getTime();
  }
}

// Populate Start Time and End Time Dropdowns in 15-minute intervals
function populateTimeDropdowns() {
  eventStartTimeInput.innerHTML = '';
  eventEndTimeInput.innerHTML = '';

  for (let hour = GRID_START_HOUR; hour <= GRID_END_HOUR; hour++) {
    for (let min of [0, 15, 30, 45]) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      const optStart = document.createElement('option');
      optStart.value = timeStr;
      optStart.textContent = timeStr;
      eventStartTimeInput.appendChild(optStart);

      const optEnd = document.createElement('option');
      optEnd.value = timeStr;
      optEnd.textContent = timeStr;
      eventEndTimeInput.appendChild(optEnd);
    }
  }

  // Add 24:00/23:59 as final end time option
  const finalEndOpt = document.createElement('option');
  finalEndOpt.value = '23:59';
  finalEndOpt.textContent = '23:59';
  eventEndTimeInput.appendChild(finalEndOpt);
}

// Helper: Convert "HH:MM" string to minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Helper: Get Sunday (start of week in Israel)
function getSunday(d) {
  const date = new Date(d);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day;
  date.setDate(diff);
  return date;
}

// Format YYYY-MM-DD
function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Navigation Logic
function changeWeek(days) {
  const newDate = new Date(currentWeekStart);
  newDate.setDate(newDate.getDate() + days);
  currentWeekStart = newDate;
  updateView();
}

function updateView() {
  renderHeaderDays();
  renderGridRows();
  updateWeekRangeLabel();
  renderFilteredTables();
}

function updateWeekRangeLabel() {
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startStr = `${currentWeekStart.getDate()} ב${getMonthName(currentWeekStart.getMonth())}`;
  const endStr = `${weekEnd.getDate()} ב${getMonthName(weekEnd.getMonth())} ${weekEnd.getFullYear()}`;
  
  currentWeekRange.textContent = `${startStr} - ${endStr}`;
}

function getMonthName(monthIndex) {
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return months[monthIndex];
}

// Render Days in Header
function renderHeaderDays() {
  const headers = gridHeader.querySelectorAll('.day-header-cell');
  headers.forEach(h => h.remove());

  const todayStr = formatDateISO(new Date());

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const dateISO = formatDateISO(dayDate);
    const isToday = (dateISO === todayStr);

    const dayCell = document.createElement('div');
    dayCell.className = `day-header-cell ${isToday ? 'today' : ''}`;
    dayCell.innerHTML = `
      <span class="day-name">יום ${DAY_NAMES[i]}</span>
      <span class="day-date">${dayDate.getDate()}</span>
    `;
    gridHeader.appendChild(dayCell);
  }
}

// Render Grid Time Labels & Day Columns with Unified Single Events
function renderGridRows() {
  gridBody.innerHTML = '';
  const todayStr = formatDateISO(new Date());

  // 1. Time Column
  const timeColumn = document.createElement('div');
  timeColumn.className = 'time-column';
  for (let hour = GRID_START_HOUR; hour <= GRID_END_HOUR; hour++) {
    const timeLabel = document.createElement('div');
    timeLabel.className = 'time-label-slot';
    timeLabel.textContent = `${String(hour).padStart(2, '0')}:00`;
    timeColumn.appendChild(timeLabel);
  }
  gridBody.appendChild(timeColumn);

  // 2. 7 Day Columns
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + i);
    const dateISO = formatDateISO(dayDate);
    const isToday = (dateISO === todayStr);

    const dayColumn = document.createElement('div');
    dayColumn.className = `day-column ${isToday ? 'today-col' : ''}`;
    dayColumn.dataset.date = dateISO;

    // Slots inside Day Column (for clicking & hover lines)
    for (let hour = GRID_START_HOUR; hour <= GRID_END_HOUR; hour++) {
      const slotCell = document.createElement('div');
      slotCell.className = 'time-slot-cell';
      const formattedHour = `${String(hour).padStart(2, '0')}:00`;
      slotCell.dataset.hour = formattedHour;

      slotCell.addEventListener('click', (e) => {
        if (e.target.closest('.event-card')) return;
        const nextHour = String(hour + 1).padStart(2, '0') + ':00';
        openModal({
          date: dateISO,
          startTime: formattedHour,
          endTime: nextHour
        });
      });

      dayColumn.appendChild(slotCell);
    }

    // Calculate overlapping & nesting for events on this day
    const dayEventsList = [];
    const combinedEvents = [...events, ...googleEvents];
    combinedEvents.forEach(ev => {
      const bounds = getEventBoundsForDate(ev, dateISO);
      if (!bounds) return;

      const startMin = parseTimeToMinutes(bounds.startTime);
      const endMin = (bounds.endTime === '23:59') ? 1440 : parseTimeToMinutes(bounds.endTime);
      dayEventsList.push({ ev, bounds, startMin, endMin });
    });

    // Sort by start time ascending, then duration descending
    dayEventsList.sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return (b.endMin - b.startMin) - (a.endMin - a.startMin);
    });

    // Determine nesting level (indentation)
    const activeColumns = [];
    dayEventsList.forEach(item => {
      let colIndex = 0;
      while (colIndex < activeColumns.length && activeColumns[colIndex] > item.startMin) {
        colIndex++;
      }
      activeColumns[colIndex] = item.endMin;
      item.indent = colIndex;
    });

    // Render Event Cards
    dayEventsList.forEach(item => {
      const { ev, bounds, startMin, endMin, indent } = item;
      const gridStartMin = GRID_START_HOUR * 60;

      // Position math
      const topPx = ((startMin - gridStartMin) / 60) * SLOT_HEIGHT;
      const durationMin = Math.max(endMin - startMin, 15); // minimum 15 mins
      const heightPx = (durationMin / 60) * SLOT_HEIGHT;

      const isRecurring = ev.recurrence && ev.recurrence !== 'none';
      const recurrenceIcon = isRecurring ? '<span class="recurrence-badge" title="אירוע מחזורי">🔄</span>' : '';
      const multiDayBadge = bounds.isMultiDay ? `<span class="multiday-badge" title="יום ${bounds.dayIndex} מתוך ${bounds.totalDays}">🗓️</span>` : '';
      const isGoogle = ev.category === 'google' || ev.isReadOnly;
      const googleBadge = isGoogle ? '<span class="cat-google-badge" title="אירוע מ-Google Calendar (לקריאה בלבד)">🔒 Google</span>' : '';
      const categoryClass = `cat-${ev.category || 'regular'}`;
      const overlapClass = indent > 0 ? 'overlapping-card' : '';

      const indentPercent = Math.min(indent * 22, 60);

      const evCard = document.createElement('div');
      evCard.className = `event-card ${categoryClass} ${overlapClass}`;
      evCard.style.top = `${topPx}px`;
      evCard.style.left = `calc(4px + ${indentPercent}%)`;
      evCard.style.right = '4px';
      evCard.style.zIndex = `${5 + indent * 2}`;
      evCard.style.height = `${Math.max(heightPx - 2, 22)}px`;

      evCard.innerHTML = `
        <div class="event-card-title">${ev.title} ${googleBadge} ${recurrenceIcon} ${multiDayBadge}</div>
        <div class="event-card-time">${bounds.startTime} - ${bounds.endTime}</div>
      `;

      // Click event card to edit
      evCard.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(ev);
      });

      dayColumn.appendChild(evCard);
    });

    gridBody.appendChild(dayColumn);
  }
}

// Modal Handlers
function ensureDateOptionExists(selectEl, isoStr) {
  if (!isoStr) return;
  const exists = Array.from(selectEl.options).some(opt => opt.value === isoStr);
  if (!exists) {
    const d = new Date(isoStr + 'T00:00:00');
    const opt = document.createElement('option');
    opt.value = isoStr;
    opt.textContent = formatDateOptionLabel(d);
    selectEl.appendChild(opt);
  }
}

function openModal(defaultValues = {}) {
  const today = new Date();
  const defaultDate = defaultValues.date || formatDateISO(today);
  const defaultEndDate = defaultValues.endDate || defaultDate;
  const defaultStart = defaultValues.startTime || '09:00';
  const defaultEnd = defaultValues.endTime || '10:00';

  const dupGoogleBtn = document.getElementById('duplicateGoogleEventBtn');

  // Reset read-only & disabled states
  eventTitleInput.readOnly = false;
  eventDateInput.disabled = false;
  eventEndDateInput.disabled = false;
  eventStartTimeInput.disabled = false;
  eventEndTimeInput.disabled = false;
  eventRecurrenceInput.disabled = false;
  if (dupGoogleBtn) dupGoogleBtn.classList.add('hidden');

  if (defaultValues && (defaultValues.category === 'google' || defaultValues.isReadOnly)) {
    activeGoogleEvent = defaultValues;
    editingEventId = null;
    modalTitle.textContent = '📅 אירוע מ-Google Calendar (לקריאה בלבד)';
    deleteEventBtn.classList.add('hidden');
    duplicateEventBtn.classList.add('hidden');
    if (dupGoogleBtn) dupGoogleBtn.classList.remove('hidden');

    ensureDateOptionExists(eventDateInput, defaultDate);
    ensureDateOptionExists(eventEndDateInput, defaultEndDate);

    eventTitleInput.value = defaultValues.title || '';
    eventTitleInput.readOnly = true;
    eventDateInput.value = defaultDate;
    eventDateInput.disabled = true;
    eventEndDateInput.value = defaultEndDate;
    eventEndDateInput.disabled = true;
    eventStartTimeInput.value = defaultStart;
    eventStartTimeInput.disabled = true;
    eventEndTimeInput.value = defaultEnd;
    eventEndTimeInput.disabled = true;
    eventRecurrenceInput.value = defaultValues.recurrence || 'none';
    eventRecurrenceInput.disabled = true;

    eventModal.classList.remove('hidden');
    eventModal.setAttribute('aria-hidden', 'false');
    return;
  }

  if (defaultValues && defaultValues.id) {
    editingEventId = defaultValues.id;
    modalTitle.textContent = 'עריכת אירוע';
    deleteEventBtn.classList.remove('hidden');
    duplicateEventBtn.classList.remove('hidden');
  } else {
    editingEventId = null;
    modalTitle.textContent = 'יצירת אירוע חדש';
    deleteEventBtn.classList.add('hidden');
    duplicateEventBtn.classList.add('hidden');
  }

  ensureDateOptionExists(eventDateInput, defaultDate);
  ensureDateOptionExists(eventEndDateInput, defaultEndDate);

  eventTitleInput.value = defaultValues.title || '';
  eventDateInput.value = defaultDate;
  eventEndDateInput.value = defaultEndDate;
  eventStartTimeInput.value = defaultStart;
  eventEndTimeInput.value = defaultEnd;
  eventRecurrenceInput.value = defaultValues.recurrence || 'none';

  const activeCat = ['life', 'work', 'fun'].includes(currentTab) ? currentTab : 'life';
  const cat = defaultValues.category || activeCat;
  const radioToSelect = document.querySelector(`input[name="eventCategory"][value="${cat}"]`);
  if (radioToSelect) radioToSelect.checked = true;

  eventModal.classList.remove('hidden');
  eventModal.setAttribute('aria-hidden', 'false');
  eventTitleInput.focus();
}

function closeModal() {
  eventModal.classList.add('hidden');
  eventModal.setAttribute('aria-hidden', 'true');
  editingEventId = null;
  activeGoogleEvent = null;
  deleteEventBtn.classList.add('hidden');
  duplicateEventBtn.classList.add('hidden');

  const dupGoogleBtn = document.getElementById('duplicateGoogleEventBtn');
  if (dupGoogleBtn) dupGoogleBtn.classList.add('hidden');

  eventTitleInput.readOnly = false;
  eventDateInput.disabled = false;
  eventEndDateInput.disabled = false;
  eventStartTimeInput.disabled = false;
  eventEndTimeInput.disabled = false;
  eventRecurrenceInput.disabled = false;

  eventForm.reset();
}

function duplicateGoogleEventToLocal() {
  if (!activeGoogleEvent) return;

  const targetCategory = prompt('בחר קטגוריה לשכפול האירוע למערכת השעות:\n1 = חיים\n2 = עבודה/פרויקטים\n3 = כיף\n4 = רגיל', '1');
  let selectedCat = 'life';
  if (targetCategory === '2') selectedCat = 'work';
  else if (targetCategory === '3') selectedCat = 'fun';
  else if (targetCategory === '4') selectedCat = 'regular';

  saveStateToHistory();

  const newEv = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: activeGoogleEvent.title,
    date: activeGoogleEvent.date,
    endDate: activeGoogleEvent.endDate || activeGoogleEvent.date,
    startTime: activeGoogleEvent.startTime,
    endTime: activeGoogleEvent.endTime,
    category: selectedCat,
    recurrence: activeGoogleEvent.recurrence || 'none',
    createdAt: new Date().toISOString()
  };

  events.push(newEv);
  saveDataToCloud();
  closeModal();
  updateView();
  showToast(`📋 האירוע "${newEv.title}" שוכפל בהצלחה למערכת!`);
}

function handleFormSubmit(e) {
  e.preventDefault();

  saveStateToHistory();

  const title = eventTitleInput.value.trim();
  const date = eventDateInput.value;
  const endDate = eventEndDateInput.value || date;
  const startTime = eventStartTimeInput.value;
  const endTime = eventEndTimeInput.value;
  const recurrence = eventRecurrenceInput.value;
  const category = document.querySelector('input[name="eventCategory"]:checked')?.value || 'regular';

  if (editingEventId) {
    // Update existing event
    events = events.map(ev => {
      if (ev.id === editingEventId) {
        return { ...ev, title, date, endDate, startTime, endTime, recurrence, category };
      }
      return ev;
    });
  } else {
    // Create new event
    const newEvent = {
      id: Date.now().toString(),
      title,
      date,
      endDate,
      startTime,
      endTime,
      recurrence,
      category
    };
    events.push(newEvent);
  }

  renderGridRows();
  renderFilteredTables();
  closeModal();
}

function handleDeleteEvent() {
  if (!editingEventId) return;

  saveStateToHistory();

  // Confirm delete or delete directly
  events = events.filter(ev => ev.id !== editingEventId);
  renderGridRows();
  renderFilteredTables();
  closeModal();
}

function updateGridDimensionsVisibility() {
  const selectedType = document.querySelector('input[name="tableType"]:checked')?.value;
  if (selectedType === 'customGrid') {
    gridDimensionsGroup.classList.remove('hidden');
  } else {
    gridDimensionsGroup.classList.add('hidden');
  }
}

function renderSubCategoriesBar() {
  const subCatStrip = document.getElementById('subCatStrip');
  if (!subCatStrip) return;

  const activeTables = tables.filter(t => !t.isArchived && !permanentlyDeletedIds.includes(t.id));
  const currentList = subCategoriesByTab[currentTab] || [];
  let html = '';

  const isAllActive = (currentSubCategory === 'all') ? 'active' : '';
  html += `<button type="button" class="sub-cat-pill ${isAllActive}" data-subcat="all">הכל</button>`;

  currentList.forEach(subCat => {
    const isActive = (currentSubCategory === subCat) ? 'active' : '';
    const count = activeTables.filter(t => {
      const matchesTab = (currentTab === 'all') ? true : (t.categories && t.categories.includes(currentTab));
      return matchesTab && t.subCategory === subCat;
    }).length;

    html += `
      <button type="button" class="sub-cat-pill ${isActive}" data-subcat="${escapeHtml(subCat)}">
        <span>${escapeHtml(subCat)}</span>
        <span class="sub-cat-count">${count}</span>
        <span class="delete-subcat-x" data-delete-subcat="${escapeHtml(subCat)}" title="מחיקת תת-קטגוריה">&times;</span>
      </button>`;
  });

  subCatStrip.innerHTML = html;
}

function openSubCategoryModal() {
  const subCategoryModal = document.getElementById('subCategoryModal');
  const subCategoryNameInput = document.getElementById('subCategoryNameInput');
  const subCatModalTitle = document.getElementById('subCatModalTitle');
  if (!subCategoryModal || !subCategoryNameInput) return;

  const catNames = { life: 'חיים', work: 'עבודה/פרויקטים', fun: 'כיף', today: 'היום', all: 'הכל' };
  if (subCatModalTitle) {
    subCatModalTitle.textContent = `יצירת תת-קטגוריה חדשה בלשונית (${catNames[currentTab] || currentTab})`;
  }

  subCategoryNameInput.value = '';
  subCategoryModal.classList.remove('hidden');
  subCategoryNameInput.focus();
}

function closeSubCategoryModal() {
  const subCategoryModal = document.getElementById('subCategoryModal');
  if (subCategoryModal) subCategoryModal.classList.add('hidden');
}

function handleSubCategoryFormSubmit(e) {
  e.preventDefault();
  const subCategoryNameInput = document.getElementById('subCategoryNameInput');
  if (!subCategoryNameInput) return;

  const newName = subCategoryNameInput.value.trim();
  if (!newName) return;

  saveStateToHistory();
  if (!subCategoriesByTab[currentTab]) subCategoriesByTab[currentTab] = [];
  if (!subCategoriesByTab[currentTab].includes(newName)) {
    subCategoriesByTab[currentTab].push(newName);
  }

  currentSubCategory = newName;
  closeSubCategoryModal();
  saveStateToLocalStorage();
  if (typeof saveDataToCloud === 'function') saveDataToCloud();
  renderFilteredTables();
}

function populateTableSubCategorySelect(selectedSubCat = '') {
  const select = document.getElementById('tableSubCategorySelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- ללא תת-קטגוריה --</option>';
  const currentList = subCategoriesByTab[currentTab] || [];

  currentList.forEach(sc => {
    const opt = document.createElement('option');
    opt.value = sc;
    opt.textContent = sc;
    if (sc === selectedSubCat) opt.selected = true;
    select.appendChild(opt);
  });
}

function openTableModal(tableToEdit = null) {
  if (tableToEdit && tableToEdit.id) {
    editingTableId = tableToEdit.id;
    if (tableModalTitle) tableModalTitle.textContent = 'עריכת טבלה';
    tableTitleInput.value = tableToEdit.title;
    tableResetFrequencyInput.value = tableToEdit.resetFrequency || 'permanent';
    tableTodayInput.checked = !!tableToEdit.isToday;
    if (tableCompactInput) tableCompactInput.checked = !!tableToEdit.isCompact;
    populateTableSubCategorySelect(tableToEdit.subCategory || '');

    // Check category checkboxes
    document.querySelectorAll('input[name="tableCategories"]').forEach(cb => {
      cb.checked = tableToEdit.categories && tableToEdit.categories.includes(cb.value);
    });

    // Select type radio
    const typeRadio = document.querySelector(`input[name="tableType"][value="${tableToEdit.type}"]`);
    if (typeRadio) typeRadio.checked = true;
    updateGridDimensionsVisibility();
  } else {
    editingTableId = null;
    if (tableModalTitle) tableModalTitle.textContent = 'יצירת טבלה חדשה';
    tableTitleInput.value = '';
    tableResetFrequencyInput.value = 'permanent';
    tableTodayInput.checked = false;
    if (tableCompactInput) tableCompactInput.checked = false;
    populateTableSubCategorySelect(currentSubCategory !== 'all' ? currentSubCategory : '');
    
    // Auto check category checkbox matching currentTab (default to 'life')
    const targetCat = ['life', 'work', 'fun'].includes(currentTab) ? currentTab : 'life';
    document.querySelectorAll('input[name="tableCategories"]').forEach(cb => {
      cb.checked = (cb.value === targetCat);
    });

    const firstType = document.querySelector('input[name="tableType"][value="checkboxes"]');
    if (firstType) firstType.checked = true;
    updateGridDimensionsVisibility();
    gridRowsInput.value = 3;
    gridColsInput.value = 3;
  }

  tableModal.classList.remove('hidden');
  tableModal.setAttribute('aria-hidden', 'false');
  tableTitleInput.focus();
}

function closeTableModal() {
  tableModal.classList.add('hidden');
  tableModal.setAttribute('aria-hidden', 'true');
  editingTableId = null;
  tableForm.reset();
}

function handleTableFormSubmit(e) {
  e.preventDefault();

  saveStateToHistory();

  let title = tableTitleInput.value.trim();
  if (!title) title = 'טבלה חדשה';

  const type = document.querySelector('input[name="tableType"]:checked')?.value || 'checkboxes';
  const resetFrequency = tableResetFrequencyInput.value || 'permanent';
  let categories = Array.from(document.querySelectorAll('input[name="tableCategories"]:checked')).map(cb => cb.value);
  if (categories.length === 0) categories = ['life'];

  const isToday = tableTodayInput.checked;
  const isCompact = tableCompactInput ? tableCompactInput.checked : false;
  const subCategory = document.getElementById('tableSubCategorySelect')?.value || '';

  let newTableCreatedId = null;

  if (editingTableId) {
    // Update existing table
    tables = tables.map(t => {
      if (t.id === editingTableId) {
        const updated = {
          ...t,
          title,
          resetFrequency,
          categories,
          subCategory,
          isToday,
          isCompact
        };

        if (t.type === 'customGrid') {
          const targetRows = parseInt(gridRowsInput.value) || (t.gridData ? t.gridData.length : 3);
          const targetCols = parseInt(gridColsInput.value) || (t.gridData && t.gridData[0] ? t.gridData[0].length : 3);
          updated.rowsCount = targetRows;
          updated.colsCount = targetCols;

          let currentGrid = t.gridData ? JSON.parse(JSON.stringify(t.gridData)) : [];
          while (currentGrid.length < targetRows) {
            const colsLen = (currentGrid[0] && currentGrid[0].length) ? currentGrid[0].length : targetCols;
            currentGrid.push(new Array(colsLen).fill(''));
          }
          if (currentGrid.length > targetRows) {
            currentGrid = currentGrid.slice(0, targetRows);
          }

          currentGrid.forEach(row => {
            while (row.length < targetCols) row.push('');
            if (row.length > targetCols) row.splice(targetCols);
          });

          updated.gridData = currentGrid;
          if (updated.weeklyData) {
            const targetWeekDate = (typeof currentWeekStart !== 'undefined' && currentWeekStart) ? currentWeekStart : new Date();
            const wKey = formatDateISO(getSunday(targetWeekDate));
            if (updated.weeklyData[wKey]) {
              updated.weeklyData[wKey].gridData = JSON.parse(JSON.stringify(currentGrid));
            }
          }
        }

        return updated;
      }
      return t;
    });
  } else {
    // Create new table
    const newTable = {
      id: Date.now().toString(),
      title,
      type,
      resetFrequency,
      categories,
      subCategory,
      isToday,
      isCompact,
      createdAt: formatDateISO(new Date()),
      lastResetDate: formatDateISO(new Date())
    };

    if (type === 'checkboxes') {
      newTable.items = [
        { id: '1', text: '', checked: false }
      ];
    } else if (type === 'customGrid') {
      const rows = parseInt(gridRowsInput.value) || 3;
      const cols = parseInt(gridColsInput.value) || 3;
      newTable.rowsCount = rows;
      newTable.colsCount = cols;
      newTable.headers = Array.from({ length: cols }, (_, i) => `עמודה ${i + 1}`);
      newTable.gridData = Array.from({ length: rows }, () => Array(cols).fill(''));
    } else if (type === 'freeText') {
      newTable.textContent = '';
    } else if (type === 'special') {
      newTable.specialType = 'image';
      newTable.imageData = null;
      newTable.canvasData = null;
    }

    // Place new table at the VERY TOP of the list
    tables.unshift(newTable);
    newTableCreatedId = newTable.id;
  }

  saveStateToHistory();
  saveStateToLocalStorage();
  saveDataToCloudDirect();
  renderFilteredTables();
  closeTableModal();

  // Auto-focus first input field if a new checkbox table was created
  if (newTableCreatedId && type === 'checkboxes') {
    setTimeout(() => {
      const firstInput = document.querySelector(`#tableBody_${newTableCreatedId} .checkbox-table-item input[type="text"]`);
      if (firstInput) firstInput.focus();
    }, 50);
  }
}

// Auto-reset tables based on resetFrequency & clean empty items
function checkAndResetTables() {
  const todayObj = new Date();
  const todayISO = formatDateISO(todayObj);

  tables.forEach(t => {
    // Clean empty checkbox rows if more than 1 item exists
    if (t.type === 'checkboxes' && t.items && t.items.length > 1) {
      t.items = t.items.filter(item => item.text.trim() !== '' || document.activeElement?.value === item.text);
      if (t.items.length === 0) {
        t.items = [{ id: Date.now().toString(), text: '', checked: false }];
      }
    }

    if (!t.lastResetDate) t.lastResetDate = todayISO;
    if (t.resetFrequency === 'permanent' || !t.items) return;

    const lastResetObj = new Date(t.lastResetDate + 'T00:00:00');
    let shouldReset = false;

    if (t.resetFrequency === 'daily') {
      if (todayISO !== t.lastResetDate) shouldReset = true;
    } else if (t.resetFrequency === 'weekly') {
      if (getSunday(todayObj).getTime() !== getSunday(lastResetObj).getTime()) shouldReset = true;
    } else if (t.resetFrequency === 'monthly') {
      if (todayObj.getMonth() !== lastResetObj.getMonth() || todayObj.getFullYear() !== lastResetObj.getFullYear()) shouldReset = true;
    }

    if (shouldReset) {
      if (t.items) {
        t.items.forEach(item => {
          item.checked = false;
          item.completedAtISO = null;
          item.completedAtDate = null;
          item.completedAtTime = null;
        });
      }
      t.lastResetDate = todayISO;
      if (typeof saveDataToCloud === 'function') {
        saveDataToCloud();
      }
    }
  });
}

// Helper to get active week date range string (e.g. "9-15 באוגוסט 2026")
function getWeekRangeString(startDate) {
  const sunday = getSunday(startDate);
  const saturday = new Date(sunday);
  saturday.setDate(saturday.getDate() + 6);

  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const startDay = sunday.getDate();
  const endDay = saturday.getDate();
  const monthName = months[sunday.getMonth()];
  const year = sunday.getFullYear();

  return `${startDay}-${endDay} ב${monthName} ${year}`;
}

// Helper to resolve active week data proxy for weekly_archive tables
function getWeeklyArchiveData(t) {
  if (!t) return t;

  if (!t.weeklyData) t.weeklyData = {};
  const targetWeekDate = (typeof currentWeekStart !== 'undefined' && currentWeekStart) ? currentWeekStart : new Date();
  const wKey = formatDateISO(getSunday(targetWeekDate));

  if (!t.weeklyData[wKey]) {
    // 1. For Checkboxes: preserve item titles, but reset completed checkmarks for the new week!
    let newItems = [];
    if (t.items && Array.isArray(t.items) && t.items.length > 0) {
      newItems = t.items.map(item => ({
        ...item,
        completed: false,
        checked: false
      }));
    } else {
      newItems = [{ id: Date.now().toString(), text: '', completed: false, checked: false }];
    }

    // 2. Weekly scope for all properties (inherit initial images/drawings from table object if present)
    t.weeklyData[wKey] = {
      items: newItems,
      images: (t.images && Array.isArray(t.images) && t.images.length > 0) ? JSON.parse(JSON.stringify(t.images)) : [],
      activeImageIndex: (typeof t.activeImageIndex === 'number') ? t.activeImageIndex : 0,
      imageData: t.imageData || null,
      canvasData: t.canvasData || null,
      specialType: t.specialType || 'image',
      textContent: t.textContent || t.content || '',
      headers: t.headers ? JSON.parse(JSON.stringify(t.headers)) : ['עמודה 1', 'עמודה 2', 'עמודה 3'],
      gridData: t.gridData ? JSON.parse(JSON.stringify(t.gridData)) : [['', '', ''], ['', '', '']]
    };
  }

  // Directly attach the active week's data onto t so t is ALWAYS a 100% plain, JSON-serializable JS object!
  const weekObj = t.weeklyData[wKey];
  t.items = weekObj.items;
  t.images = weekObj.images;
  t.activeImageIndex = weekObj.activeImageIndex;
  t.imageData = weekObj.imageData;
  t.canvasData = weekObj.canvasData;
  t.specialType = weekObj.specialType;
  t.textContent = weekObj.textContent;
  t.headers = weekObj.headers;
  t.gridData = weekObj.gridData;

  return t;
}

// Render Filtered Tables & Events List below Schedule
function renderFilteredTables() {
  const activeEl = document.activeElement;
  let activeFocusInfo = null;
  if (activeEl && activeEl.dataset && activeEl.dataset.tableId) {
    activeFocusInfo = {
      tableId: activeEl.dataset.tableId,
      rIdx: activeEl.dataset.rIdx,
      cIdx: activeEl.dataset.cIdx,
      itemId: activeEl.dataset.itemId,
      selStart: activeEl.selectionStart,
      selEnd: activeEl.selectionEnd
    };
  }

  checkAndResetTables();
  const todayISO = formatDateISO(new Date());

  // 1. Filter Events
  let filteredEvs = [];
  if (currentTab === 'all') {
    filteredEvs = [...events];
  } else if (currentTab === 'today') {
    filteredEvs = events.filter(ev => getEventBoundsForDate(ev, todayISO) !== null);
  } else {
    filteredEvs = events.filter(ev => ev.category === currentTab);
  }

  // 2. Filter Active Tables (where isArchived is falsey and not permanently deleted)
  const activeTables = tables.filter(t => !t.isArchived && !permanentlyDeletedIds.includes(t.id));

  let filteredTbls = [];
  if (currentTab === 'all') {
    filteredTbls = activeTables;
  } else if (currentTab === 'today') {
    filteredTbls = activeTables.filter(t => t.isToday);
  } else {
    filteredTbls = activeTables.filter(t => !t.categories || t.categories.length === 0 || t.categories.includes(currentTab));
  }

  // 3. Filter by Sub-Category if selected
  if (currentSubCategory && currentSubCategory !== 'all') {
    filteredTbls = filteredTbls.filter(t => t.subCategory === currentSubCategory);
  }

  renderSubCategoriesBar();

  // Set Header Title & Count
  const tabTitles = {
    all: 'כל התכנים והאירועים',
    today: 'תכנים ואירועים להיום',
    life: 'תכנים - חיים',
    work: 'תכנים - עבודה/פרויקטים',
    fun: 'תכנים - כיף'
  };

  const categoryNames = { life: 'חיים', work: 'עבודה/פרויקטים', fun: 'כיף' };
  filteredListTitle.textContent = tabTitles[currentTab] || 'תכנים';

  const totalCount = filteredTbls.length + filteredEvs.length;
  filteredListCount.textContent = `${totalCount} פריטים`;

  filteredTablesList.innerHTML = '';

  if (totalCount === 0) {
    const hintMsg = (tables.length > 0)
      ? `קיימות <strong>${tables.length} טבלאות</strong> בלשוניות או בתת-קטגוריות אחרות. לחץ על <strong>"הכל"</strong> בסרגל העליון כדי לראות אותן!`
      : 'לחץ על <strong>"+ הוספת טבלה"</strong> כדי ליצור תוכן חדש!';

    filteredTablesList.innerHTML = `
      <div class="empty-list-state">
        <p>אין תכנים או אירועים בלשונית זו (${categoryNames[currentTab] || currentTab}${currentSubCategory !== 'all' ? ` - ${escapeHtml(currentSubCategory)}` : ''}).</p>
        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #a5b4fc;">${hintMsg}</p>
      </div>`;
    return;
  }

  const targetWeekDate = (typeof currentWeekStart !== 'undefined' && currentWeekStart) ? currentWeekStart : new Date();
  const resetLabels = {
    weekly_archive: `📅 סטטית לאותו שבוע (${getWeekRangeString(targetWeekDate)})`,
    permanent: '📌 קבועה',
    daily: '🔄 מתחדשת בכל יום',
    weekly: '🔄 מתחדשת פעם בשבוע',
    monthly: '🔄 מתחדשת פעם בחודש'
  };

  // Render Tables
  filteredTbls.forEach((t, tIdx) => {
    const activeTableObj = getWeeklyArchiveData(t);
    const card = document.createElement('div');
    card.className = `rendered-table-card ${t.isCompact ? 'compact-card' : ''}`;
    card.setAttribute('draggable', 'true');

    // Card Drag Events
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging-table');
      e.dataTransfer.setData('text/table-id', t.id);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging-table');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedTableId = e.dataTransfer.getData('text/table-id');
      if (draggedTableId && draggedTableId !== t.id) {
        const fromIdx = tables.findIndex(tbl => tbl.id === draggedTableId);
        const toIdx = tables.findIndex(tbl => tbl.id === t.id);
        if (fromIdx !== -1 && toIdx !== -1) {
          saveStateToHistory();
          const moved = tables.splice(fromIdx, 1)[0];
          tables.splice(toIdx, 0, moved);
          renderFilteredTables();
        }
      }
    });

    const subCatBadgeHtml = t.subCategory ? `<span class="cat-badge" style="background:rgba(99,102,241,0.25); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4);">📁 ${escapeHtml(t.subCategory)}</span>` : '';
    const badgesHtml = t.categories.map(cat => `<span class="cat-badge cat-${cat}">${categoryNames[cat]}</span>`).join(' ') + ' ' + subCatBadgeHtml;
    const resetBadgeHtml = `<span class="reset-badge">${resetLabels[t.resetFrequency || 'weekly_archive']}</span>`;
    const isTodayActive = t.isToday ? 'active' : '';

    const isFirst = (tIdx === 0);
    const isLast = (tIdx === filteredTbls.length - 1);

    const sharedBadgeHtml = (t.sharedWith && t.sharedWith.length > 0)
      ? `<span class="table-shared-badge" title="משותף עם: ${t.sharedWith.join(', ')}">👥 משותף (${t.sharedWith.length})</span>`
      : '';

    card.innerHTML = `
      <div class="table-card-header">
        <div class="table-card-title-group">
          <span class="table-drag-handle" title="גרור לשינוי סדר הטבלה">⋮⋮</span>
          <span class="table-card-title">${t.title}</span>
          ${badgesHtml}
          ${resetBadgeHtml}
          ${sharedBadgeHtml}
        </div>
        <div class="table-card-actions">
          <button type="button" class="btn-reorder tbl-up-btn" title="הזז טבלה למעלה" ${isFirst ? 'disabled' : ''}>⬆️</button>
          <button type="button" class="btn-reorder tbl-down-btn" title="הזז טבלה למטה" ${isLast ? 'disabled' : ''}>⬇️</button>
          <button type="button" class="today-status-btn ${isTodayActive}" title="לחץ להוספה/הסרה מהיום">
            📌 ${t.isToday ? 'מופיע בהיום' : 'הוסף להיום'}
          </button>
          <button type="button" class="btn-compact-toggle" title="הגדל/מזער כרטיס טבלה">
            ${t.isCompact ? '📐 הרחב' : '📐 מזער'}
          </button>
          <button type="button" class="btn-share-table" title="שיתוף טבלה זו עם משתמש נוסף">👥</button>
          <button type="button" class="edit-table-btn" title="עריכת הגדרות טבלה">✏️</button>
          <button type="button" class="delete-table-btn" title="מחיקת טבלה">&times;</button>
        </div>
      </div>
      <div class="table-card-body" id="tableBody_${t.id}"></div>
    `;

    // Table Action Listeners
    const upBtn = card.querySelector('.tbl-up-btn');
    upBtn.addEventListener('click', () => {
      if (tIdx > 0) {
        saveStateToHistory();
        const targetIdx = tables.findIndex(tbl => tbl.id === filteredTbls[tIdx - 1].id);
        const currIdx = tables.findIndex(tbl => tbl.id === t.id);
        if (currIdx !== -1 && targetIdx !== -1) {
          const temp = tables[currIdx];
          tables[currIdx] = tables[targetIdx];
          tables[targetIdx] = temp;
          renderFilteredTables();
        }
      }
    });

    const downBtn = card.querySelector('.tbl-down-btn');
    downBtn.addEventListener('click', () => {
      if (tIdx < filteredTbls.length - 1) {
        saveStateToHistory();
        const targetIdx = tables.findIndex(tbl => tbl.id === filteredTbls[tIdx + 1].id);
        const currIdx = tables.findIndex(tbl => tbl.id === t.id);
        if (currIdx !== -1 && targetIdx !== -1) {
          const temp = tables[currIdx];
          tables[currIdx] = tables[targetIdx];
          tables[targetIdx] = temp;
          renderFilteredTables();
        }
      }
    });

    const compactBtn = card.querySelector('.btn-compact-toggle');
    compactBtn.addEventListener('click', () => {
      saveStateToHistory();
      t.isCompact = !t.isCompact;
      renderFilteredTables();
    });

    const shareBtnEl = card.querySelector('.btn-share-table');
    if (shareBtnEl) {
      shareBtnEl.addEventListener('click', () => openShareModal(t));
    }

    const editBtnEl = card.querySelector('.edit-table-btn');
    editBtnEl.addEventListener('click', () => openTableModal(t));

    const todayBtnEl = card.querySelector('.today-status-btn');
    todayBtnEl.addEventListener('click', () => {
      saveStateToHistory();
      t.isToday = !t.isToday;
      renderFilteredTables();
    });

    const deleteBtnEl = card.querySelector('.delete-table-btn');
    deleteBtnEl.addEventListener('click', (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      saveStateToHistory();
      const now = new Date();
      t.isArchived = true;
      t.deletedAtISO = formatDateISO(now);
      t.deletedAtDate = formatDateOptionLabel(now);
      t.deletedAtTime = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

      renderFilteredTables();
      saveDataToCloudDirect();
      showToast(`📦 הטבלה "${t.title}" הועברה לארכיון הטבלאות המחוקות`);
    });

    const bodyContainer = card.querySelector(`#tableBody_${t.id}`);

    if (t.type === 'checkboxes') {
      renderCheckboxTableBody(activeTableObj, bodyContainer);
    } else if (t.type === 'customGrid') {
      renderCustomGridTableBody(activeTableObj, bodyContainer);
    } else if (t.type === 'freeText') {
      renderFreeTextTableBody(activeTableObj, bodyContainer);
    } else if (t.type === 'special') {
      renderSpecialTableBody(activeTableObj, bodyContainer);
    }

    filteredTablesList.appendChild(card);
  });

  // Render Events
  if (filteredEvs.length > 0) {
    const eventsHeading = document.createElement('h4');
    eventsHeading.className = 'section-subheading';
    eventsHeading.textContent = '📅 אירועים';
    filteredTablesList.appendChild(eventsHeading);

    filteredEvs.forEach(ev => {
      const isRecurring = ev.recurrence && ev.recurrence !== 'none';
      const recurrenceIcon = isRecurring ? '<span class="recurrence-badge" title="אירוע מחזורי">🔄</span>' : '';
      const categoryClass = `cat-${ev.category || 'regular'}`;

      const dateDisplay = ev.endDate && ev.endDate !== ev.date
        ? `${ev.date} עד ${ev.endDate}`
        : ev.date;

      const item = document.createElement('div');
      item.className = `list-event-item ${categoryClass}`;
      item.innerHTML = `
        <div class="list-event-title">
          <span>${ev.title}</span>
          ${recurrenceIcon}
        </div>
        <div class="list-event-meta">
          <span>📅 ${dateDisplay}</span>
          <span>⏰ ${ev.startTime} - ${ev.endTime}</span>
        </div>
      `;

      item.addEventListener('click', () => openModal(ev));
      filteredTablesList.appendChild(item);
    });
  }

  // Append Completed Tasks Log and Deleted Tables Archive
  renderCompletedTasksLogCard();
  renderDeletedTablesArchiveCard();

  if (activeFocusInfo) {
    let focusTa = null;
    if (activeFocusInfo.rIdx !== undefined && activeFocusInfo.cIdx !== undefined) {
      focusTa = document.querySelector(`textarea[data-table-id="${activeFocusInfo.tableId}"][data-r-idx="${activeFocusInfo.rIdx}"][data-c-idx="${activeFocusInfo.cIdx}"]`);
    } else if (activeFocusInfo.itemId !== undefined) {
      focusTa = document.querySelector(`input[data-table-id="${activeFocusInfo.tableId}"][data-item-id="${activeFocusInfo.itemId}"]`);
    }
    if (focusTa) {
      focusTa.focus();
      try {
        if (typeof activeFocusInfo.selStart === 'number' && typeof activeFocusInfo.selEnd === 'number') {
          focusTa.setSelectionRange(activeFocusInfo.selStart, activeFocusInfo.selEnd);
        }
      } catch (e) {}
    }
  }
}

let isDeletedTablesArchiveExpanded = false;

// Special Card: Render Compact Centered Collapsible Archive Box at the bottom of "All" tab
function renderDeletedTablesArchiveCard() {
  const existingCard = document.getElementById('deletedTablesArchiveCard');
  if (existingCard) existingCard.remove();

  // Legacy migration: merge legacy deletedTables into tables as isArchived: true
  if (typeof deletedTables !== 'undefined' && Array.isArray(deletedTables) && deletedTables.length > 0) {
    deletedTables.forEach(delT => {
      let existing = tables.find(tbl => tbl.id === delT.id);
      if (!existing) {
        delT.isArchived = true;
        tables.push(delT);
      } else {
        existing.isArchived = true;
      }
    });
    deletedTables = [];
  }

  const archivedTables = tables.filter(t => t.isArchived && !permanentlyDeletedIds.includes(t.id));

  if (archivedTables.length === 0 && currentTab !== 'all') return;

  const archiveWrapper = document.createElement('div');
  archiveWrapper.id = 'deletedTablesArchiveCard';
  archiveWrapper.className = 'deleted-tables-archive-wrapper';
  archiveWrapper.style.margin = '3rem auto 1.5rem auto';
  archiveWrapper.style.maxWidth = '460px';
  archiveWrapper.style.width = '100%';
  archiveWrapper.style.display = 'flex';
  archiveWrapper.style.flexDirection = 'column';
  archiveWrapper.style.alignItems = 'center';

  // Toggle Header Button
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'btn btn-secondary archive-toggle-btn';
  toggleBtn.style.padding = '0.45rem 1.25rem';
  toggleBtn.style.borderRadius = '24px';
  toggleBtn.style.border = '1px solid rgba(239, 68, 68, 0.4)';
  toggleBtn.style.background = 'rgba(15, 23, 42, 0.85)';
  toggleBtn.style.color = '#f87171';
  toggleBtn.style.fontSize = '0.9rem';
  toggleBtn.style.fontWeight = '600';
  toggleBtn.style.cursor = 'pointer';
  toggleBtn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.25)';
  toggleBtn.style.display = 'flex';
  toggleBtn.style.alignItems = 'center';
  toggleBtn.style.gap = '0.5rem';
  toggleBtn.style.transition = 'all 0.15s ease';

  const arrow = isDeletedTablesArchiveExpanded ? '▴' : '▾';
  toggleBtn.innerHTML = `<span>📦</span> <span>ארכיון (${archivedTables.length})</span> <span style="font-size:0.8rem;">${arrow}</span>`;

  toggleBtn.addEventListener('click', () => {
    isDeletedTablesArchiveExpanded = !isDeletedTablesArchiveExpanded;
    renderDeletedTablesArchiveCard();
  });

  archiveWrapper.appendChild(toggleBtn);

  // Expanded Content Box
  if (isDeletedTablesArchiveExpanded) {
    const listCard = document.createElement('div');
    listCard.className = 'deleted-tables-archive-box';
    listCard.style.width = '100%';
    listCard.style.marginTop = '0.75rem';
    listCard.style.padding = '1rem';
    listCard.style.borderRadius = 'var(--radius-sm)';
    listCard.style.border = '1px dashed rgba(239, 68, 68, 0.4)';
    listCard.style.background = 'rgba(15, 23, 42, 0.95)';
    listCard.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.35)';

    const listContainer = document.createElement('div');
    listContainer.className = 'deleted-tables-list';
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '0.5rem';

    if (archivedTables.length === 0) {
      listContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); margin:0; text-align:center; padding:0.4rem 0;">אין טבלאות מחוקות בארכיון כרגע.</p>`;
    } else {
      const archiveHeader = document.createElement('div');
      archiveHeader.style.display = 'flex';
      archiveHeader.style.justifyContent = 'space-between';
      archiveHeader.style.alignItems = 'center';
      archiveHeader.style.marginBottom = '0.75rem';
      archiveHeader.style.paddingBottom = '0.5rem';
      archiveHeader.style.borderBottom = '1px dashed rgba(239, 68, 68, 0.3)';

      const countTitle = document.createElement('span');
      countTitle.style.fontSize = '0.85rem';
      countTitle.style.color = '#f87171';
      countTitle.style.fontWeight = '600';
      countTitle.textContent = `טבלאות בארכיון (${archivedTables.length})`;

      const clearAllBtn = document.createElement('button');
      clearAllBtn.type = 'button';
      clearAllBtn.className = 'btn btn-sm btn-secondary';
      clearAllBtn.style.color = '#ef4444';
      clearAllBtn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      clearAllBtn.style.fontSize = '0.8rem';
      clearAllBtn.textContent = '🗑️ ריקון כל הארכיון לצמיתות';
      clearAllBtn.addEventListener('click', () => {
        if (confirm(`האם למחוק לצמיתות את כל ${archivedTables.length} הטבלאות בארכיון? הפעולה אינה ניתנת לביטול!`)) {
          saveStateToHistory();
          archivedTables.forEach(t => {
            if (!permanentlyDeletedIds.includes(t.id)) permanentlyDeletedIds.push(t.id);
          });
          tables = tables.filter(t => !t.isArchived);
          renderFilteredTables();
          saveDataToCloudDirect();
          showToast('🧹 הארכיון רוקן ונמחק לצמיתות');
        }
      });

      archiveHeader.appendChild(countTitle);
      archiveHeader.appendChild(clearAllBtn);
      listCard.appendChild(archiveHeader);

      archivedTables.forEach(t => {
        const itemEl = document.createElement('div');
        itemEl.className = 'completed-log-item';
        itemEl.style.justifyContent = 'space-between';
        itemEl.style.padding = '0.5rem 0.75rem';

        const timeLabel = t.deletedAtTime ? `נמחקה ב-${t.deletedAtDate || ''} בשעה ${t.deletedAtTime}` : 'נמחקה';
        const typeLabel = t.type === 'checkboxes' ? 'משימות' : (t.type === 'customGrid' ? 'עמודות ושורות' : (t.type === 'freeText' ? 'טקסט חופשי' : 'גלריה/ציור'));

        itemEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:0.2rem; text-align:right;">
            <span style="font-weight:bold; color:var(--text-primary); font-size:0.9rem;">${t.title} <small style="color:var(--text-muted); font-weight:normal;">(${typeLabel})</small></span>
            <span style="font-size:0.75rem; color:var(--text-muted);">🕒 ${timeLabel}</span>
          </div>
          <div style="display:flex; gap:0.4rem; align-items:center;">
            <button type="button" class="btn btn-sm btn-secondary restore-tbl-btn" title="שחזר טבלה זו ללוח" style="font-size:0.8rem;">↩️ שחזר</button>
            <button type="button" class="btn btn-sm btn-icon permanent-del-tbl-btn" style="color:#ef4444;" title="מחיקה לצמיתות">&times;</button>
          </div>
        `;

        // Restore table to original position & categories automatically
        itemEl.querySelector('.restore-tbl-btn').addEventListener('click', () => {
          saveStateToHistory();
          permanentlyDeletedIds = permanentlyDeletedIds.filter(id => id !== t.id);
          t.isArchived = false;

          tables.forEach(tbl => {
            if (tbl.id === t.id) {
              tbl.isArchived = false;
              delete tbl.deletedAtISO;
              delete tbl.deletedAtDate;
              delete tbl.deletedAtTime;
            }
          });

          // Ensure table is visible in currentTab view; if filtered out by category, switch to 'all' tab
          const activeTableMatch = tables.find(tbl => tbl.id === t.id);
          if (activeTableMatch) {
            const matchesCurrentTab = (currentTab === 'all') ||
              (currentTab === 'today' && activeTableMatch.isToday) ||
              (activeTableMatch.categories && activeTableMatch.categories.includes(currentTab));
            if (!matchesCurrentTab) {
              currentTab = 'all';
              document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === 'all');
              });
            }
          }

          renderFilteredTables();
          saveDataToCloudDirect();
          showToast(`↩️ הטבלה "${t.title}" שוחזרה בהצלחה למיקומה המקורי בלוח`);
        });

        // Permanent delete
        itemEl.querySelector('.permanent-del-tbl-btn').addEventListener('click', () => {
          if (confirm(`האם למחוק לצמיתות את הטבלה "${t.title}"? הפעולה לא ניתנת לביטול!`)) {
            saveStateToHistory();
            if (!permanentlyDeletedIds.includes(t.id)) permanentlyDeletedIds.push(t.id);
            tables = tables.filter(tbl => tbl.id !== t.id);
            renderFilteredTables();
            saveDataToCloudDirect();
            showToast(`💥 הטבלה "${t.title}" נמחקה לצמיתות`);
          }
        });

        listContainer.appendChild(itemEl);
      });
    }

    listCard.appendChild(listContainer);
    archiveWrapper.appendChild(listCard);
  }

  const bottomSection = document.querySelector('.bottom-section') || document.querySelector('.schedule-wrapper');
  if (bottomSection) {
    bottomSection.appendChild(archiveWrapper);
  } else if (filteredTablesList) {
    filteredTablesList.appendChild(archiveWrapper);
  }
}

// Special Card: Render Completed Tasks Log for Active Tab View
function renderCompletedTasksLogCard() {
  const existingLog = document.getElementById('completedTasksLogCard');
  if (existingLog) existingLog.remove();

  const todayISO = formatDateISO(new Date());

  // 1. Collect all completed items across all tables
  let completedItems = [];
  tables.forEach(t => {
    if (t.items && Array.isArray(t.items)) {
      t.items.forEach(item => {
        if (item.checked && item.text.trim() !== '') {
          completedItems.push({
            ...item,
            parentTableId: t.id,
            parentTableTitle: t.title,
            parentTableCategories: t.categories || []
          });
        }
      });
    }
  });

  // 2. Filter completedItems according to currentTab
  if (currentTab === 'today') {
    completedItems = completedItems.filter(item => item.completedAtISO === todayISO);
  } else if (['life', 'work', 'fun'].includes(currentTab)) {
    completedItems = completedItems.filter(item => item.parentTableCategories.includes(currentTab));
  }

  const categoryNames = { life: 'חיים', work: 'עבודה/פרויקטים', fun: 'כיף' };

  // 3. Create Completed Log Card container
  const logCard = document.createElement('div');
  logCard.id = 'completedTasksLogCard';
  logCard.className = 'completed-log-card';

  const tabNameLabels = {
    all: 'כל המשימות שבוצעו',
    today: 'משימות שבוצעו היום',
    life: 'משימות שבוצעו בחיים',
    work: 'משימות שבוצעו בעבודה/פרויקטים',
    fun: 'משימות שבוצעו בכיף'
  };

  const titleText = tabNameLabels[currentTab] || 'משימות שבוצעו';

  logCard.innerHTML = `
    <div class="completed-log-header">
      <div class="completed-log-title">
        <span>✅</span>
        <span>${titleText}</span>
      </div>
      <span class="badge-count">${completedItems.length} בוצעו</span>
    </div>
    <div class="completed-log-list">
      ${completedItems.length === 0 ? `
        <div class="empty-list-state" style="padding: 0.8rem 0;">
          <p style="font-size: 0.88rem; color: var(--text-muted);">אין משימות שבוצעו בלשונית זו.</p>
        </div>` : ''}
    </div>
  `;

  const listContainer = logCard.querySelector('.completed-log-list');

  if (completedItems.length > 0) {
    completedItems.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'completed-log-item';
      itemEl.style.cursor = 'pointer';
      itemEl.title = 'לחץ להחזרת המשימה לטבלה המקורית';

      const timeLabel = item.completedAtDate && item.completedAtTime
        ? `${item.completedAtDate} בשעה ${item.completedAtTime}`
        : (item.completedAtTime ? `היום בשעה ${item.completedAtTime}` : 'בוצע');

      const catBadges = item.parentTableCategories.map(c => `<span class="cat-badge cat-${c}">${categoryNames[c]}</span>`).join(' ');

      itemEl.innerHTML = `
        <div class="completed-item-text-group">
          <span style="color:#34d399; font-weight:bold;">✓</span>
          <span class="completed-item-text">${item.text}</span>
          <span class="completed-item-source">מתוך: ${item.parentTableTitle}</span>
          ${catBadges}
        </div>
        <div class="completed-item-meta">
          <span class="completed-timestamp">🕒 ${timeLabel}</span>
        </div>
      `;

      // Click to uncheck and restore item to its parent table!
      itemEl.addEventListener('click', () => {
        if (document.activeElement) document.activeElement.blur();
        saveStateToHistory();

        // 1. Find parent table by ID or by Title
        let parentTable = tables.find(t => t.id === item.parentTableId || t.title === item.parentTableTitle);

        // 2. If parent table was deleted, restore the parent table!
        if (!parentTable) {
          parentTable = {
            id: item.parentTableId || Date.now().toString(),
            title: item.parentTableTitle || 'טבלה משוחזרת',
            type: 'checkboxes',
            resetFrequency: 'permanent',
            categories: item.parentTableCategories && item.parentTableCategories.length > 0 ? item.parentTableCategories : ['life'],
            isToday: false,
            isCompact: false,
            createdAt: formatDateISO(new Date()),
            lastResetDate: formatDateISO(new Date()),
            items: []
          };
          tables.push(parentTable);
        }

        // 3. Find item in parent table
        if (!parentTable.items) parentTable.items = [];
        let targetItem = parentTable.items.find(i => i.id === item.id);

        if (targetItem) {
          // Item exists: uncheck it and clear completion metadata
          targetItem.checked = false;
          targetItem.completedAtISO = null;
          targetItem.completedAtDate = null;
          targetItem.completedAtTime = null;
        } else {
          // Item was deleted from parent table! Re-create/restore item back into parent table!
          const restoredItem = {
            id: item.id || Date.now().toString(),
            text: item.text,
            checked: false,
            completedAtISO: null,
            completedAtDate: null,
            completedAtTime: null
          };
          parentTable.items.unshift(restoredItem);
        }

        renderFilteredTables();
        showToast('↩️ המשימה שוחזרה לטבלה המקורית');
      });

      listContainer.appendChild(itemEl);
    });
  }

  filteredTablesList.appendChild(logCard);
}

// Render Type 1: Checkbox List with Drag & Drop and Up/Down Reordering
function renderCheckboxTableBody(t, container) {
  container.innerHTML = '';

  // Sort items: open (unchecked) items first, completed (checked) items at the bottom
  const uncheckedItems = t.items.filter(item => !item.checked);
  const checkedItems = t.items.filter(item => item.checked);
  t.items = [...uncheckedItems, ...checkedItems];

  const listEl = document.createElement('div');
  listEl.className = 'checkbox-table-list';

  t.items.forEach((item, idx) => {
    const rowEl = document.createElement('div');
    rowEl.className = `checkbox-table-item ${item.checked ? 'completed' : ''}`;
    rowEl.setAttribute('draggable', 'true');
    rowEl.dataset.index = idx;

    // Drag events
    rowEl.addEventListener('dragstart', (e) => {
      rowEl.classList.add('dragging');
      e.dataTransfer.setData('text/plain', idx);
    });

    rowEl.addEventListener('dragend', () => {
      rowEl.classList.remove('dragging');
    });

    rowEl.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    rowEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = idx;
      if (fromIdx !== toIdx && !isNaN(fromIdx)) {
        const movedItem = t.items.splice(fromIdx, 1)[0];
        t.items.splice(toIdx, 0, movedItem);
        renderCheckboxTableBody(t, container);
      }
    });

    // Drag Handle
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '⋮⋮';
    dragHandle.title = 'גרור לשינוי סדר';

    // Checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    cb.addEventListener('change', () => {
      saveStateToHistory();
      item.checked = cb.checked;
      if (cb.checked) {
        const now = new Date();
        item.completedAtISO = formatDateISO(now);
        item.completedAtDate = formatDateOptionLabel(now);
        item.completedAtTime = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        rowEl.classList.add('completed');
        rowEl.classList.add('just-completed');

        // Sparkle burst
        const sparkle = document.createElement('span');
        sparkle.className = 'sparkle-burst';
        sparkle.textContent = '✨';
        rowEl.appendChild(sparkle);

        setTimeout(() => {
          renderCheckboxTableBody(t, container);
          renderCompletedTasksLogCard();
        }, 450);
      } else {
        item.completedAtISO = null;
        item.completedAtDate = null;
        item.completedAtTime = null;
        rowEl.classList.remove('completed');
        rowEl.classList.remove('just-completed');
        renderCheckboxTableBody(t, container);
        renderCompletedTasksLogCard();
      }
    });

    // Text Input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = item.text;
    textInput.placeholder = '';
    textInput.dataset.tableId = t.id;
    textInput.dataset.itemId = item.id;
    textInput.addEventListener('input', () => {
      item.text = textInput.value;
      const rootT = tables.find(tbl => tbl.id === t.id);
      if (rootT && rootT.items) {
        const rootItem = rootT.items.find(i => i.id === item.id);
        if (rootItem) rootItem.text = textInput.value;
      }
      saveStateToLocalStorage();
      saveDataToCloud();
    });

    textInput.addEventListener('change', () => {
      saveStateToHistory();
      saveStateToLocalStorage();
      saveDataToCloudDirect();
    });

    // Auto-remove empty checkbox row when losing focus & save state
    textInput.addEventListener('blur', () => {
      saveStateToHistory();
      if (item.text.trim() === '' && t.items.length > 1) {
        t.items = t.items.filter(i => i.id !== item.id);
        renderCheckboxTableBody(t, container);
      }
      saveStateToLocalStorage();
      saveDataToCloudDirect();
    });

    // Press Enter to accept & create next row
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newItem = { id: Date.now().toString(), text: '', checked: false };
        t.items.splice(idx + 1, 0, newItem);
        renderCheckboxTableBody(t, container);
        saveStateToLocalStorage();
        saveDataToCloudDirect();
        setTimeout(() => {
          const inputs = container.querySelectorAll('.checkbox-table-item input[type="text"]');
          if (inputs[idx + 1]) inputs[idx + 1].focus();
        }, 30);
      }
    });

    // Reorder Action Buttons (Up, Down, Delete Row)
    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'item-reorder-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-reorder btn-up';
    upBtn.textContent = '⬆️';
    upBtn.title = 'הזז למעלה';
    if (idx === 0) upBtn.disabled = true;
    upBtn.addEventListener('click', () => {
      const movedItem = t.items.splice(idx, 1)[0];
      t.items.splice(idx - 1, 0, movedItem);
      renderCheckboxTableBody(t, container);
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-reorder btn-down';
    downBtn.textContent = '⬇️';
    downBtn.title = 'הזז למטה';
    if (idx === t.items.length - 1) downBtn.disabled = true;
    downBtn.addEventListener('click', () => {
      const movedItem = t.items.splice(idx, 1)[0];
      t.items.splice(idx + 1, 0, movedItem);
      renderCheckboxTableBody(t, container);
    });

    const delRowBtn = document.createElement('button');
    delRowBtn.type = 'button';
    delRowBtn.className = 'btn-reorder btn-delete-row';
    delRowBtn.innerHTML = '&times;';
    delRowBtn.title = 'מחיקת שורה';
    delRowBtn.addEventListener('click', () => {
      if (t.items.length <= 1) {
        t.items[0] = { id: Date.now().toString(), text: '', checked: false };
      } else {
        t.items.splice(idx, 1);
      }
      renderCheckboxTableBody(t, container);
    });

    // Schedule Task in Calendar Button (📅)
    const schedBtn = document.createElement('button');
    schedBtn.type = 'button';
    schedBtn.className = 'btn-reorder btn-schedule';
    schedBtn.textContent = '📅';
    schedBtn.title = 'הכנס ליומן המערכת (תזמון כאירוע)';
    schedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskTitle = item.text.trim() || t.title;
      const mainCat = (t.categories && t.categories.length > 0) ? t.categories[0] : 'life';

      openModal({
        title: taskTitle,
        category: mainCat
      });
    });

    actionsGroup.appendChild(schedBtn);
    actionsGroup.appendChild(upBtn);
    actionsGroup.appendChild(downBtn);
    actionsGroup.appendChild(delRowBtn);

    rowEl.appendChild(dragHandle);
    rowEl.appendChild(cb);
    rowEl.appendChild(textInput);
    rowEl.appendChild(actionsGroup);

    listEl.appendChild(rowEl);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-secondary btn-add-item';
  addBtn.textContent = '+ הוספת שורה';
  addBtn.addEventListener('click', () => {
    t.items.push({ id: Date.now().toString(), text: '', checked: false });
    renderCheckboxTableBody(t, container);
    setTimeout(() => {
      const inputs = container.querySelectorAll('.checkbox-table-item input[type="text"]');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 30);
  });

  container.appendChild(listEl);
  container.appendChild(addBtn);
}

// Render Type 2: Custom Grid Table (Columns & Rows Matrix)
function syncCustomGridData(t) {
  const rootT = tables.find(tbl => tbl.id === t.id);
  if (rootT) {
    rootT.gridData = JSON.parse(JSON.stringify(t.gridData));
    if (rootT.weeklyData) {
      const targetWeekDate = (typeof currentWeekStart !== 'undefined' && currentWeekStart) ? currentWeekStart : new Date();
      const wKey = formatDateISO(getSunday(targetWeekDate));
      if (rootT.weeklyData[wKey]) {
        rootT.weeklyData[wKey].gridData = JSON.parse(JSON.stringify(t.gridData));
      }
    }
  }
  t.gridData = JSON.parse(JSON.stringify(t.gridData));
  saveStateToHistory();
  saveStateToLocalStorage();
  saveDataToCloud();
}

function renderCustomGridTableBody(t, container) {
  container.innerHTML = '';

  if (!t.gridData || !Array.isArray(t.gridData) || t.gridData.length === 0) {
    t.gridData = [
      ['', '', ''],
      ['', '', ''],
      ['', '', '']
    ];
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'grid-table-wrapper';

  const tableEl = document.createElement('table');
  tableEl.className = 'rendered-custom-grid';

  const tbody = document.createElement('tbody');
  t.gridData.forEach((rowArray, rIdx) => {
    const tr = document.createElement('tr');
    if (rIdx === 0) {
      tr.className = 'grid-top-row';
    }

    // Row Control Buttons Cell (🎯 Select, ⬆️ Move Up, ⬇️ Move Down, 🗑️ Delete)
    const actionsTd = document.createElement('td');
    actionsTd.className = 'grid-row-actions-td';

    // 1. Select & Highlight Row Button (🎯)
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'grid-row-btn';
    selectBtn.title = 'סימון שורה זו והעתקת כל תאיה ללוח';
    selectBtn.textContent = '🎯';
    selectBtn.addEventListener('click', () => {
      const allRows = tbody.querySelectorAll('tr');
      allRows.forEach(r => r.classList.remove('grid-row-selected'));
      tr.classList.add('grid-row-selected');

      const rowText = rowArray.join('\t');
      navigator.clipboard.writeText(rowText).then(() => {
        showToast(`🎯 השורה סומנה והועתקה ללוח!`);
      }).catch(() => {
        showToast(`🎯 השורה סומנה`);
      });
    });

    // 2. Move Row Up (⬆️)
    const moveUpBtn = document.createElement('button');
    moveUpBtn.type = 'button';
    moveUpBtn.className = 'grid-row-btn';
    moveUpBtn.title = 'הזז שורה למעלה';
    moveUpBtn.textContent = '⬆️';
    if (rIdx === 0) moveUpBtn.disabled = true;
    moveUpBtn.addEventListener('click', () => {
      if (rIdx > 0) {
        saveStateToHistory();
        const moved = t.gridData.splice(rIdx, 1)[0];
        t.gridData.splice(rIdx - 1, 0, moved);
        t.gridData = JSON.parse(JSON.stringify(t.gridData));
        syncCustomGridData(t);
        renderFilteredTables();
      }
    });

    // 3. Move Row Down (⬇️)
    const moveDownBtn = document.createElement('button');
    moveDownBtn.type = 'button';
    moveDownBtn.className = 'grid-row-btn';
    moveDownBtn.title = 'הזז שורה למטה';
    moveDownBtn.textContent = '⬇️';
    if (rIdx === t.gridData.length - 1) moveDownBtn.disabled = true;
    moveDownBtn.addEventListener('click', () => {
      if (rIdx < t.gridData.length - 1) {
        saveStateToHistory();
        const moved = t.gridData.splice(rIdx, 1)[0];
        t.gridData.splice(rIdx + 1, 0, moved);
        t.gridData = JSON.parse(JSON.stringify(t.gridData));
        syncCustomGridData(t);
        renderFilteredTables();
      }
    });

    // 4. Delete Row (🗑️)
    const deleteRowBtn = document.createElement('button');
    deleteRowBtn.type = 'button';
    deleteRowBtn.className = 'grid-row-btn';
    deleteRowBtn.title = 'מחק שורה זו';
    deleteRowBtn.textContent = '🗑️';
    deleteRowBtn.addEventListener('click', () => {
      if (t.gridData.length <= 1) {
        alert('לא ניתן למחוק את השורה האחרונה בטבלה!');
        return;
      }
      saveStateToHistory();
      t.gridData.splice(rIdx, 1);
      t.gridData = JSON.parse(JSON.stringify(t.gridData));
      syncCustomGridData(t);
      renderFilteredTables();
    });

    actionsTd.appendChild(selectBtn);
    actionsTd.appendChild(moveUpBtn);
    actionsTd.appendChild(moveDownBtn);
    actionsTd.appendChild(deleteRowBtn);
    tr.appendChild(actionsTd);

    rowArray.forEach((cellVal, cIdx) => {
      const td = document.createElement('td');
      const textarea = document.createElement('textarea');
      textarea.value = cellVal || '';
      textarea.placeholder = '';
      textarea.rows = 1;
      textarea.className = 'grid-cell-textarea';
      textarea.dataset.tableId = t.id;
      textarea.dataset.rIdx = rIdx;
      textarea.dataset.cIdx = cIdx;

      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(28, textarea.scrollHeight) + 'px';
      };

      textarea.addEventListener('input', () => {
        adjustHeight();
        if (!t.gridData[rIdx]) t.gridData[rIdx] = [];
        t.gridData[rIdx][cIdx] = textarea.value;
        const rootT = tables.find(tbl => tbl.id === t.id);
        if (rootT && rootT.gridData && rootT.gridData[rIdx]) {
          rootT.gridData[rIdx][cIdx] = textarea.value;
        }
        saveStateToLocalStorage();
        saveDataToCloud();
      });

      // Smart multi-cell clipboard paste
      textarea.addEventListener('paste', (e) => {
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        if (pasteData && (pasteData.includes('\t') || pasteData.includes('\n'))) {
          e.preventDefault();
          const values = pasteData.replace(/\r/g, '').split('\t');
          if (values.length > 1) {
            values.forEach((val, idx) => {
              const targetCol = cIdx + idx;
              if (targetCol < rowArray.length) {
                t.gridData[rIdx][targetCol] = val;
              }
            });
            syncCustomGridData(t);
            renderFilteredTables();
            showToast('📋 השורה הודבקה בהצלחה!');
          } else {
            textarea.value = pasteData;
            t.gridData[rIdx][cIdx] = pasteData;
            syncCustomGridData(t);
            adjustHeight();
          }
        }
      });

      textarea.addEventListener('change', () => {
        syncCustomGridData(t);
      });

      textarea.addEventListener('blur', () => {
        syncCustomGridData(t);
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (!e.shiftKey) {
            e.preventDefault();
            const nextTa = container.querySelector(`textarea[data-table-id="${t.id}"][data-r-idx="${rIdx + 1}"][data-c-idx="${cIdx}"]`);
            if (nextTa) nextTa.focus();
            else textarea.blur();
          } else {
            setTimeout(adjustHeight, 0);
          }
        } else if (e.key === 'ArrowDown') {
          if (textarea.selectionStart === textarea.value.length || !textarea.value.includes('\n')) {
            const nextTa = container.querySelector(`textarea[data-table-id="${t.id}"][data-r-idx="${rIdx + 1}"][data-c-idx="${cIdx}"]`);
            if (nextTa) {
              e.preventDefault();
              nextTa.focus();
            }
          }
        } else if (e.key === 'ArrowUp') {
          if (textarea.selectionStart === 0 || !textarea.value.includes('\n')) {
            const prevTa = container.querySelector(`textarea[data-table-id="${t.id}"][data-r-idx="${rIdx - 1}"][data-c-idx="${cIdx}"]`);
            if (prevTa) {
              e.preventDefault();
              prevTa.focus();
            }
          }
        } else if (e.key === 'ArrowLeft') {
          if (textarea.selectionStart === textarea.value.length) {
            const nextTa = container.querySelector(`textarea[data-table-id="${t.id}"][data-r-idx="${rIdx}"][data-c-idx="${cIdx + 1}"]`);
            if (nextTa) {
              e.preventDefault();
              nextTa.focus();
            }
          }
        } else if (e.key === 'ArrowRight') {
          if (textarea.selectionStart === 0) {
            const prevTa = container.querySelector(`textarea[data-table-id="${t.id}"][data-r-idx="${rIdx}"][data-c-idx="${cIdx - 1}"]`);
            if (prevTa) {
              e.preventDefault();
              prevTa.focus();
            }
          }
        }
      });

      td.appendChild(textarea);
      tr.appendChild(td);
      setTimeout(adjustHeight, 0);
    });
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
  wrapper.appendChild(tableEl);

  // Grid Control Toolbar (Add/Remove Rows & Columns)
  const toolbar = document.createElement('div');
  toolbar.className = 'grid-toolbar-controls';
  toolbar.style.display = 'flex';
  toolbar.style.gap = '0.4rem';
  toolbar.style.marginTop = '0.6rem';
  toolbar.style.flexWrap = 'wrap';

  const addRowBtn = document.createElement('button');
  addRowBtn.type = 'button';
  addRowBtn.className = 'btn btn-sm btn-secondary';
  addRowBtn.textContent = '➕ הוסף שורה';
  addRowBtn.addEventListener('click', () => {
    saveStateToHistory();
    const colsCount = (t.gridData[0] && t.gridData[0].length) ? t.gridData[0].length : 3;
    const newRow = new Array(colsCount).fill('');
    t.gridData.push(newRow);
    syncCustomGridData(t);
    renderCustomGridTableBody(t, container);
  });

  const delRowBtn = document.createElement('button');
  delRowBtn.type = 'button';
  delRowBtn.className = 'btn btn-sm btn-secondary';
  delRowBtn.textContent = '➖ מחק שורה';
  if (t.gridData.length <= 1) delRowBtn.disabled = true;
  delRowBtn.addEventListener('click', () => {
    if (t.gridData.length > 1) {
      saveStateToHistory();
      t.gridData.pop();
      syncCustomGridData(t);
      renderCustomGridTableBody(t, container);
    }
  });

  const addColBtn = document.createElement('button');
  addColBtn.type = 'button';
  addColBtn.className = 'btn btn-sm btn-secondary';
  addColBtn.textContent = '➕ הוסף עמודה';
  addColBtn.addEventListener('click', () => {
    saveStateToHistory();
    t.gridData.forEach(r => r.push(''));
    syncCustomGridData(t);
    renderCustomGridTableBody(t, container);
  });

  const delColBtn = document.createElement('button');
  delColBtn.type = 'button';
  delColBtn.className = 'btn btn-sm btn-secondary';
  delColBtn.textContent = '➖ מחק עמודה';
  const firstRowCols = t.gridData[0] ? t.gridData[0].length : 0;
  if (firstRowCols <= 1) delColBtn.disabled = true;
  delColBtn.addEventListener('click', () => {
    if (t.gridData[0] && t.gridData[0].length > 1) {
      saveStateToHistory();
      t.gridData.forEach(r => r.pop());
      syncCustomGridData(t);
      renderCustomGridTableBody(t, container);
    }
  });

  toolbar.appendChild(addRowBtn);
  toolbar.appendChild(delRowBtn);
  toolbar.appendChild(addColBtn);
  toolbar.appendChild(delColBtn);

  wrapper.appendChild(toolbar);
  container.appendChild(wrapper);
}

// Render Type 3: Free Text Table
function renderFreeTextTableBody(t, container) {
  container.innerHTML = '';
  const textarea = document.createElement('textarea');
  textarea.className = 'rendered-free-text';
  textarea.placeholder = 'הקלד טקסט חופשי כאן...';
  textarea.value = t.textContent || '';
  textarea.addEventListener('input', () => {
    t.textContent = textarea.value;
    const rootT = tables.find(tbl => tbl.id === t.id);
    if (rootT) rootT.textContent = textarea.value;
    saveStateToLocalStorage();
    saveDataToCloud();
  });
  textarea.addEventListener('change', () => {
    saveStateToHistory();
    saveStateToLocalStorage();
    saveDataToCloudDirect();
  });
  textarea.addEventListener('blur', () => {
    saveStateToHistory();
    saveStateToLocalStorage();
    saveDataToCloudDirect();
  });
  container.appendChild(textarea);
}

// Render Filtered Events List below Schedule
function renderFilteredEventsList() {
  const todayISO = formatDateISO(new Date());
  let filtered = [];

  // 1. Time Filter
  if (activeTimeTab === 'today') {
    filtered = events.filter(ev => {
      const bounds = getEventBoundsForDate(ev, todayISO);
      return bounds !== null;
    });
  } else {
    filtered = [...events];
  }

  // 2. Category Filter
  if (activeCategoryTab) {
    filtered = filtered.filter(ev => ev.category === activeCategoryTab);
  }

  // Set Title & Count
  const categoryNames = { life: 'חיים', work: 'עבודה', fun: 'כיף' };
  const timeTitle = activeTimeTab === 'today' ? 'אירועי היום' : 'כל האירועים';
  const catTitle = activeCategoryTab ? ` (${categoryNames[activeCategoryTab]})` : '';
  filteredListTitle.textContent = `${timeTitle}${catTitle}`;
  filteredListCount.textContent = `${filtered.length} אירועים`;

  // Render List
  filteredEventsList.innerHTML = '';

  if (filtered.length === 0) {
    filteredEventsList.innerHTML = `<div class="empty-list-state">אין אירועים להצגה להגדרות אלו.</div>`;
    return;
  }

  filtered.forEach(ev => {
    const isRecurring = ev.recurrence && ev.recurrence !== 'none';
    const recurrenceIcon = isRecurring ? '<span class="recurrence-badge" title="אירוע מחזורי">🔄</span>' : '';
    const categoryClass = `cat-${ev.category || 'regular'}`;

    const dateDisplay = ev.endDate && ev.endDate !== ev.date
      ? `${ev.date} עד ${ev.endDate}`
      : ev.date;

    const item = document.createElement('div');
    item.className = `list-event-item ${categoryClass}`;
    item.innerHTML = `
      <div class="list-event-title">
        <span>${ev.title}</span>
        ${recurrenceIcon}
      </div>
      <div class="list-event-meta">
        <span>📅 ${dateDisplay}</span>
        <span>⏰ ${ev.startTime} - ${ev.endTime}</span>
      </div>
    `;

    item.addEventListener('click', () => openModal(ev));
    filteredEventsList.appendChild(item);
  });
}

function handleDuplicateEvent() {
  if (!editingEventId) return;

  const currentEvent = events.find(ev => ev.id === editingEventId);
  if (!currentEvent) return;

  // Prepare duplicate draft (without ID so openModal puts form in creation mode)
  const duplicateDraft = {
    title: currentEvent.title,
    date: currentEvent.date,
    endDate: currentEvent.endDate || currentEvent.date,
    startTime: currentEvent.startTime,
    endTime: currentEvent.endTime,
    recurrence: currentEvent.recurrence || 'none',
    category: currentEvent.category || 'life'
  };

  // Open modal pre-filled with duplicate draft
  openModal(duplicateDraft);
  modalTitle.textContent = 'יצירת אירוע חדש (משוכפל)';
}

// Google Calendar Sync Functions
function handleSingleEventGoogleSync() {
  const title = eventTitleInput.value.trim() || 'אירוע חדש';
  const startDateStr = eventDateInput.value;
  const endDateStr = eventEndDateInput.value || startDateStr;
  const startTimeStr = eventStartTimeInput.value;
  const endTimeStr = eventEndTimeInput.value;
  const recurrence = eventRecurrenceInput.value;

  const sDateFormatted = startDateStr.replace(/-/g, '');
  const eDateFormatted = endDateStr.replace(/-/g, '');
  const sTimeFormatted = startTimeStr.replace(':', '') + '00';
  const eTimeFormatted = endTimeStr.replace(':', '') + '00';

  const datesParam = `${sDateFormatted}T${sTimeFormatted}/${eDateFormatted}T${eTimeFormatted}`;
  const titleParam = encodeURIComponent(title);
  const detailsParam = encodeURIComponent('נוצר באמצעות allmylifeishere');

  let recurParam = '';
  if (recurrence === 'weekly') recurParam = '&recur=RRULE:FREQ=WEEKLY';
  else if (recurrence === 'biweekly') recurParam = '&recur=RRULE:FREQ=WEEKLY;INTERVAL=2';
  else if (recurrence === 'monthly') recurParam = '&recur=RRULE:FREQ=MONTHLY';

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleParam}&dates=${datesParam}&details=${detailsParam}${recurParam}`;
  window.open(googleUrl, '_blank');
}

function handleGlobalGoogleSync() {
  const syncModal = document.getElementById('syncModal');
  if (syncModal) {
    syncModal.classList.remove('hidden');
    syncModal.setAttribute('aria-hidden', 'false');
  }
}

// Render Type 4: Special Table (✨ תמונה/ציור MS Paint)
function readBlobAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

function checkCanRenderImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

function resizeAndCompressImage(dataUrl, maxDim = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const cvs = document.createElement('canvas');
      cvs.width = width;
      cvs.height = height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(cvs.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function processImageFile(file) {
  if (!file) return null;
  const fileName = (file.name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();
  const isHeic = fileName.endsWith('.heic') || 
                 fileName.endsWith('.heif') || 
                 fileType.includes('heic') || 
                 fileType.includes('heif');

  let rawDataUrl = null;

  // 1. Try heic2any for iPhone HEIC/HEIF files
  if (isHeic && typeof heic2any !== 'undefined') {
    try {
      showToast('🔄 ממר תמונת iPhone HEIC לפורמט JPEG...');
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85
      });
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      rawDataUrl = await readBlobAsDataURL(blob);
    } catch (err) {
      console.warn('heic2any conversion notice:', err);
    }
  }

  // 2. Try standard FileReader and validate image renderability
  if (!rawDataUrl) {
    try {
      const dataUrl = await readBlobAsDataURL(file);
      const canRender = await checkCanRenderImage(dataUrl);
      if (canRender) {
        rawDataUrl = dataUrl;
      } else if (typeof createImageBitmap !== 'undefined') {
        // 3. Fallback: try createImageBitmap -> Canvas to JPEG DataURL
        try {
          const bmp = await createImageBitmap(file);
          const cvs = document.createElement('canvas');
          cvs.width = bmp.width;
          cvs.height = bmp.height;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(bmp, 0, 0);
          rawDataUrl = cvs.toDataURL('image/jpeg', 0.85);
        } catch (e) {
          rawDataUrl = dataUrl;
        }
      } else {
        rawDataUrl = dataUrl;
      }
    } catch (err) {
      console.warn('Image processing notice:', err);
      return null;
    }
  }

  if (!rawDataUrl) return null;

  // 4. Downscale & compress to max 1200px / 0.75 quality (~100KB) to guarantee LocalStorage & Firestore quotas!
  return await resizeAndCompressImage(rawDataUrl, 1200, 0.75);
}

function renderSpecialTableBody(t, container) {
  container.innerHTML = '';
  if (!t.specialType) t.specialType = 'image';
  if (!t.canvasHeight) t.canvasHeight = 280;

  const body = document.createElement('div');
  body.className = 'special-table-body';

  // Toggle Bar: Choice between Image (📸 תמונה) or Drawing (🎨 ציור)
  const toggleBar = document.createElement('div');
  toggleBar.className = 'special-type-toggle';
  toggleBar.innerHTML = `
    <button type="button" class="btn ${t.specialType === 'image' ? 'btn-primary' : 'btn-secondary'} toggle-img-btn">
      📸 תמונה
    </button>
    <button type="button" class="btn ${t.specialType === 'canvas' ? 'btn-primary' : 'btn-secondary'} toggle-canvas-btn">
      🎨 ציור
    </button>
  `;

  const toggleImgBtn = toggleBar.querySelector('.toggle-img-btn');
  const toggleCanvasBtn = toggleBar.querySelector('.toggle-canvas-btn');

  toggleImgBtn.addEventListener('click', () => {
    if (t.specialType !== 'image') {
      saveStateToHistory();
      t.specialType = 'image';
      renderSpecialTableBody(t, container);
    }
  });

  toggleCanvasBtn.addEventListener('click', () => {
    if (t.specialType !== 'canvas') {
      saveStateToHistory();
      t.specialType = 'canvas';
      renderSpecialTableBody(t, container);
    }
  });

  body.appendChild(toggleBar);

  if (t.specialType === 'image') {
    // Initialize Multi-Image Gallery Array (Up to 10 Images)
    if (!t.images) {
      t.images = t.imageData ? [t.imageData] : [];
    }
    if (!t.activeImageIndex) t.activeImageIndex = 0;
    if (t.activeImageIndex >= t.images.length) {
      t.activeImageIndex = Math.max(0, t.images.length - 1);
    }

    const imgCard = document.createElement('div');
    imgCard.className = 'special-widget-card';
    const totalImgs = t.images.length;

    imgCard.innerHTML = `
      <div class="special-widget-header">
        <span>📸 גלריית תמונות השבוע (${totalImgs}/10 תמונות)</span>
        <div class="image-gallery-actions">
          <input type="file" accept="image/*,.heic,.heif,image/heic,image/heif" multiple class="img-file-input" style="display:none;">
          <button type="button" class="btn btn-secondary btn-sm select-img-btn" ${totalImgs >= 10 ? 'disabled' : ''}>
            + להוספת תמונה (${totalImgs}/10)
          </button>
        </div>
      </div>
      ${totalImgs > 0 ? `
        <div class="image-gallery-viewer">
          <div class="image-stage">
            ${totalImgs > 1 ? '<button type="button" class="btn-gallery-nav prev-gallery-img-btn" title="תמונה קודמת">◀️</button>' : ''}
            <img src="${t.images[t.activeImageIndex]}" class="active-gallery-main-img" alt="תמונת גלריה">
            ${totalImgs > 1 ? '<button type="button" class="btn-gallery-nav next-gallery-img-btn" title="תמונה הבאה">▶️</button>' : ''}
            <button type="button" class="btn-delete-gallery-img" title="הסר תמונה זו מהגלריה">&times;</button>
            <span class="gallery-counter-badge">${t.activeImageIndex + 1} / ${totalImgs}</span>
          </div>

          ${totalImgs > 1 ? `
            <div class="image-thumbnails-strip">
              ${t.images.map((imgUrl, idx) => `
                <img src="${imgUrl}" class="gallery-thumb-item ${idx === t.activeImageIndex ? 'active' : ''}" data-idx="${idx}" alt="תמונה ממוזערת">
              `).join('')}
            </div>` : ''}
        </div>` : `
        <div class="empty-list-state image-drop-zone">
          <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">📥</div>
          <p style="color: var(--text-color); font-weight: 600;">גרירת תמונות מהפיינדר / המחשב לכאן</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">או לחץ על <strong>"+ להוספת תמונה"</strong> למעלה (תמיכה מלאה ב-iPhone HEIC!)</p>
        </div>`}
    `;

    const selectImgBtn = imgCard.querySelector('.select-img-btn');
    const imgFileInput = imgCard.querySelector('.img-file-input');

    selectImgBtn.addEventListener('click', () => imgFileInput.click());

    const handleFilesProcess = async (filesList) => {
      const files = Array.from(filesList);
      if (files.length > 0) {
        saveStateToHistory();
        const availableSlots = 10 - t.images.length;
        const filesToProcess = files.slice(0, availableSlots);

        for (const rawFile of filesToProcess) {
          const dataUrl = await processImageFile(rawFile);
          if (dataUrl) {
            t.images.push(dataUrl);
            t.imageData = t.images[0]; // Fallback compatibility
          }
        }
        if (t.images.length > 0) {
          t.activeImageIndex = t.images.length - 1;
          renderSpecialTableBody(t, container);
          saveDataToCloudDirect();
          showToast('📸 התמונות נוספו בהצלחה לגלריית השבוע!');
        }
      }
    };

    imgFileInput.addEventListener('change', async (e) => {
      await handleFilesProcess(e.target.files);
    });

    // Drag & Drop functionality for Finder / Explorer files
    ['dragenter', 'dragover'].forEach(evtName => {
      imgCard.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imgCard.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(evtName => {
      imgCard.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imgCard.classList.remove('drag-over');
      }, false);
    });

    imgCard.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        await handleFilesProcess(dt.files);
      }
    });

    const dropZoneEl = imgCard.querySelector('.image-drop-zone');
    if (dropZoneEl) {
      dropZoneEl.addEventListener('click', () => imgFileInput.click());
    }

    if (totalImgs > 0) {
      const prevBtn = imgCard.querySelector('.prev-gallery-img-btn');
      const nextBtn = imgCard.querySelector('.next-gallery-img-btn');
      const deleteImgBtn = imgCard.querySelector('.btn-delete-gallery-img');
      const thumbs = imgCard.querySelectorAll('.gallery-thumb-item');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          t.activeImageIndex = (t.activeImageIndex - 1 + totalImgs) % totalImgs;
          renderSpecialTableBody(t, container);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          t.activeImageIndex = (t.activeImageIndex + 1) % totalImgs;
          renderSpecialTableBody(t, container);
        });
      }

      if (deleteImgBtn) {
        deleteImgBtn.addEventListener('click', () => {
          saveStateToHistory();
          t.images.splice(t.activeImageIndex, 1);
          if (t.images.length === 0) {
            t.imageData = null;
            t.activeImageIndex = 0;
          } else {
            t.activeImageIndex = Math.max(0, t.activeImageIndex - 1);
            t.imageData = t.images[0];
          }
          renderSpecialTableBody(t, container);
          saveDataToCloudDirect();
          showToast('🗑️ התמונה הוסרה בהצלחה מהגלריה');
        });
      }

      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          const idx = parseInt(thumb.dataset.idx);
          t.activeImageIndex = idx;
          renderSpecialTableBody(t, container);
        });
      });
    }

    body.appendChild(imgCard);
  } else {
    // Render FULL MS Paint Pro Studio Canvas Widget Card
    const canvasCard = document.createElement('div');
    canvasCard.className = 'special-widget-card';
    canvasCard.innerHTML = `
      <div class="special-widget-header">
        <span>🎨 סטודיו ציור MS Paint Pro</span>
        <button type="button" class="btn btn-sm btn-secondary clear-canvas-btn" title="איפוס לוח הציור">🗑️ נקה</button>
      </div>
      <div class="canvas-widget-container">
        <div class="canvas-toolbar">
          <div class="canvas-tools-group">
            <button type="button" class="canvas-tool-btn active mode-draw-btn" title="כלי ציור">✏️ ציור</button>
            <button type="button" class="canvas-tool-btn mode-eraser-btn" title="כלי מחק">🧹 מחק</button>
            <button type="button" class="canvas-tool-btn mode-lasso-btn" title="ציור גזירה חופשית">✂️ גזירה חופשית</button>
            <button type="button" class="canvas-tool-btn mode-poly-btn" title="גזירה לא חופשית - מצולע/רדיוס סגור">📐 גזירה לא חופשית</button>
            <button type="button" class="canvas-tool-btn mode-rect-btn" title="גזירת מלבן / ריבוע">🔳 גזירת מלבן</button>
            <button type="button" class="canvas-tool-btn mode-paste-btn" title="הדבק אזור שנגזר" disabled>📌 הדבק</button>
            <input type="file" accept="image/*,.heic,.heif,image/heic,image/heif" class="canvas-img-file-input" style="display:none;">
            <button type="button" class="canvas-tool-btn add-canvas-img-btn" title="הוספת תמונה על משטח הציור">🖼️ תמונה</button>
          </div>
          
          <div class="canvas-tools-group">
            <select class="canvas-brush-select form-select" style="padding:0.15rem 0.35rem; font-size:0.8rem; width:auto;" title="סוג מברשת">
              <option value="pen">✏️ עט / עיפרון</option>
              <option value="brush" selected>🖌️ מכחול ציור</option>
              <option value="marker">🖍️ טוש מרקר</option>
              <option value="spray">💨 ספריי צבע</option>
              <option value="glow">✨ מברשת קסם זוהרת</option>
            </select>

            <div class="canvas-colors-group">
              <input type="color" class="canvas-color-picker-input" value="#000000" title="בחירת צבע אישי מתקדם (גלגל צבעים)">
              <span class="canvas-color-dot active" data-color="#000000" style="background:#000000;" title="שחור"></span>
              <span class="canvas-color-dot" data-color="#3b82f6" style="background:#3b82f6;" title="כחול"></span>
              <span class="canvas-color-dot" data-color="#ef4444" style="background:#ef4444;" title="אדום"></span>
              <span class="canvas-color-dot" data-color="#10b981" style="background:#10b981;" title="ירוק"></span>
              <span class="canvas-color-dot" data-color="#8b5cf6" style="background:#8b5cf6;" title="סגול"></span>
              <span class="canvas-color-dot" data-color="#ec4899" style="background:#ec4899;" title="וורוד"></span>
              <span class="canvas-color-dot" data-color="#f97316" style="background:#f97316;" title="כתום"></span>
              <span class="canvas-color-dot" data-color="#eab308" style="background:#eab308;" title="צהוב"></span>
              <span class="canvas-color-dot" data-color="#06b6d4" style="background:#06b6d4;" title="טורקיז"></span>
            </div>
            
            <select class="canvas-size-select form-select" style="padding:0.15rem 0.35rem; font-size:0.8rem; width:auto;" title="עובי מברשת">
              <option value="2">דק</option>
              <option value="5" selected>בינוני</option>
              <option value="12">עבה</option>
              <option value="22">ענק</option>
            </select>

            <select class="canvas-aspect-select form-select" style="padding:0.15rem 0.35rem; font-size:0.8rem; width:auto;" title="שינוי גובה/פרופורציות לוח">
              <option value="200" ${t.canvasHeight == 200 ? 'selected' : ''}>📐 200px</option>
              <option value="280" ${t.canvasHeight == 280 ? 'selected' : ''}>📐 280px</option>
              <option value="400" ${t.canvasHeight == 400 ? 'selected' : ''}>📐 400px</option>
              <option value="520" ${t.canvasHeight == 520 ? 'selected' : ''}>📐 520px</option>
            </select>
          </div>
        </div>

        <div class="canvas-wrapper">
          <svg class="lasso-svg-overlay"><path class="lasso-svg-path" d=""></path></svg>
          <canvas class="floating-cutout-canvas"></canvas>
          <canvas class="drawing-canvas"></canvas>
        </div>
      </div>
    `;

    const canvasWrapper = canvasCard.querySelector('.canvas-wrapper');
    const canvas = canvasCard.querySelector('.drawing-canvas');
    const floatingCanvas = canvasCard.querySelector('.floating-cutout-canvas');
    const lassoSvg = canvasCard.querySelector('.lasso-svg-overlay');
    const lassoPath = canvasCard.querySelector('.lasso-svg-path');

    const drawBtn = canvasCard.querySelector('.mode-draw-btn');
    const eraserBtn = canvasCard.querySelector('.mode-eraser-btn');
    const lassoBtn = canvasCard.querySelector('.mode-lasso-btn');
    const polyBtn = canvasCard.querySelector('.mode-poly-btn');
    const rectBtn = canvasCard.querySelector('.mode-rect-btn');
    const pasteBtn = canvasCard.querySelector('.mode-paste-btn');
    const addImgBtn = canvasCard.querySelector('.add-canvas-img-btn');
    const canvasImgFileInput = canvasCard.querySelector('.canvas-img-file-input');

    const brushSelect = canvasCard.querySelector('.canvas-brush-select');
    const clearCanvasBtn = canvasCard.querySelector('.clear-canvas-btn');
    const customColorPicker = canvasCard.querySelector('.canvas-color-picker-input');
    const colorDots = canvasCard.querySelectorAll('.canvas-color-dot');
    const sizeSelect = canvasCard.querySelector('.canvas-size-select');
    const aspectSelect = canvasCard.querySelector('.canvas-aspect-select');

    let activeTool = 'draw'; // 'draw' | 'eraser' | 'lasso' | 'poly' | 'rect' | 'paste'
    let currentBrush = 'brush';
    let isInteracting = false;
    let currentColor = '#000000';
    let currentLineWidth = 5;

    let lassoPoints = [];
    let startCutPos = { x: 0, y: 0 };
    let endCutPos = { x: 0, y: 0 };
    let clippedCanvas = null;
    let floatingPos = { x: 0, y: 0 };
    let isDraggingCutout = false;
    let dragStartOffset = { x: 0, y: 0 };

    // Custom Color Picker Change Handler
    customColorPicker.addEventListener('input', (e) => {
      currentColor = e.target.value;
      colorDots.forEach(d => d.classList.remove('active'));
      if (activeTool === 'eraser') setTool('draw');
    });

    // Aspect Ratio / Height Change
    aspectSelect.addEventListener('change', () => {
      saveStateToHistory();
      t.canvasHeight = parseInt(aspectSelect.value) || 280;
      renderSpecialTableBody(t, container);
    });

    // Add Image directly to Canvas
    addImgBtn.addEventListener('click', () => canvasImgFileInput.click());
    canvasImgFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        saveStateToHistory();
        const dataUrl = await processImageFile(file);
        if (dataUrl) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            t.canvasData = canvas.toDataURL();
            renderSpecialTableBody(t, container);
            saveDataToCloudDirect();
          };
          img.src = dataUrl;
        }
      }
    });

    function setTool(tool) {
      activeTool = tool;
      [drawBtn, eraserBtn, lassoBtn, polyBtn, rectBtn, pasteBtn].forEach(b => b.classList.remove('active'));
      if (tool === 'draw') drawBtn.classList.add('active');
      if (tool === 'eraser') eraserBtn.classList.add('active');
      if (tool === 'lasso') lassoBtn.classList.add('active');
      if (tool === 'poly') polyBtn.classList.add('active');
      if (tool === 'rect') rectBtn.classList.add('active');
      if (tool === 'paste') pasteBtn.classList.add('active');

      canvas.style.cursor = (tool === 'lasso' || tool === 'poly' || tool === 'rect') ? 'crosshair' : ((tool === 'paste') ? 'move' : 'crosshair');
    }

    drawBtn.addEventListener('click', () => setTool('draw'));
    eraserBtn.addEventListener('click', () => setTool('eraser'));
    lassoBtn.addEventListener('click', () => setTool('lasso'));
    polyBtn.addEventListener('click', () => setTool('poly'));
    rectBtn.addEventListener('click', () => setTool('rect'));
    pasteBtn.addEventListener('click', () => {
      if (clippedCanvas) setTool('paste');
    });

    brushSelect.addEventListener('change', () => {
      currentBrush = brushSelect.value;
      if (activeTool === 'eraser') setTool('draw');
    });

    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        currentColor = dot.dataset.color;
        customColorPicker.value = currentColor;
        if (activeTool === 'eraser') setTool('draw');
      });
    });

    sizeSelect.addEventListener('change', () => {
      currentLineWidth = parseInt(sizeSelect.value) || 5;
    });

    setTimeout(() => {
      const rect = canvasWrapper.getBoundingClientRect();
      canvas.width = rect.width || 400;
      canvas.height = t.canvasHeight || 280;
      canvas.style.height = (t.canvasHeight || 280) + 'px';

      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (t.canvasData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = t.canvasData;
      }

      // Card Drag Prevention
      const parentCard = container.closest('.rendered-table-card');
      if (parentCard) {
        canvas.addEventListener('mouseenter', () => parentCard.setAttribute('draggable', 'false'));
        canvas.addEventListener('mouseleave', () => parentCard.setAttribute('draggable', 'true'));
        canvas.addEventListener('touchstart', () => parentCard.setAttribute('draggable', 'false'), { passive: true });
        canvas.addEventListener('touchend', () => parentCard.setAttribute('draggable', 'true'));
      }

      // Live Dragging Handlers for Floating Cutout Canvas
      function startCutoutDrag(e) {
        e.stopPropagation();
        isDraggingCutout = true;
        floatingCanvas.classList.add('dragging');

        if (parentCard) parentCard.setAttribute('draggable', 'false');

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const wrapRect = canvasWrapper.getBoundingClientRect();

        dragStartOffset = {
          x: (clientX - wrapRect.left) - floatingPos.x,
          y: (clientY - wrapRect.top) - floatingPos.y
        };
      }

      function moveCutoutDrag(e) {
        if (!isDraggingCutout) return;
        e.stopPropagation();
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const wrapRect = canvasWrapper.getBoundingClientRect();

        const newX = (clientX - wrapRect.left) - dragStartOffset.x;
        const newY = (clientY - wrapRect.top) - dragStartOffset.y;

        floatingPos.x = newX;
        floatingPos.y = newY;

        floatingCanvas.style.left = newX + 'px';
        floatingCanvas.style.top = newY + 'px';
      }

      function stopCutoutDrag(e) {
        if (!isDraggingCutout) return;
        if (e) e.stopPropagation();
        isDraggingCutout = false;
        floatingCanvas.classList.remove('dragging');

        // Stamp down into main canvas & stay static until moved again!
        saveStateToHistory();
        ctx.drawImage(floatingCanvas, floatingPos.x, floatingPos.y);
        t.canvasData = canvas.toDataURL();
      }

      floatingCanvas.addEventListener('mousedown', startCutoutDrag);
      window.addEventListener('mousemove', moveCutoutDrag);
      window.addEventListener('mouseup', stopCutoutDrag);

      floatingCanvas.addEventListener('touchstart', startCutoutDrag);
      window.addEventListener('touchmove', moveCutoutDrag, { passive: false });
      window.addEventListener('touchend', stopCutoutDrag);

      function getPos(e) {
        const cRect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: Math.max(0, Math.min(canvas.width, clientX - cRect.left)),
          y: Math.max(0, Math.min(canvas.height, clientY - cRect.top))
        };
      }

      // Spray Paint Generator
      function generateSpray(x, y, radius, density) {
        ctx.fillStyle = currentColor;
        for (let i = 0; i < density; i++) {
          const offsetAngle = Math.random() * Math.PI * 2;
          const offsetRadius = Math.random() * radius;
          const px = x + offsetRadius * Math.cos(offsetAngle);
          const py = y + offsetRadius * Math.sin(offsetAngle);
          ctx.fillRect(px, py, 1.5, 1.5);
        }
      }

      function startAction(e) {
        e.stopPropagation();
        isInteracting = true;
        const pos = getPos(e);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        if (activeTool === 'draw' || activeTool === 'eraser') {
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          if (activeTool === 'draw' && currentBrush === 'spray') {
            generateSpray(pos.x, pos.y, currentLineWidth * 2, 25);
          }
        } else if (activeTool === 'lasso' || activeTool === 'poly') {
          lassoPoints = [pos];
          lassoPath.setAttribute('d', `M ${pos.x} ${pos.y}`);
          lassoSvg.style.display = 'block';
        } else if (activeTool === 'rect') {
          startCutPos = pos;
          endCutPos = pos;
          lassoPath.setAttribute('d', `M ${pos.x} ${pos.y} L ${pos.x} ${pos.y} L ${pos.x} ${pos.y} L ${pos.x} ${pos.y} Z`);
          lassoSvg.style.display = 'block';
        } else if (activeTool === 'paste' && clippedCanvas) {
          saveStateToHistory();
          ctx.drawImage(clippedCanvas, pos.x - clippedCanvas.width / 2, pos.y - clippedCanvas.height / 2);
          t.canvasData = canvas.toDataURL();
          setTool('draw');
          isInteracting = false;
        }
      }

      function moveAction(e) {
        if (!isInteracting) return;
        e.stopPropagation();
        e.preventDefault();
        const pos = getPos(e);

        if (activeTool === 'draw' || activeTool === 'eraser') {
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (activeTool === 'eraser') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = currentLineWidth * 2.5;
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
          } else {
            ctx.strokeStyle = currentColor;
            if (currentBrush === 'pen') {
              ctx.lineWidth = currentLineWidth;
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
            } else if (currentBrush === 'brush') {
              ctx.globalAlpha = 0.65;
              ctx.lineWidth = currentLineWidth * 1.5;
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
            } else if (currentBrush === 'marker') {
              ctx.globalAlpha = 0.35;
              ctx.lineCap = 'square';
              ctx.lineWidth = currentLineWidth * 2.8;
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
            } else if (currentBrush === 'spray') {
              generateSpray(pos.x, pos.y, currentLineWidth * 2.2, 25);
            } else if (currentBrush === 'glow') {
              ctx.shadowColor = currentColor;
              ctx.shadowBlur = 14;
              ctx.lineWidth = currentLineWidth;
              ctx.lineTo(pos.x, pos.y);
              ctx.stroke();
            }
          }
        } else if (activeTool === 'lasso') {
          lassoPoints.push(pos);
          const dStr = lassoPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          lassoPath.setAttribute('d', dStr);
        } else if (activeTool === 'poly') {
          lassoPoints.push(pos);
          const dStr = lassoPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          lassoPath.setAttribute('d', dStr);
        } else if (activeTool === 'rect') {
          endCutPos = pos;
          const minX = Math.min(startCutPos.x, pos.x);
          const minY = Math.min(startCutPos.y, pos.y);
          const w = Math.abs(pos.x - startCutPos.x);
          const h = Math.abs(pos.y - startCutPos.y);
          const dStr = `M ${minX} ${minY} L ${minX + w} ${minY} L ${minX + w} ${minY + h} L ${minX} ${minY + h} Z`;
          lassoPath.setAttribute('d', dStr);
        }
      }

      function stopAction(e) {
        if (!isInteracting) return;
        if (e) e.stopPropagation();
        isInteracting = false;

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        if (activeTool === 'draw' || activeTool === 'eraser') {
          ctx.closePath();
          saveStateToHistory();
          t.canvasData = canvas.toDataURL();
        } else if (activeTool === 'lasso' || activeTool === 'poly' || activeTool === 'rect') {
          lassoSvg.style.display = 'none';

          let minX = 0, minY = 0, w = 0, h = 0;

          if ((activeTool === 'lasso' || activeTool === 'poly') && lassoPoints.length > 5) {
            const xs = lassoPoints.map(p => p.x);
            const ys = lassoPoints.map(p => p.y);
            minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            w = Math.max(10, maxX - minX);
            h = Math.max(10, maxY - minY);
          } else if (activeTool === 'rect') {
            minX = Math.min(startCutPos.x, endCutPos.x);
            minY = Math.min(startCutPos.y, endCutPos.y);
            w = Math.max(10, Math.abs(endCutPos.x - startCutPos.x));
            h = Math.max(10, Math.abs(endCutPos.y - startCutPos.y));
          }

          if (w > 5 && h > 5) {
            saveStateToHistory();

            floatingCanvas.width = w;
            floatingCanvas.height = h;
            floatingCanvas.style.width = w + 'px';
            floatingCanvas.style.height = h + 'px';

            floatingPos = { x: minX, y: minY };
            floatingCanvas.style.left = minX + 'px';
            floatingCanvas.style.top = minY + 'px';

            const fCtx = floatingCanvas.getContext('2d');
            fCtx.clearRect(0, 0, w, h);

            if (activeTool === 'lasso' || activeTool === 'poly') {
              fCtx.beginPath();
              lassoPoints.forEach((p, idx) => {
                if (idx === 0) fCtx.moveTo(p.x - minX, p.y - minY);
                else fCtx.lineTo(p.x - minX, p.y - minY);
              });
              fCtx.closePath();
              fCtx.clip();
              fCtx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);

              // Erase original area from main canvas
              ctx.save();
              ctx.beginPath();
              lassoPoints.forEach((p, idx) => {
                if (idx === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
              });
              ctx.closePath();
              ctx.clip();
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.restore();
            } else {
              // Rectangle Cut
              fCtx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(minX, minY, w, h);
            }

            t.canvasData = canvas.toDataURL();
            floatingCanvas.style.display = 'block';

            clippedCanvas = floatingCanvas;

            activeCanvasStudio = {
              hasSelection: true,
              hasClipboard: true,
              copy: () => {
                showToast('📋 האזור הועתק (Ctrl+C)');
                pasteBtn.disabled = false;
              },
              cut: () => {
                showToast('✂️ האזור נגזר (Ctrl+X)');
                pasteBtn.disabled = false;
              },
              paste: () => {
                if (!clippedCanvas) return;
                saveStateToHistory();
                ctx.drawImage(floatingCanvas, floatingPos.x, floatingPos.y);
                t.canvasData = canvas.toDataURL();
                showToast('📌 הודבק מחדש (Ctrl+V)');
              },
              deleteSelection: () => {
                saveStateToHistory();
                if (activeTool === 'lasso' || activeTool === 'poly') {
                  ctx.save();
                  ctx.beginPath();
                  lassoPoints.forEach((p, idx) => {
                    if (idx === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                  });
                  ctx.closePath();
                  ctx.clip();
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.restore();
                } else {
                  // Rectangle Cut or floating canvas area
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(floatingPos.x, floatingPos.y, floatingCanvas.width || 10, floatingCanvas.height || 10);
                }
                floatingCanvas.style.display = 'none';
                clippedCanvas = null;
                activeCanvasStudio = null;
                t.canvasData = canvas.toDataURL();
                showToast('🗑️ החלק המסומן נמחק (Backspace)');
              }
            };

            pasteBtn.disabled = false;
            showToast('✂️ גזרת את האזור! הקו המקווקו צמוד לאובייקט - גלול וגורר אותו בחופשיות');
          }
        }
      }

      canvas.addEventListener('mousedown', startAction);
      canvas.addEventListener('mousemove', moveAction);
      canvas.addEventListener('mouseup', stopAction);
      canvas.addEventListener('mouseleave', stopAction);

      canvas.addEventListener('touchstart', startAction);
      canvas.addEventListener('touchmove', moveAction);
      canvas.addEventListener('touchend', stopAction);

      clearCanvasBtn.addEventListener('click', () => {
        saveStateToHistory();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        floatingCanvas.style.display = 'none';
        t.canvasData = null;
        activeCanvasStudio = null;
      });
    }, 50);

    body.appendChild(canvasCard);
  }

  container.appendChild(body);
}

let db = null;
let storage = null;
let currentUser = null;
let currentSyncKey = null;
let cloudUnsubscribe = null;
let isReceivingCloudUpdate = false;
let cloudSaveTimeout = null;
let authMode = 'login'; // 'login' | 'register'
let myDeviceId = localStorage.getItem('allmylifeishere_deviceId');
if (!myDeviceId) {
  myDeviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
  try {
    localStorage.setItem('allmylifeishere_deviceId', myDeviceId);
  } catch (e) {}
}

// Cookie Helpers
function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

function deleteCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

function initCloudSync() {
  // 1. Check existing logged-in user session from localStorage or Cookies
  const savedUserStr = localStorage.getItem('allmylifeishere_user') || getCookie('allmylifeishere_user');
  if (savedUserStr) {
    try {
      currentUser = JSON.parse(savedUserStr);
    } catch (e) {
      currentUser = null;
    }
  }

  // Determine user sync key
  if (currentUser && currentUser.email) {
    const rawKey = currentUser.email.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    currentSyncKey = 'USER-' + rawKey;
  } else {
    currentSyncKey = null;
    tables = [];
    events = [];
    deletedTables = [];
  }

  // Initialize Firebase Firestore & Storage if compat SDK is loaded
  if (typeof firebase !== 'undefined') {
    const firebaseConfig = {
      apiKey: "AIzaSyCT6Tk884WLgg9Vsr49rVorU3UqfpGwUIs",
      authDomain: "allmylifeishere.firebaseapp.com",
      projectId: "allmylifeishere",
      storageBucket: "allmylifeishere.firebasestorage.app",
      messagingSenderId: "300520905889",
      appId: "1:300520905889:web:239c487f5a2d021a1a64e0",
      measurementId: "G-2NKC6E8M77"
    };

    if (!firebase.apps.length) {
      try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        try {
          db.settings({ experimentalForceLongPolling: true });
        } catch (e) {
          console.warn('Long polling setting notice:', e);
        }
        if (firebase.storage) storage = firebase.storage();
      } catch (err) {
        console.warn('Firebase init warning:', err);
      }
    } else {
      db = firebase.firestore();
      try {
        db.settings({ experimentalForceLongPolling: true });
      } catch (e) {
        console.warn('Long polling setting notice:', e);
      }
      if (firebase.storage) storage = firebase.storage();
    }

    if (firebase.auth) {
      try {
        if (!firebase.auth().currentUser && !currentUser) {
          firebase.auth().signInAnonymously().catch(e => console.warn('Anon auth notice:', e));
        }
      } catch (e) {}
    }
  }

  setupAuthListeners();
  setupSyncModalListeners();
  setupShareModalListeners();

  updateUserProfileUI();

  if (currentUser && currentSyncKey) {
    loadBackupFromLocalStorage();
    subscribeToCloudUpdates();
  } else {
    updateSyncStatusBadge('local');
    renderFilteredTables();
    renderGridRows();
  }
}

function updateUserProfileUI() {
  const profileBadge = document.getElementById('userProfileBadge');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const loginNavBtn = document.getElementById('loginNavBtn');

  if (currentUser) {
    if (userNameDisplay) userNameDisplay.textContent = currentUser.name || currentUser.email.split('@')[0];
    if (profileBadge) profileBadge.classList.remove('hidden');
    if (loginNavBtn) loginNavBtn.classList.add('hidden');
  } else {
    if (profileBadge) profileBadge.classList.add('hidden');
    if (loginNavBtn) loginNavBtn.classList.remove('hidden');
  }
}

function openAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.remove('hidden');
    authModal.setAttribute('aria-hidden', 'false');
  }
}

function closeAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.add('hidden');
    authModal.setAttribute('aria-hidden', 'true');
  }
}

function setupAuthListeners() {
  const authModal = document.getElementById('authModal');
  const authTabLogin = document.getElementById('authTabLogin');
  const authTabRegister = document.getElementById('authTabRegister');
  const authForm = document.getElementById('authForm');
  const authNameGroup = document.getElementById('authNameGroup');
  const authNameInput = document.getElementById('authNameInput');
  const authEmailInput = document.getElementById('authEmailInput');
  const authPasswordInput = document.getElementById('authPasswordInput');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginNavBtn = document.getElementById('loginNavBtn');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');

  if (loginNavBtn) {
    loginNavBtn.addEventListener('click', openAuthModal);
  }

  if (closeAuthModalBtn) {
    closeAuthModalBtn.addEventListener('click', closeAuthModal);
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  if (authTabLogin) {
    authTabLogin.addEventListener('click', () => {
      authMode = 'login';
      authTabLogin.className = 'btn btn-sm btn-primary';
      authTabRegister.className = 'btn btn-sm btn-secondary';
      if (authNameGroup) authNameGroup.classList.add('hidden');
      if (authSubmitBtn) authSubmitBtn.textContent = '🚀 כניסה למערכת';
    });
  }

  if (authTabRegister) {
    authTabRegister.addEventListener('click', () => {
      authMode = 'register';
      authTabRegister.className = 'btn btn-sm btn-primary';
      authTabLogin.className = 'btn btn-sm btn-secondary';
      if (authNameGroup) authNameGroup.classList.remove('hidden');
      if (authSubmitBtn) authSubmitBtn.textContent = '✨ יצירת חשבון חדש';
    });
  }

  const googleAuthBtn = document.getElementById('googleAuthBtn');
  if (googleAuthBtn) {
    googleAuthBtn.addEventListener('click', () => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then((result) => {
          const user = result.user;
          const userObj = {
            id: user.uid,
            email: user.email,
            name: user.displayName || user.email.split('@')[0],
            photo: user.photoURL,
            loggedInAt: new Date().toISOString()
          };
          loginUserSession(userObj);
        }).catch((err) => {
          console.warn('Firebase Google Auth popup warning, switching to direct prompt:', err);
          promptGoogleFallbackLogin();
        });
      } else {
        promptGoogleFallbackLogin();
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      if (e) e.preventDefault();
      handleAuthSubmit();
    });
  }

  if (authSubmitBtn) {
    const doSubmit = (e) => {
      if (e) e.preventDefault();
      handleAuthSubmit();
    };
    authSubmitBtn.addEventListener('click', doSubmit);
    authSubmitBtn.addEventListener('touchend', doSubmit);
  }

  [authEmailInput, authPasswordInput, authNameInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (e) e.preventDefault();
          handleAuthSubmit();
        }
      });
    }
  });

function safeBase64Encode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str))).replace(/=/g, '');
  } catch (e) {
    return encodeURIComponent(str).replace(/%/g, '_');
  }
}

function promptGoogleFallbackLogin() {
  const userEmail = prompt('הזן את אימייל ה-Google שלך להתחברות מהירה (Google Sign-In):', 'ziv@gmail.com');
  if (userEmail && userEmail.trim()) {
    const email = userEmail.trim().toLowerCase();
    const userName = email.split('@')[0];
    const userObj = {
      id: 'usr_g_' + safeBase64Encode(email),
      email: email,
      name: userName.charAt(0).toUpperCase() + userName.slice(1),
      loggedInAt: new Date().toISOString()
    };
    loginUserSession(userObj);
  }
}

function loginUserSession(userObj) {
  if (cloudUnsubscribe) {
    cloudUnsubscribe();
    cloudUnsubscribe = null;
  }

  // Pure state reset so NO previous user data remains in memory
  tables = [];
  events = [];
  deletedTables = [];
  permanentlyDeletedIds = [];
  isReceivingCloudUpdate = false;

  currentUser = userObj;
  try {
    const userJsonStr = JSON.stringify(userObj);
    localStorage.setItem('allmylifeishere_user', userJsonStr);
    try { setCookie('allmylifeishere_user', userJsonStr, 365); } catch (e) {}
  } catch (err) {
    console.warn('LocalStorage save notice:', err);
  }

  const rawKey = userObj.email.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  currentSyncKey = 'USER-' + rawKey;
  try {
    localStorage.setItem('allmylifeishere_syncKey', currentSyncKey);
  } catch (e) {}

  updateUserProfileUI();
  closeAuthModal();

  loadBackupFromLocalStorage();
  recoverAllPastBoardsFromCloudAndLocal();
  subscribeToCloudUpdates();
  renderHeaderDays();
  renderGridRows();
  renderFilteredTables();
  showToast(`🌐 התחברת בהצלחה, ברוך הבא ${userObj.name}!`);
}

function handleAuthSubmit(e) {
  if (e) e.preventDefault();

  const authEmailInput = document.getElementById('authEmailInput');
  const authPasswordInput = document.getElementById('authPasswordInput');
  const authNameInput = document.getElementById('authNameInput');

  const email = authEmailInput ? authEmailInput.value.trim().toLowerCase() : '';
  const password = authPasswordInput ? authPasswordInput.value.trim() : '';
  const name = authNameInput ? authNameInput.value.trim() : '';

  if (!email || !password) {
    alert('אנא הזן אימייל/שם משתמש וסיסמה!');
    return;
  }

  const displayName = name || email.split('@')[0];
  const userObj = {
    id: 'usr_' + safeBase64Encode(email),
    email: email,
    name: displayName,
    loggedInAt: new Date().toISOString()
  };

  loginUserSession(userObj);
}

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('האם תרצה להתנתק מהחשבון?')) {
        saveStateToHistory();
        saveDataToCloudDirect();
        clearTimeout(cloudSaveTimeout);
        if (cloudUnsubscribe) cloudUnsubscribe();

        currentUser = null;
        currentSyncKey = null;
        localStorage.removeItem('allmylifeishere_user');
        localStorage.removeItem('allmylifeishere_syncKey');
        deleteCookie('allmylifeishere_user');

        tables = [];
        events = [];
        deletedTables = [];

        updateUserProfileUI();
        updateSyncStatusBadge('local');
        renderHeaderDays();
        renderGridRows();
        renderFilteredTables();
        openAuthModal();
        showToast('🚪 התנתקת בהצלחה מהחשבון');
      }
    });
  }
}

function updateSyncStatusBadge(status) {
  const dot = document.getElementById('syncStatusDot');
  const text = document.getElementById('syncStatusText');
  if (!dot || !text) return;

  if (status === 'uploading') {
    dot.textContent = '🟡';
    text.textContent = 'מסנכרן לענן...';
  } else if (status === 'connecting') {
    dot.textContent = '🔵';
    text.textContent = 'מתחבר לענן...';
  } else if (status === 'synced') {
    dot.textContent = '🟢';
    text.textContent = 'סנכרון ענן (מחובר)';
  } else if (status === 'local') {
    dot.textContent = '💾';
    text.textContent = 'אחסון מקומי (GitHub Pages)';
  } else if (status === 'offline') {
    dot.textContent = '🟠';
    text.textContent = 'מצב אופליין';
  }
}

// ==========================================
// TABLE SHARING ENGINE (👥 שיתוף טבלאות)
// ==========================================
let activeSharingTable = null;
let sharedTablesUnsubscribe = null;

function setupShareModalListeners() {
  const shareModal = document.getElementById('shareModal');
  const closeShareModalBtn = document.getElementById('closeShareModalBtn');
  const shareUserForm = document.getElementById('shareUserForm');
  const shareEmailInput = document.getElementById('shareEmailInput');

  if (closeShareModalBtn) {
    closeShareModalBtn.addEventListener('click', closeShareModal);
  }

  if (shareModal) {
    shareModal.addEventListener('click', (e) => {
      if (e.target === shareModal) closeShareModal();
    });
  }

  if (shareUserForm) {
    shareUserForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeSharingTable) return;
      const email = shareEmailInput.value.trim().toLowerCase();
      if (!email) return;

      if (!activeSharingTable.sharedWith) activeSharingTable.sharedWith = [];
      if (activeSharingTable.sharedWith.includes(email)) {
        alert('האימייל כבר מופיע ברשימת השותפים בטבלה זו!');
        return;
      }

      saveStateToHistory();
      activeSharingTable.sharedWith.push(email);
      activeSharingTable.isShared = true;
      if (currentUser && currentUser.email) {
        activeSharingTable.ownerEmail = currentUser.email.toLowerCase();
      }

      shareEmailInput.value = '';
      renderSharedUsersList();
      renderFilteredTables();
      saveDataToCloud();
      showToast(`👥 הטבלה שותפה בהצלחה עם ${email}!`);
    });
  }
}

function openShareModal(t) {
  activeSharingTable = t;
  const modal = document.getElementById('shareModal');
  const title = document.getElementById('shareModalTitle');
  if (title) title.textContent = `👥 שיתוף טבלה: "${t.title}"`;
  renderSharedUsersList();
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  activeSharingTable = null;
}

function renderSharedUsersList() {
  const container = document.getElementById('sharedUsersList');
  if (!container || !activeSharingTable) return;
  container.innerHTML = '';

  const sharedWith = activeSharingTable.sharedWith || [];
  if (sharedWith.length === 0) {
    container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">אין שותפים בטבלה זו עדיין.</p>`;
    return;
  }

  sharedWith.forEach(email => {
    const item = document.createElement('div');
    item.className = 'shared-user-item';
    item.innerHTML = `
      <span>👤 ${email}</span>
      <button type="button" class="btn btn-sm btn-icon" style="color:#ef4444;" title="הסר שותף">&times;</button>
    `;
    item.querySelector('button').addEventListener('click', () => {
      saveStateToHistory();
      activeSharingTable.sharedWith = activeSharingTable.sharedWith.filter(e => e !== email);
      if (activeSharingTable.sharedWith.length === 0) {
        activeSharingTable.isShared = false;
      }
      renderSharedUsersList();
      renderFilteredTables();
      saveDataToCloud();
      showToast(`🗑️ השותף ${email} הוסר מהטבלה`);
    });
    container.appendChild(item);
  });
}

function exportBackupJSON() {
  const backupData = {
    tables: tables,
    events: events,
    deletedTables: deletedTables,
    completedTasksHistory: (typeof completedTasksHistory !== 'undefined') ? completedTasksHistory : [],
    exportedAt: new Date().toISOString(),
    appVersion: "1.0"
  };
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `AllMyLifeIsHere_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('💾 קובץ הגיבוי הורד בהצלחה למכשיר שלך!');
}

function importBackupJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && (data.tables || data.events)) {
        saveStateToHistory();
        if (data.tables && Array.isArray(data.tables)) tables = data.tables;
        if (data.events && Array.isArray(data.events)) events = data.events;
        if (data.deletedTables && Array.isArray(data.deletedTables)) deletedTables = data.deletedTables;
        if (data.completedTasksHistory && Array.isArray(data.completedTasksHistory)) completedTasksHistory = data.completedTasksHistory;

        saveStateToLocalStorage();
        renderHeaderDays();
        renderGridRows();
        renderFilteredTables();
        saveDataToCloud();
        showToast('📂 קובץ הגיבוי נטען בהצלחה והלוחות שוחזרו!');
      } else {
        alert('קובץ הגיבוי אינו תקין!');
      }
    } catch (err) {
      alert('שגיאה בקריאת קובץ הגיבוי!');
    }
  };
  reader.readAsText(file);
}

function sanitizeForFirestore(obj) {
  try {
    const jsonStr = JSON.stringify(obj, (key, value) => {
      if (value === undefined) return null;
      return value;
    });
    const parsed = JSON.parse(jsonStr);

    const convertNestedArrays = (target) => {
      if (!target || typeof target !== 'object') return target;

      if (Array.isArray(target)) {
        return target.map(item => {
          if (Array.isArray(item)) {
            // Convert 2D array row to object wrapper: ["a","b"] -> { cells: ["a","b"] }
            return { cells: item.map(subItem => convertNestedArrays(subItem)) };
          }
          return convertNestedArrays(item);
        });
      }

      for (const k in target) {
        if (Object.prototype.hasOwnProperty.call(target, k)) {
          target[k] = convertNestedArrays(target[k]);
        }
      }
      return target;
    };

    return convertNestedArrays(parsed);
  } catch (e) {
    return obj;
  }
}

function restoreFromFirestoreSanitization(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (item && typeof item === 'object' && Array.isArray(item.cells)) {
        // Restore object wrapper back to 2D array row: { cells: ["a","b"] } -> ["a","b"]
        return item.cells.map(c => restoreFromFirestoreSanitization(c));
      }
      return restoreFromFirestoreSanitization(item);
    });
  }

  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      obj[k] = restoreFromFirestoreSanitization(obj[k]);
    }
  }
  return obj;
}

function saveDataToCloudDirect() {
  clearTimeout(cloudSaveTimeout);
  saveStateToLocalStorage();
  if (!db || isReceivingCloudUpdate || !currentSyncKey) return;

  updateSyncStatusBadge('uploading');
  try {
    const timestamp = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date().toISOString();

    const boardDoc = sanitizeForFirestore({
      tables: tables,
      events: events,
      deletedTables: deletedTables,
      permanentlyDeletedIds: permanentlyDeletedIds,
      subCategoriesByTab: subCategoriesByTab,
      completedTasksHistory: (typeof completedTasksHistory !== 'undefined' && Array.isArray(completedTasksHistory)) ? completedTasksHistory : [],
      updatedAt: timestamp,
      lastDeviceId: myDeviceId
    });

    db.collection('boards').doc(currentSyncKey).set(boardDoc, { merge: true })
      .then(() => {
        updateSyncStatusBadge('synced');
      })
      .catch(err => {
        console.warn('Firestore save warning:', err);
        updateSyncStatusBadge('local');
      });

    tables.forEach(t => {
      if (t.sharedWith && t.sharedWith.length > 0) {
        const sharedDoc = sanitizeForFirestore({
          ...t,
          ownerEmail: (currentUser && currentUser.email) ? currentUser.email.toLowerCase() : 'anon',
          sharedWith: t.sharedWith.map(e => e.toLowerCase()),
          updatedAt: timestamp,
          lastDeviceId: myDeviceId
        });
        db.collection('sharedTables').doc(t.id).set(sharedDoc, { merge: true }).catch(e => console.warn('Shared table save warning:', e));
      }
    });
  } catch (err) {
    console.warn('Direct cloud save error:', err);
  }
}

function saveDataToCloud() {
  saveStateToLocalStorage();
  if (!db || isReceivingCloudUpdate) return;

  clearTimeout(cloudSaveTimeout);
  cloudSaveTimeout = setTimeout(() => {
    saveDataToCloudDirect();
  }, 250);
}

// 100% Background Heartbeat Auto-Saver (Every 5 seconds)
setInterval(() => {
  if (db && currentSyncKey && !isReceivingCloudUpdate) {
    saveDataToCloud();
  }
}, 5000);

// Page exit / navigation auto-saver
window.addEventListener('beforeunload', () => {
  saveStateToLocalStorage();
  if (db && currentSyncKey && !isReceivingCloudUpdate) {
    try {
      const boardDoc = {
        tables: JSON.parse(JSON.stringify(tables)),
        events: JSON.parse(JSON.stringify(events)),
        deletedTables: JSON.parse(JSON.stringify(deletedTables))
      };
      db.collection('boards').doc(currentSyncKey).set(boardDoc, { merge: true });
    } catch (e) {}
  }
});

function recoverAllPastBoardsFromCloudAndLocal() {
  if (!db || !currentUser || !currentSyncKey) return;

  let recoveredTablesCount = 0;
  let recoveredEventsCount = 0;

  db.collection('boards').doc(currentSyncKey).get().then(doc => {
    if (doc.exists) {
      const data = restoreFromFirestoreSanitization(doc.data());
      if (data) {
        if (data.permanentlyDeletedIds && Array.isArray(data.permanentlyDeletedIds)) {
          data.permanentlyDeletedIds.forEach(id => {
            if (!permanentlyDeletedIds.includes(id)) permanentlyDeletedIds.push(id);
          });
        }
        if (data.deletedTables && Array.isArray(data.deletedTables)) {
          data.deletedTables.forEach(t => {
            if (!permanentlyDeletedIds.includes(t.id)) {
              let existing = tables.find(tbl => tbl.id === t.id);
              if (!existing) {
                t.isArchived = true;
                tables.push(t);
              }
            }
          });
        }
        if (data.tables && Array.isArray(data.tables)) {
          data.tables.forEach(t => {
            if (!permanentlyDeletedIds.includes(t.id) && !tables.some(existing => existing.id === t.id)) {
              tables.push(t);
              recoveredTablesCount++;
            }
          });
        }
        if (data.events && Array.isArray(data.events)) {
          data.events.forEach(ev => {
            if (!events.some(existing => existing.id === ev.id)) {
              events.push(ev);
              recoveredEventsCount++;
            }
          });
        }
      }
    }

    const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
    if (userEmail) {
      db.collection('sharedTables').where('sharedWith', 'array-contains', userEmail).get().then(sSnap => {
        sSnap.forEach(doc => {
          const t = restoreFromFirestoreSanitization(doc.data());
          if (t && t.id && !deletedTables.some(d => d.id === t.id) && !permanentlyDeletedIds.includes(t.id) && !tables.some(existing => existing.id === t.id)) {
            tables.push(t);
            recoveredTablesCount++;
          }
        });

        if (recoveredTablesCount > 0 || recoveredEventsCount > 0) {
          saveStateToLocalStorage();
          renderHeaderDays();
          renderGridRows();
          renderFilteredTables();
        }
      }).catch(err => {
        console.warn('Shared tables query notice:', err);
      });
    } else if (recoveredTablesCount > 0 || recoveredEventsCount > 0) {
      saveStateToLocalStorage();
      renderHeaderDays();
      renderGridRows();
      renderFilteredTables();
    }
  }).catch(err => {
    console.warn('User board recovery notice:', err);
  });
}

function mergeTablesSmart(cloudTables, localTables, deletedIds) {
  const tableMap = new Map();
  const delSet = (deletedIds instanceof Set) ? deletedIds : new Set((deletedIds || []).map(d => d.id || d));

  // 1. Add local tables first
  (localTables || []).forEach(lt => {
    if (lt && lt.id && !delSet.has(lt.id)) {
      tableMap.set(lt.id, JSON.parse(JSON.stringify(lt)));
    }
  });

  // 2. Merge cloud tables
  (cloudTables || []).forEach(ct => {
    if (!ct || !ct.id || delSet.has(ct.id)) return;

    if (!tableMap.has(ct.id)) {
      tableMap.set(ct.id, JSON.parse(JSON.stringify(ct)));
    } else {
      const existingLocal = tableMap.get(ct.id);

      // Merge items for checkboxes
      if (ct.type === 'checkboxes' && Array.isArray(ct.items)) {
        const itemMap = new Map();
        (existingLocal.items || []).forEach(item => itemMap.set(item.id, item));
        ct.items.forEach(item => itemMap.set(item.id, item));
        existingLocal.items = Array.from(itemMap.values());
      }

      // Merge customGrid (rows & columns)
      if (ct.type === 'customGrid' && Array.isArray(ct.gridData)) {
        const localGridHasData = existingLocal.gridData && existingLocal.gridData.some(r => Array.isArray(r) && r.some(c => c && String(c).trim() !== ''));
        const cloudGridHasData = ct.gridData.some(r => Array.isArray(r) && r.some(c => c && String(c).trim() !== ''));
        if (cloudGridHasData || !localGridHasData) {
          existingLocal.gridData = ct.gridData;
        }
      }

      if (ct.weeklyData) {
        existingLocal.weeklyData = {
          ...(existingLocal.weeklyData || {}),
          ...ct.weeklyData
        };
      }

      tableMap.set(ct.id, existingLocal);
    }
  });

  return Array.from(tableMap.values());
}

function subscribeToCloudUpdates() {
  if (!db) {
    updateSyncStatusBadge('local');
    return;
  }

  // Auto-scan past cloud backups if local tables are currently empty
  if (tables.length === 0) {
    recoverAllPastBoardsFromCloudAndLocal();
  }

  if (cloudUnsubscribe) cloudUnsubscribe();
  updateSyncStatusBadge('connecting');

  cloudUnsubscribe = db.collection('boards').doc(currentSyncKey).onSnapshot(snapshot => {
    if (!snapshot.exists) {
      updateSyncStatusBadge('synced');
      return;
    }

    const rawData = snapshot.data();
    if (!rawData) {
      updateSyncStatusBadge('synced');
      return;
    }

    // Skip DOM re-render if snapshot originated from our own device write to prevent typing focus loss
    if (rawData.lastDeviceId === myDeviceId) {
      updateSyncStatusBadge('synced');
      return;
    }

    const data = restoreFromFirestoreSanitization(rawData);
    isReceivingCloudUpdate = true;

    // 1. Permanently deleted IDs
    if (data.permanentlyDeletedIds && Array.isArray(data.permanentlyDeletedIds)) {
      data.permanentlyDeletedIds.forEach(id => {
        if (!permanentlyDeletedIds.includes(id)) permanentlyDeletedIds.push(id);
      });
    }

    // Legacy migration: convert any incoming cloud data.deletedTables into tables with isArchived: true
    if (data.deletedTables && Array.isArray(data.deletedTables)) {
      data.deletedTables.forEach(delT => {
        if (!permanentlyDeletedIds.includes(delT.id)) {
          let existing = tables.find(tbl => tbl.id === delT.id);
          if (!existing) {
            delT.isArchived = true;
            tables.push(delT);
          }
        }
      });
    }

    const allDeletedIds = new Set(permanentlyDeletedIds);

    // 2. Merge active tables safely using mergeTablesSmart
    let shouldSyncBackMerged = false;
    if (data.tables && Array.isArray(data.tables)) {
      const merged = mergeTablesSmart(data.tables, tables, allDeletedIds);
      if (merged.length !== tables.length || JSON.stringify(merged) !== JSON.stringify(tables)) {
        tables = merged;
        shouldSyncBackMerged = true;
      }
    } else if (tables.length > 0) {
      shouldSyncBackMerged = true;
    }

    // 3. Merge active events safely
    if (data.events && Array.isArray(data.events)) {
      const mergedEvents = [];
      data.events.forEach(ce => {
        if (!mergedEvents.some(me => me.id === ce.id)) {
          mergedEvents.push(ce);
        }
      });
      events.forEach(le => {
        if (!mergedEvents.some(me => me.id === le.id)) {
          mergedEvents.push(le);
          shouldSyncBackMerged = true;
        }
      });
      events = mergedEvents;
    } else if (events.length > 0) {
      shouldSyncBackMerged = true;
    }

    if (data.completedTasksHistory && typeof completedTasksHistory !== 'undefined') {
      completedTasksHistory = data.completedTasksHistory;
    }

    if (data.subCategoriesByTab && typeof data.subCategoriesByTab === 'object') {
      subCategoriesByTab = data.subCategoriesByTab;
    }

    saveStateToLocalStorage();
    renderHeaderDays();
    renderGridRows();
    renderFilteredTables();
    if (document.getElementById('completedTasksModal') && !document.getElementById('completedTasksModal').classList.contains('hidden')) {
      renderCompletedTasksModalContent();
    }
    isReceivingCloudUpdate = false;
    if (shouldSyncBackMerged) {
      saveDataToCloud();
    }
    updateSyncStatusBadge('synced');
  }, err => {
    console.warn('Firestore snapshot listener warning:', err);
    updateSyncStatusBadge('synced');
  });

  // Also subscribe to shared tables where currentUser is a collaborator!
  if (currentUser && currentUser.email && db) {
    if (sharedTablesUnsubscribe) sharedTablesUnsubscribe();
    try {
      sharedTablesUnsubscribe = db.collection('sharedTables')
        .where('sharedWith', 'array-contains', currentUser.email.toLowerCase())
        .onSnapshot(sharedSnap => {
          if (!sharedSnap || sharedSnap.empty) return;
          let hasChanges = false;
          sharedSnap.forEach(docSnap => {
            const sharedTableData = docSnap.data();
            if (sharedTableData) {
              const existingIdx = tables.findIndex(tbl => tbl.id === sharedTableData.id);
              if (existingIdx !== -1) {
                tables[existingIdx] = sharedTableData;
              } else {
                tables.push(sharedTableData);
              }
              hasChanges = true;
            }
          });
          if (hasChanges) {
            saveStateToLocalStorage();
            renderFilteredTables();
          }
        }, err => console.warn('Shared tables listener warning:', err));
    } catch (e) {
      console.warn('Shared tables subscription warning:', e);
    }
  }
}

function setupSyncModalListeners() {
  const syncModalBtn = document.getElementById('syncModalBtn');
  const syncModal = document.getElementById('syncModal');
  const closeSyncModalBtn = document.getElementById('closeSyncModalBtn');
  const currentSyncKeyDisplay = document.getElementById('currentSyncKeyDisplay');
  const copySyncKeyBtn = document.getElementById('copySyncKeyBtn');
  const connectSyncForm = document.getElementById('connectSyncForm');
  const targetSyncKeyInput = document.getElementById('targetSyncKeyInput');

  if (syncModalBtn) {
    syncModalBtn.addEventListener('click', () => {
      if (currentSyncKeyDisplay) currentSyncKeyDisplay.textContent = currentSyncKey;
      syncModal.classList.remove('hidden');
      syncModal.setAttribute('aria-hidden', 'false');
    });
  }

  if (closeSyncModalBtn) {
    closeSyncModalBtn.addEventListener('click', () => {
      syncModal.classList.add('hidden');
      syncModal.setAttribute('aria-hidden', 'true');
    });
  }

  if (copySyncKeyBtn) {
    copySyncKeyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(currentSyncKey).then(() => {
        showToast('📋 קוד הסנכרון הועתק ללוח!');
      }).catch(() => {
        showToast(`קוד הסנכרון שלך: ${currentSyncKey}`);
      });
    });
  }

  if (connectSyncForm) {
    connectSyncForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetKey = targetSyncKeyInput.value.toUpperCase().trim();
      if (targetKey) {
        currentSyncKey = targetKey;
        localStorage.setItem('allmylifeishere_syncKey', currentSyncKey);
        if (currentSyncKeyDisplay) currentSyncKeyDisplay.textContent = currentSyncKey;
        subscribeToCloudUpdates();
        showToast(`🔗 התחברת בהצלחה ללוח ${currentSyncKey}!`);
        syncModal.classList.add('hidden');
        syncModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  const emergencyRecoveryBtn = document.getElementById('emergencyRecoveryBtn');
  if (emergencyRecoveryBtn) {
    emergencyRecoveryBtn.addEventListener('click', () => {
      recoverAllPastBoardsFromCloudAndLocal();
    });
  }

  const exportBackupBtn = document.getElementById('exportBackupBtn');
  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', exportBackupJSON);
  }

  const importBackupFileInput = document.getElementById('importBackupFileInput');
  if (importBackupFileInput) {
    importBackupFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importBackupJSON(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  const connectGoogleIcalForm = document.getElementById('connectGoogleIcalForm');
  const googleIcalUrlInput = document.getElementById('googleIcalUrlInput');
  const clearGoogleIcalBtn = document.getElementById('clearGoogleIcalBtn');

  if (googleIcalUrl) {
    if (googleIcalUrlInput) googleIcalUrlInput.value = googleIcalUrl;
    fetchGoogleICSFeed(googleIcalUrl);
  }

  if (connectGoogleIcalForm) {
    connectGoogleIcalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = googleIcalUrlInput.value.trim();
      if (url) {
        fetchGoogleICSFeed(url);
      }
    });
  }

  if (clearGoogleIcalBtn) {
    clearGoogleIcalBtn.addEventListener('click', () => {
      googleEvents = [];
      googleIcalUrl = '';
      localStorage.removeItem('allmylifeishere_google_ical_url');
      if (googleIcalUrlInput) googleIcalUrlInput.value = '';
      const statusEl = document.getElementById('googleIcalStatus');
      if (statusEl) statusEl.classList.add('hidden');
      clearGoogleIcalBtn.classList.add('hidden');
      renderHeaderDays();
      renderGridRows();
      showToast('❌ יומן גוגל נותק בהצלחה!');
    });
  }

  const googleIcsFileInput = document.getElementById('googleIcsFileInput');
  if (googleIcsFileInput) {
    googleIcsFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleGoogleIcsFileUpload(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  const dupGoogleBtn = document.getElementById('duplicateGoogleEventBtn');
  if (dupGoogleBtn) {
    dupGoogleBtn.addEventListener('click', duplicateGoogleEventToLocal);
  }
}

// Auto Initialize Cloud Sync on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCloudSync);
} else {
  initCloudSync();
}
