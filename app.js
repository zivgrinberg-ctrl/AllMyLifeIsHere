
/* ==========================================================================
   החיים של זיו - Application Engine v32.0
   Root Cause Fix: Correct DOM Render Order for Work & Studio Task Lists
   ========================================================================== */

(function () {
    const PRIMARY_STORAGE_KEY = 'ha_chayim_atzmam_data';

    const ALL_OLD_KEYS = [
        'ha_chayim_atzmam_data_v10',
        'ha_chayim_atzmam_data_v9',
        'ha_chayim_atzmam_data_v8',
        'ha_chayim_atzmam_data_v7',
        'ha_chayim_atzmam_data_v6',
        'ha_chayim_atzmam_data_v5',
        'ha_chayim_atzmam_data_v4'
    ];

    const DAYS_HEBREW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    const DEFAULT_CORE_TABS = {
        habits: 'today',
        someday: 'life',
        groceries: 'life',
        debts: 'work',
        weekly: 'work',
        studio: 'work',
        important: 'work',
        reflection: 'work',
        fun: 'fun',
        todayTasks: 'today',
        todayScheduleFeed: 'today',
        todayPhoto: 'today',
        todayDrawing: 'today',
        funScratchpad: 'fun',
        funDrawing: 'fun',
        funPhotos: 'fun'
    };

    const SEED_DATA = {
        headerTitles: {
            weekly: 'משימות לשבוע הקרוב',
            studio: 'משימות לאולפן ולמוזיקה',
            fun: 'קופסת כיף שבועית',
            important: 'חשוב ולא דחוף (פיתוח ועומק)',
            someday: 'משימות שיום אחד אעשה & חזון',
            habits: 'לעשות יום יום!',
            groceries: 'מצרכים & קניות לבית',
            debts: 'כספים שחייבים לי'
        },
        categories: [
            {
                id: 'cat_beit_tefilla',
                type: 'matrix',
                title: 'בית תפילה (אלבום - 14 שירים)',
                tabId: 'work',
                retention: 'fixed',
                icon: 'fa-record-vinyl',
                color: '#8b5cf6',
                columns: ['שם השיר', 'סקיצה/לחן', 'הקלטות תופים', 'שירות', 'מיקס', 'סטטוס'],
                rows: Array.from({ length: 14 }, (_, i) => ({
                    col_0: `שיר ${i + 1}`,
                    col_1: i < 3 ? 'מוכן' : 'בעבודה',
                    col_2: i < 2 ? 'הוקלט' : 'בתכנון',
                    col_3: 'ממתין',
                    col_4: 'טרם',
                    col_5: i === 0 ? ' מוכן למיקס' : ' בפיתוח'
                }))
            }
        ],
        tasks: {
            groceries: [
                { id: 'g1', title: 'לבדוק אם אנה צריכה סבון פנים' },
                { id: 'g2', title: 'סוכר' },
                { id: 'g3', title: 'ביצים' }
            ],
            house_shopping: [
                { id: 'hs1', title: 'נייר טואלט' },
                { id: 'hs2', title: 'סבון כלים' }
            ],
            weekly: [
                { id: 'tw1', title: 'טסט לאוטו', scheduledDateStr: '2026-08-10', scheduledWeekKey: '2026-W33', scheduledDay: 1, scheduledSlot: '10:00 - 11:00', scheduledDuration: 1 },
                { id: 'tw2', title: 'לקבוע שיננית', scheduledDateStr: '2026-08-10', scheduledWeekKey: '2026-W33', scheduledDay: 1, scheduledSlot: '14:00 - 15:00', scheduledDuration: 1 },
                { id: 'tw3', title: 'לשלוח למורג את המסמך הזה' },
                { id: 'tw4', title: 'לקבוע יום הקלטות לנגנים' },
                { id: 'tw5', title: 'לשלם לדבורה ולרשות המיסים' },
                { id: 'tw6', title: 'לפתוח אקסל דומה לרעיונות ליצירה/קידום' },
                { id: 'tw7', title: 'ישיבה על המסמך' },
                { id: 'tw8', title: 'לקבוע לקטני תור לרופאת שיניים' },
                { id: 'tw9', title: 'לנסות לסגור דברים עם עילי להבין מה קורה' }
            ],
            studio: [
                { id: 'ts1', title: 'לשלוח לעתליה את הגרסא של "יום יבוא"' },
                { id: 'ts2', title: 'לשלוח לעתליה ואסטבן את כל הקטעים לפני ששולח לשרון שיקליט תופים' },
                { id: 'ts3', title: 'לבחור שיר עיקרי שאיתו מתחילים את העבודה עם שרון' },
                { id: 'ts4', title: 'להתאמן על הקונטרהבאס!!! ' }
            ],
            fun: [
                { id: 'tf1', title: 'להזמין לארוחת ערב ' },
                { id: 'tf2', title: 'זמן יצירה ופנאי ' },
                { id: 'tf3', title: 'מופע בבית של יובל ', scheduledDateStr: '2026-08-14', scheduledWeekKey: '2026-W33', scheduledDay: 5, scheduledSlot: '18:00 - 19:00', scheduledDuration: 2 }
            ],
            important: [
                { id: 'ti1', title: 'לפתוח אקסל דומה לרעיונות ליצירה/קידום' },
                { id: 'ti2', title: 'לסיים לכתוב מילים לשירים' },
                { id: 'ti3', title: 'לכתוב את הקטע הרביעי להקלטות אורקסטרה' },
                { id: 'ti4', title: 'לקנות קשת לקונטרהבאס' },
                { id: 'ti5', title: 'לחשוב על פרויקט כיפי לאולפן שאינו בית תפילה' },
                { id: 'ti6', title: 'לחשוב על פרויקט עם הקונטרהבאס - אולי לקבוע שיעור אצל אורי' }
            ],
            someday: [
                { id: 'tsd1', title: 'להפיק שירים שמבקשים את זה באינסטגרם' },
                { id: 'tsd2', title: 'להוציא את אוכל רטוב' }
            ]
        },
        habits: [
            { id: 'h1', text: 'לבהות רק לאחר השלמת משימה', checked: false },
            { id: 'h2', text: 'מעבר על הקובץ', checked: false },
            { id: 'h3', text: 'נגינה בקונטרהבאס / כלי', checked: false },
            { id: 'h4', text: 'פעילות ספורטיבית', checked: false },
            { id: 'h5', text: 'עבודת בית כלשהי', checked: false },
            { id: 'h6', text: 'שליחת ווצאפ חברי/משפחתי לאדם כלשהו', checked: false },
            { id: 'h7', text: 'לילה - אין כלים בכיור', checked: false }
        ],
        groceries: [
            { id: 'g1', text: 'לבדוק אם אנה צריכה סבון פנים', done: false },
            { id: 'g2', text: 'סוכר', done: false },
            { id: 'g3', text: 'ביצים', done: false },
            { id: 'g4', text: 'סבון רחצה (מהדורה מתוקה אם יש)', done: false },
            { id: 'g5', text: 'שקיות אשפה', done: false }
        ],
        general_shopping: [
            { id: 'gs1', text: 'מתלה לאמבטיה', done: false },
            { id: 'gs2', text: 'תוש לאנה', done: false },
            { id: 'gs3', text: 'סטרימר', done: false },
            { id: 'gs4', text: 'מקלדת למק / משהו שיהיה נוח לשולחן', done: false }
        ],
        debts: [
            { id: 'd1', name: 'אלי שבלול', amount: 0, notes: 'חוב פתוח', status: 'פתוח' },
            { id: 'd2', name: 'עילי', amount: 800, notes: 'חייב על עבודה/הפקה', status: 'פתוח' }
        ],
        weeklyReflection: 'השבוע פתחנו דרך חדשה לסדר יום חדש! מעניין איך זה יהיה ונקווה לכיף',
        weeklySchedule: {
            '08:00 - 09:00': {},
            '09:00 - 10:00': {},
            '10:00 - 11:00': {},
            '11:00 - 12:00': {},
            '12:00 - 13:00': {},
            '13:00 - 14:00': {},
            '14:00 - 15:00': {},
            '15:00 - 16:00': {},
            '16:00 - 17:00': {},
            '17:00 - 18:00': {},
            '18:00 - 19:00': {},
            '19:00 - 20:00': {},
            '20:00 - 21:00': {},
            '21:00 - 22:00': {},
            '22:00 - 23:00': {},
            '23:00 - 00:00': {}
        },
        completedArchive: []
    };

    let appData = loadData();
    let currentDate = new Date();
    let currentWeekKey = getWeekKey(currentDate);
    let draggedTaskInfo = null;
    let activeSchedTaskInfo = null;

        document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initWeekNavigator();
        initGoogleCalendarHandlers();
        initModals();
        initDynamicActions();
        initDragAndDropListeners();
        initFunScratchpad();
        initFunCanvas();
        initTodayCanvas();

        fetch('http://localhost:8080/api/load')
            .then(res => res.json())
            .then(diskData => {
                if (diskData && typeof diskData === 'object' && (diskData.categories || diskData.weeks)) {
                    appData = sanitizeAppData(diskData);
                    try {
                        localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(appData));
                        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(appData));
                    } catch (e) {}
                }
            })
            .catch(err => {
                console.warn('Disk load fallback to localStorage', err);
            })
            .finally(() => {
                ensureWeekData(currentWeekKey);
                checkDailyAutoPurge();
                renderAll();
                try { window.switchSubTab('subtab-all'); } catch(e){}
            });
    });

    function getWeekKey(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }

    function getSundayOfWeek(d) {
        const current = new Date(d);
        const day = current.getDay();
        const sunday = new Date(current);
        sunday.setDate(current.getDate() - day);
        return sunday;
    }

    function getWeekDateRange(d) {
        const sunday = getSundayOfWeek(d);
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);

        const format = (dt) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
        return `שבוע ${getWeekKey(d).split('-W')[1]} (${format(sunday)} - ${format(saturday)})`;
    }

        function sanitizeAppData(parsed) {
        if (!parsed.headerTitles) parsed.headerTitles = JSON.parse(JSON.stringify(SEED_DATA.headerTitles));
                if (!parsed.categories || parsed.categories.length === 0) {
            parsed.categories = JSON.parse(JSON.stringify(SEED_DATA.categories));
        } else {
            if (!parsed.categories.some(c => c.id === 'groceries')) {
                parsed.categories.push({ id: 'groceries', type: 'list', title: 'מצרכים', tabId: 'life', retention: 'rollover', color: '#10b981' });
            }
            if (!parsed.categories.some(c => c.id === 'house_shopping')) {
                parsed.categories.push({ id: 'house_shopping', type: 'list', title: 'קניות לבית', tabId: 'life', retention: 'rollover', color: '#3b82f6' });
            }
        }
        if (!parsed.coreTableTabs) parsed.coreTableTabs = JSON.parse(JSON.stringify(DEFAULT_CORE_TABS));
        if (!parsed.cardWidths) parsed.cardWidths = {};
        if (!parsed.cardOrders) parsed.cardOrders = {};
        if (!parsed.weeks) parsed.weeks = {};
        return parsed;
    }

    function loadData() {
        // 1. Primary Source of Truth: Always prioritize PRIMARY_STORAGE_KEY
        const primaryRaw = localStorage.getItem(PRIMARY_STORAGE_KEY);
        if (primaryRaw) {
            try {
                const parsed = JSON.parse(primaryRaw);
                if (parsed && typeof parsed === 'object' && parsed.weeks && Object.keys(parsed.weeks).length > 0) {
                    return sanitizeAppData(parsed);
                }
            } catch (e) {}
        }

        // 2. Legacy Fallback only if PRIMARY_STORAGE_KEY is completely empty
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
            try {
                const parsed = JSON.parse(legacyRaw);
                if (parsed && typeof parsed === 'object' && parsed.weeks) {
                    return sanitizeAppData(parsed);
                }
            } catch (e) {}
        }

        // 3. SEED_DATA Fallback
        const initialWeekKey = getWeekKey(new Date());
        const data = {
            headerTitles: JSON.parse(JSON.stringify(SEED_DATA.headerTitles)),
            categories: JSON.parse(JSON.stringify(SEED_DATA.categories)),
            coreTableTabs: JSON.parse(JSON.stringify(DEFAULT_CORE_TABS)),
            cardWidths: {},
            cardOrders: {},
            weeks: {}
        };
        data.weeks[initialWeekKey] = JSON.parse(JSON.stringify(SEED_DATA));
        return data;
    }

    function saveData() {
        try {
            localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(appData));
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {}

        renderStats();

        try {
            fetch('http://localhost:8080/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appData)
            }).catch(() => {});
        } catch (e) {}
    }

    function ensureWeekData(weekKey) {
        if (!appData.weeks) appData.weeks = {};
        if (!appData.weeks[weekKey]) {
            const weekKeys = Object.keys(appData.weeks).sort();
            const prevWeekKey = weekKeys.length ? weekKeys[weekKeys.length - 1] : null;

            const newWeek = JSON.parse(JSON.stringify(SEED_DATA));
            if (prevWeekKey && appData.weeks[prevWeekKey]) {
                const prevWeek = appData.weeks[prevWeekKey];
                newWeek.tasks = JSON.parse(JSON.stringify(prevWeek.tasks || SEED_DATA.tasks));

                (appData.categories || []).forEach(cat => {
                    const retentionMode = cat.retention || 'rollover';
                    if (retentionMode === 'reset' || retentionMode === 'daily_delete') {
                        newWeek.tasks[cat.id] = [];
                    } else if (retentionMode === 'fixed') {
                        newWeek.tasks[cat.id] = JSON.parse(JSON.stringify((prevWeek.tasks && prevWeek.tasks[cat.id]) ? prevWeek.tasks[cat.id] : []));
                    }
                });
                
                const newSchedule = {};
                for (let slot in prevWeek.weeklySchedule || SEED_DATA.weeklySchedule) {
                    newSchedule[slot] = {};
                    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                        const item = (prevWeek.weeklySchedule && prevWeek.weeklySchedule[slot]) ? prevWeek.weeklySchedule[slot][dayIdx] : null;
                        if (item && (item.isFixed || (typeof item === 'object' && item.isFixed))) {
                            newSchedule[slot][dayIdx] = JSON.parse(JSON.stringify(item));
                        }
                    }
                }
                newWeek.weeklySchedule = newSchedule;

                newWeek.groceries = JSON.parse(JSON.stringify((prevWeek.groceries || SEED_DATA.groceries).filter(g => !g.done)));
                newWeek.general_shopping = JSON.parse(JSON.stringify((prevWeek.general_shopping || SEED_DATA.general_shopping).filter(g => !g.done)));
                newWeek.debts = JSON.parse(JSON.stringify((prevWeek.debts || SEED_DATA.debts).filter(d => d.status !== 'שולם')));
                newWeek.habits = JSON.parse(JSON.stringify((prevWeek.habits && prevWeek.habits.length > 0) ? prevWeek.habits.map(h => ({ ...h, checked: false })) : SEED_DATA.habits));
            } else {
                newWeek.habits = JSON.parse(JSON.stringify(SEED_DATA.habits));
            }
            newWeek.completedArchive = [];
            appData.weeks[weekKey] = newWeek;
            saveData();
        } else {
            // Guarantee habits exists on existing week object
            if (!appData.weeks[weekKey].habits || !Array.isArray(appData.weeks[weekKey].habits) || appData.weeks[weekKey].habits.length === 0) {
                appData.weeks[weekKey].habits = JSON.parse(JSON.stringify(SEED_DATA.habits));
                saveData();
            }

            // Guarantee weekly schedule seed fallbacks merge seamlessly
            if (!appData.weeks[weekKey].weeklySchedule) {
                appData.weeks[weekKey].weeklySchedule = JSON.parse(JSON.stringify(SEED_DATA.weeklySchedule));
                saveData();
            }
        }
    }

    function checkDailyAutoPurge() {
        const todayStr = new Date().toISOString().split('T')[0];
        const week = getCurrentWeekObj();
        let changed = false;

        (appData.categories || []).forEach(cat => {
            if (cat.retention === 'daily_delete') {
                if (cat.lastPurgedDate !== todayStr) {
                    week.tasks[cat.id] = [];
                    cat.lastPurgedDate = todayStr;
                    changed = true;
                }
            }
        });

        if (changed) saveData();
    }

    function getCurrentWeekObj() {
        ensureWeekData(currentWeekKey);
        return appData.weeks[currentWeekKey];
    }

    function initTheme() {
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                document.body.classList.toggle('light-theme');
                document.body.classList.toggle('dark-theme');
                const isLight = document.body.classList.contains('light-theme');
                themeBtn.querySelector('i').className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            });
        }
    }

    window.switchSubTab = function (targetTabId, btnEl) {
        const subTabBtns = document.querySelectorAll('.sub-tab-btn');
        subTabBtns.forEach(b => b.classList.remove('active'));

        const contents = document.querySelectorAll('.subtab-content');
        contents.forEach(c => c.classList.remove('active'));

        if (btnEl) btnEl.classList.add('active');
        const targetEl = document.getElementById(targetTabId);
        if (targetEl) targetEl.classList.add('active');
    };

    function initWeekNavigator() {
        const prevBtn = document.getElementById('prev-week-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => changeWeek(-7));

        const nextBtn = document.getElementById('next-week-btn');
        if (nextBtn) nextBtn.addEventListener('click', () => changeWeek(7));

        const currBtn = document.getElementById('current-week-btn');
        if (currBtn) currBtn.addEventListener('click', () => {
            currentDate = new Date();
            currentWeekKey = getWeekKey(currentDate);
            renderAll();
        });

        const calInput = document.getElementById('calendar-picker');
        if (calInput) {
            calInput.valueAsDate = currentDate;
            calInput.addEventListener('change', (e) => {
                if (e.target.valueAsDate) {
                    currentDate = e.target.valueAsDate;
                    currentWeekKey = getWeekKey(currentDate);
                    renderAll();
                }
            });
        }

        const printBtn = document.getElementById('print-btn');
        if (printBtn) printBtn.addEventListener('click', () => window.print());

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `ha_chayim_atzmam_backup_${currentWeekKey}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
            });
        }

        const importInput = document.getElementById('import-file-input');
        const importBtn = document.getElementById('import-btn');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        appData = JSON.parse(event.target.result);
                        saveData();
                        renderAll();
                        alert('הנתונים יובאו בהצלחה!');
                    } catch (err) {
                        alert('שגיאה בטעינת הקובץ.');
                    }
                };
                reader.readAsText(file);
            });
        }
    }

    function initGoogleCalendarHandlers() {
        const exportGCalBtn = document.getElementById('gcal-export-btn');
        const syncWeekBtn = document.getElementById('sync-week-gcal-btn');

        if (exportGCalBtn) exportGCalBtn.onclick = () => window.exportWeekToICal();
        if (syncWeekBtn) syncWeekBtn.onclick = () => window.exportWeekToICal();
    }

    window.exportWeekToICal = function () {
        const week = getCurrentWeekObj();
        const sundayDate = getSundayOfWeek(currentDate);

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//HaChayimAtzmam//DailyPlannerApp//HE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-TIMEZONE:Asia/Jerusalem'
        ];

        for (let slot in week.weeklySchedule) {
            const [startStr] = slot.split(' - ');
            if (!startStr) continue;

            const startHour = parseInt(startStr.split(':')[0], 10) || 0;

            for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                const item = week.weeklySchedule[slot][dayIdx];
                let text = '';
                let durationHours = 1;

                if (typeof item === 'string') {
                    text = item;
                } else if (item && typeof item === 'object') {
                    text = item.text || '';
                    durationHours = parseInt(item.durationHours, 10) || 1;
                }

                if (!text) continue;

                const endHour = startHour + durationHours;
                const eventDate = new Date(sundayDate);
                eventDate.setDate(sundayDate.getDate() + dayIdx);

                const year = eventDate.getFullYear();
                const month = String(eventDate.getMonth() + 1).padStart(2, '0');
                const day = String(eventDate.getDate()).padStart(2, '0');

                const dtStart = `${year}${month}${day}T${String(startHour).padStart(2, '0')}0000`;
                const dtEnd = `${year}${month}${day}T${String(endHour).padStart(2, '0')}0000`;

                icsContent.push('BEGIN:VEVENT');
                icsContent.push(`SUMMARY:${text}`);
                icsContent.push(`DESCRIPTION:נוצר מתוך אפליקציית החיים של זיו (${durationHours} שעות)`);
                icsContent.push(`DTSTART;TZID=Asia/Jerusalem:${dtStart}`);
                icsContent.push(`DTEND;TZID=Asia/Jerusalem:${dtEnd}`);
                icsContent.push('END:VEVENT');
            }
        }

        icsContent.push('END:VCALENDAR');

        const icsString = icsContent.join('\r\n');
        const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `hachayim_atzmam_${currentWeekKey}.ics`);
        document.body.appendChild(link);
        link.click();
        link.remove();

        const guideModal = document.getElementById('gcal-guide-modal');
        if (guideModal) guideModal.classList.add('active');
    };

    window.openSingleEventInGCal = function (slot, dayIdx) {
        const week = getCurrentWeekObj();
        const item = week.weeklySchedule[slot][dayIdx];
        let text = '';
        let durationHours = 1;

        if (typeof item === 'string') {
            text = item;
        } else if (item && typeof item === 'object') {
            text = item.text || '';
            durationHours = parseInt(item.durationHours, 10) || 1;
        }

        if (!text) return;

        const sundayDate = getSundayOfWeek(currentDate);
        const eventDate = new Date(sundayDate);
        eventDate.setDate(sundayDate.getDate() + dayIdx);

        const [startStr] = slot.split(' - ');
        const startHour = parseInt(startStr.split(':')[0], 10) || 0;
        const endHour = startHour + durationHours;

        const year = eventDate.getFullYear();
        const month = String(eventDate.getMonth() + 1).padStart(2, '0');
        const day = String(eventDate.getDate()).padStart(2, '0');

        const dtStart = `${year}${month}${day}T${String(startHour).padStart(2, '0')}0000`;
        const dtEnd = `${year}${month}${day}T${String(endHour).padStart(2, '0')}0000`;

        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${dtStart}/${dtEnd}&ctz=Asia/Jerusalem&details=${encodeURIComponent(`נוצר מתוך החיים של זיו (${durationHours} שעות)`)}`;
        window.open(gcalUrl, '_blank');
    };

    function changeWeek(days) {
        currentDate.setDate(currentDate.getDate() + days);
        currentWeekKey = getWeekKey(currentDate);
        const calInput = document.getElementById('calendar-picker');
        if (calInput) calInput.valueAsDate = currentDate;
        renderAll();
    }

    
    // ==========================================
    // TASK LIST & SUB-CATEGORIES & SUB-TASKS ENGINE
    // ==========================================
    window.renderTaskList = function (catId, elementId) {
        const ul = document.getElementById(elementId);
        if (!ul) return;

        const week = getCurrentWeekObj();
        if (!week.tasks) week.tasks = {};
        const tasks = week.tasks[catId] || [];

        if (tasks.length === 0) {
            ul.innerHTML = '<li class="empty-task-notice" style="color:var(--text-secondary-dark); font-size:12px; padding:6px; font-style:italic;">אין משימות בקטגוריה זו.</li>';
            return;
        }

        let html = '';
        tasks.forEach(t => {
            const isDone = !!t.done;
            const text = t.title || t.text || '';
            const subCategory = t.subCategory || t.subCat || '';
            const subTasks = t.subTasks || [];

            html += `
                <li class="task-row-item ${isDone ? 'completed-task' : ''}" data-task-id="${t.id}" draggable="true" ondragstart="window.handleTaskDragStart(event, '${catId}', '${t.id}')" style="margin-bottom:8px; padding:8px 10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:6px; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div style="display:flex; align-items:center; gap:8px; flex:1;">
                            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.toggleTaskDone('${catId}', '${t.id}', this.checked)" style="cursor:pointer; width:16px; height:16px;">
                            <span class="task-title-text" contenteditable="true" onblur="window.updateTaskTitleDirect('${catId}', '${t.id}', this.innerText)" style="font-weight:600; font-size:13px; ${isDone ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(text)}</span>
                            ${subCategory ? `<span class="subcat-badge" style="background:rgba(99,102,241,0.15); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); border-radius:10px; padding:1px 7px; font-size:10px; font-weight:700;">🏷️ ${escapeHtml(subCategory)}</span>` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button class="btn-icon-xs" onclick="window.promptSetSubCategory('${catId}', '${t.id}')" title="שנה/הוסף תת-קטגוריה" style="background:transparent; border:none; color:#a5b4fc; cursor:pointer; font-size:11px;">🏷️</button>
                            <button class="btn-icon-xs" onclick="window.editTaskTitle('${catId}', '${t.id}')" title="ערוך משימה" style="background:transparent; border:none; color:#f59e0b; cursor:pointer; font-size:11px;">✏️</button>
                            <button class="btn-icon-xs" onclick="window.deleteTask('${catId}', '${t.id}')" title="מחק משימה" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:11px;">🗑️</button>
                        </div>
                    </div>

                    <!-- SUB-TASKS (תתי משימות) SECTION -->
                    <div class="subtasks-container" style="margin-top:4px; padding-right:12px; border-right:2px solid rgba(99,102,241,0.2);">
                        ${subTasks.map((st, idx) => `
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; font-size:11px; margin-top:2px;">
                                <label style="display:flex; align-items:center; gap:4px; cursor:pointer; ${st.done ? 'text-decoration:line-through; opacity:0.6;' : ''}">
                                    <input type="checkbox" ${st.done ? 'checked' : ''} onchange="window.toggleSubTask('${catId}', '${t.id}', ${idx}, this.checked)">
                                    <span>${escapeHtml(st.text)}</span>
                                </label>
                                <button onclick="window.deleteSubTask('${catId}', '${t.id}', ${idx})" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:9px;">✕</button>
                            </div>
                        `).join('')}
                        
                        <div style="display:flex; align-items:center; gap:4px; margin-top:4px;">
                            <input type="text" placeholder="+ תת משימה" onkeydown="if(event.key==='Enter'){ window.addSubTask('${catId}', '${t.id}', this.value); this.value=''; }" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:10px; padding:2px 6px; flex:1;">
                        </div>
                    </div>
                </li>
            `;
        });

        ul.innerHTML = html;
    };

    window.updateTaskTitleDirect = function (catId, taskId, newTitle) {
        const week = getCurrentWeekObj();
        if (week.tasks && week.tasks[catId]) {
            const task = week.tasks[catId].find(t => t.id === taskId);
            if (task) {
                task.title = newTitle.trim();
                task.text = newTitle.trim();
                saveData();
            }
        }
    };

    window.promptSetSubCategory = function (catId, taskId) {
        const week = getCurrentWeekObj();
        if (week.tasks && week.tasks[catId]) {
            const task = week.tasks[catId].find(t => t.id === taskId);
            if (task) {
                const current = task.subCategory || task.subCat || '';
                const val = prompt('הכנס תת-קטגוריה למשימה (למשל: סידורים, הקלטות, דחוף):', current);
                if (val !== null) {
                    task.subCategory = val.trim();
                    task.subCat = val.trim();
                    saveData();
                    renderAll();
                }
            }
        }
    };

    window.addSubTask = function (catId, taskId, subTaskText) {
        if (!subTaskText || !subTaskText.trim()) return;
        const week = getCurrentWeekObj();
        if (week.tasks && week.tasks[catId]) {
            const task = week.tasks[catId].find(t => t.id === taskId);
            if (task) {
                if (!task.subTasks) task.subTasks = [];
                task.subTasks.push({ id: 'st_' + Date.now(), text: subTaskText.trim(), done: false });
                saveData();
                renderAll();
            }
        }
    };

    window.toggleSubTask = function (catId, taskId, subTaskIdx, isChecked) {
        const week = getCurrentWeekObj();
        if (week.tasks && week.tasks[catId]) {
            const task = week.tasks[catId].find(t => t.id === taskId);
            if (task && task.subTasks && task.subTasks[subTaskIdx]) {
                task.subTasks[subTaskIdx].done = !!isChecked;
                saveData();
                renderAll();
            }
        }
    };

    window.deleteSubTask = function (catId, taskId, subTaskIdx) {
        const week = getCurrentWeekObj();
        if (week.tasks && week.tasks[catId]) {
            const task = week.tasks[catId].find(t => t.id === taskId);
            if (task && task.subTasks) {
                task.subTasks.splice(subTaskIdx, 1);
                saveData();
                renderAll();
            }
        }
    };

    window.toggleTaskDone = function (catId, taskId, isChecked) {
        const week = getCurrentWeekObj();
        if (week.tasks && week.tasks[catId]) {
            const task = week.tasks[catId].find(t => t.id === taskId);
            if (task) {
                task.done = !!isChecked;
                saveData();
                renderAll();
            }
        }
    };


    function renderAll() {
        const weekTextEl = document.getElementById('week-text');
        if (weekTextEl) weekTextEl.textContent = getWeekDateRange(currentDate);

        renderWeeklyTableHeader();
        renderWeeklyTable();
        
        // 1. RENDER DYNAMIC TAB GRIDS FIRST SO ALL UL & CARD CONTAINERS ARE IN THE DOM!
        renderDynamicTabGrids();

        // 2. NOW POPULATE ALL HABITS, FEEDS, AND LISTS IN DOM
        renderHabits();
        renderTodayTasksList();
        renderTodayScheduleFeed();
        renderTodayAgendaFeed();

        // 3. POPULATE ALL TASK LISTS ACROSS ALL SUFFIXES (CORE + CUSTOM CATEGORIES)
        const allCatIds = [
            'someday', 'weekly', 'important', 'studio', 'fun',
            ...(appData.categories || []).map(c => c.id)
        ];

        allCatIds.forEach(catId => {
            ['today', 'life', 'work', 'fun', 'all', ''].forEach(tabSuffix => {
                const elId = tabSuffix ? `${catId}-tasks-list-${tabSuffix}` : `${catId}-tasks-list`;
                if (document.getElementById(elId)) {
                    renderTaskList(catId, elId);
                }
            });
        });

        renderCompletedArchive();
        renderMasterVTable();
        renderShoppingAndDebts();
        renderReflection();
        renderDailyPhotoGallery();
        renderTodayFeaturedPhoto();
        renderFunScratchpad();
        renderFunCanvas();
        renderTodayCanvas();
        renderStats();
    }

    window.setAgendaDay = function (dayIdx) {
        window.selectedAgendaDayIdx = parseInt(dayIdx, 10);
        renderTodayAgendaFeed();
    };

    function getSlotItem(week, slot, dayIdx) {
        const userSchedule = (week && week.weeklySchedule) ? week.weeklySchedule : {};
        if (userSchedule[slot]) {
            const item = userSchedule[slot][dayIdx] !== undefined ? userSchedule[slot][dayIdx] : userSchedule[slot][String(dayIdx)];
            if (item) {
                if (typeof item === 'string') return { title: item, text: item, isFixed: true, durationHours: 1 };
                return item;
            }
        }

        if (week && week.tasks) {
            for (const catId in week.tasks) {
                const list = week.tasks[catId];
                if (Array.isArray(list)) {
                    const found = list.find(t => t.scheduledSlot === slot && t.scheduledDay == dayIdx);
                    if (found) return { text: found.title || found.text, title: found.title || found.text, durationHours: found.scheduledDuration || 1 };
                }
            }
        }
        return null;
    }

    window.clearAllWeeklyScheduleData = function () {
        if (confirm('האם ברצונך לנקות לחלוטין את כל האירועים ממערכת השעות לשבוע זה?')) {
            const week = getCurrentWeekObj();
            week.weeklySchedule = JSON.parse(JSON.stringify(SEED_DATA.weeklySchedule));
            saveData();
            renderAll();
        }
    };

    window.clearSlotItem = function (slot, dayIdx) {
        const week = getCurrentWeekObj();
        if (!week.weeklySchedule) week.weeklySchedule = {};
        if (!week.weeklySchedule[slot]) week.weeklySchedule[slot] = {};

        week.weeklySchedule[slot][dayIdx] = { text: '', isFixed: false, durationHours: 1 };
        saveData();
        renderAll();
    };

    window.addDirectAgendaActivity = function(dayIdx) {
        const input = document.getElementById('direct-agenda-text-input');
        const select = document.getElementById('direct-agenda-slot-select');
        if (!input) return;

        const text = input.value.trim();
        const slot = select ? select.value : '12:00 - 13:00';
        if (!text) return alert('אנא הכנס תיאור לפעילות (למשל: שקשוקה עם גלי)');

        const week = getCurrentWeekObj();
        if (!week.weeklySchedule) week.weeklySchedule = {};
        if (!week.weeklySchedule[slot]) week.weeklySchedule[slot] = {};

        week.weeklySchedule[slot][dayIdx] = { text: text, isFixed: false, durationHours: 1 };
        input.value = '';
        saveData();
        renderAll();
    };

    window.addDirectTodayTask = function() {
        const input = document.getElementById('inline-input-today-dedicated');
        if (!input) return;
        const title = input.value.trim();
        if (!title) return;

        const today = new Date();
        const todayIsoStr = today.toISOString().split('T')[0];
        const todayDayIdx = today.getDay();

        const week = getCurrentWeekObj();
        if (!week.tasks) week.tasks = {};
        if (!week.tasks['weekly']) week.tasks['weekly'] = [];

        week.tasks['weekly'].push({
            id: 't_' + Date.now(),
            title: title,
            scheduledDateStr: todayIsoStr,
            scheduledWeekKey: currentWeekKey,
            scheduledDay: todayDayIdx,
            scheduledSlot: 'כללי / משימה יומית',
            isTodayTask: true
        });

        input.value = '';
        saveData();
        renderAll();
    };

    window.toggleTaskTodayQuickSched = function(catId, taskId) {
        const week = getCurrentWeekObj();
        const task = (week.tasks && week.tasks[catId]) ? week.tasks[catId].find(t => t.id === taskId) : null;
        if (!task) return;

        const today = new Date();
        const todayIsoStr = today.toISOString().split('T')[0];
        const todayDayIdx = today.getDay();

        if (task.scheduledDateStr === todayIsoStr || task.scheduledDay === todayDayIdx || task.isTodayTask) {
            delete task.scheduledDateStr;
            delete task.scheduledWeekKey;
            delete task.scheduledDay;
            delete task.scheduledSlot;
            delete task.isTodayTask;
        } else {
            task.scheduledDateStr = todayIsoStr;
            task.scheduledWeekKey = currentWeekKey;
            task.scheduledDay = todayDayIdx;
            task.scheduledSlot = task.scheduledSlot || 'כללי / משימה יומית';
            task.isTodayTask = true;
        }
        saveData();
        renderAll();
    };

    function renderTodayAgendaFeed() {
        // Feature removed as requested by user
    }

    // --- INLINE QUICK TASK ADDITION ---
            function createInlineQuickInputHTML(catId) {
        return `
            <div class="inline-task-input-wrapper" style="display:flex; gap:8px; margin-bottom:12px;">
                <input type="text" class="form-select inline-task-input" placeholder="משימה חדשה..." style="flex:1; padding:6px 12px; font-size:13px;" onkeydown="if(event.key==='Enter'||event.keyCode===13){ event.preventDefault(); window.addInlineTaskDirect('${catId}', this); return false; }">
                <button type="button" class="btn primary-btn sm-btn" onclick="window.addInlineTaskDirect('${catId}', this.previousElementSibling)">+ הוסף</button>
            </div>
        `;
    }

    window.addInlineTaskDirect = function (catId, inputEl) {
        if (!inputEl) return;
        const title = inputEl.value.trim();
        if (!title) return alert('אנא הקלד תיאור למשימה');

        const week = getCurrentWeekObj();
        if (!week.tasks) week.tasks = {};
        if (!week.tasks[catId]) week.tasks[catId] = [];
        week.tasks[catId].push({
            id: 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            title: title
        });
        inputEl.value = '';
        saveData();
        renderAll();
    };

    window.addInlineTask = function (catId) {
        const input = document.getElementById(`inline-input-${catId}`);
        if (input) {
            window.addInlineTaskDirect(catId, input);
        }
    };

    window.addInlineTaskById = function (catId, inputId) {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        const title = inputEl.value.trim();
        if (!title) return;

        const week = getCurrentWeekObj();
        if (!week.tasks) week.tasks = {};
        if (!week.tasks[catId]) week.tasks[catId] = [];
        week.tasks[catId].push({
            id: 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            title: title
        });
        inputEl.value = '';
        saveData();
        renderAll();
    };

    window.addInlineTask = function (catId) {
        const input = document.getElementById(`inline-input-${catId}`);
        if (!input) return;
        const title = input.value.trim();
        if (!title) return;

        const week = getCurrentWeekObj();
        if (!week.tasks) week.tasks = {};
        if (!week.tasks[catId]) week.tasks[catId] = [];
        week.tasks[catId].push({ id: 't_' + Date.now(), title });
        input.value = '';
        saveData();
        renderAll();
    };

    // --- DUAL DAY + DATE SCHEDULING ENGINE WITH QUICK PRESETS ---
    function renderQuickDayPresets(currentIsoDate) {
        const container = document.getElementById('quick-day-presets-container');
        if (!container) return;
        container.innerHTML = '';

        const today = new Date();
        const sunday = getSundayOfWeek(currentDate);

        for (let i = 0; i < 7; i++) {
            const dt = new Date(sunday);
            dt.setDate(sunday.getDate() + i);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            const iso = `${y}-${m}-${d}`;

            let label = `יום ${DAYS_HEBREW[i]} (${d}/${m})`;
            if (iso === today.toISOString().split('T')[0]) label = ` היום (${d}/${m})`;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `preset-day-btn ${currentIsoDate === iso ? 'active' : ''}`;
            btn.textContent = label;
            btn.onclick = () => {
                const datePicker = document.getElementById('sched-date-picker');
                const daySelect = document.getElementById('sched-day-select');
                if (datePicker) datePicker.value = iso;
                if (daySelect) daySelect.value = i;

                document.querySelectorAll('.preset-day-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            container.appendChild(btn);
        }
    }

    window.handleSchedDaySelectChange = function (dayVal) {
        const dayIdx = parseInt(dayVal, 10) || 0;
        const sunday = getSundayOfWeek(currentDate);
        const targetDt = new Date(sunday);
        targetDt.setDate(sunday.getDate() + dayIdx);

        const y = targetDt.getFullYear();
        const m = String(targetDt.getMonth() + 1).padStart(2, '0');
        const d = String(targetDt.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const datePicker = document.getElementById('sched-date-picker');
        if (datePicker) datePicker.value = dateStr;
        renderQuickDayPresets(dateStr);
    };

    window.handleSchedDatePickerChange = function (dateStr) {
        if (!dateStr) return;
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const daySelect = document.getElementById('sched-day-select');
        if (daySelect) daySelect.value = dt.getDay();
        renderQuickDayPresets(dateStr);
    };

    window.openScheduleTaskPicker = function (catId, taskId) {
        const week = getCurrentWeekObj();
        const tasks = (week.tasks && week.tasks[catId]) ? week.tasks[catId] : [];
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        activeSchedTaskInfo = { catId, taskId };

        const titleDisplay = document.getElementById('sched-task-title-display');
        if (titleDisplay) titleDisplay.value = task.title;

        const datePicker = document.getElementById('sched-date-picker');
        const daySelect = document.getElementById('sched-day-select');

        let initialIso = '';
        if (task.scheduledDateStr) {
            initialIso = task.scheduledDateStr;
        } else {
            const sunday = getSundayOfWeek(currentDate);
            const targetDt = new Date(sunday);
            targetDt.setDate(sunday.getDate() + (task.scheduledDay || 0));
            const y = targetDt.getFullYear();
            const m = String(targetDt.getMonth() + 1).padStart(2, '0');
            const d = String(targetDt.getDate()).padStart(2, '0');
            initialIso = `${y}-${m}-${d}`;
        }

        if (datePicker) datePicker.value = initialIso;
        if (daySelect) {
            const [y, m, d] = initialIso.split('-').map(Number);
            daySelect.value = new Date(y, m - 1, d).getDay();
        }

        renderQuickDayPresets(initialIso);

        const slotSelect = document.getElementById('sched-slot-select');
        if (slotSelect) {
            slotSelect.innerHTML = '';
            const schedule = week.weeklySchedule || SEED_DATA.weeklySchedule;
            for (let slot in schedule) {
                const opt = document.createElement('option');
                opt.value = slot;
                opt.textContent = slot;
                if (task.scheduledSlot === slot) opt.selected = true;
                slotSelect.appendChild(opt);
            }
        }

        const durationSelect = document.getElementById('sched-duration-select');
        if (durationSelect) durationSelect.value = task.scheduledDuration || '1';

        const typeSelect = document.getElementById('sched-type-select');
        if (typeSelect) typeSelect.value = task.scheduledIsFixed ? 'true' : 'false';

        const modal = document.getElementById('schedule-picker-modal');
        if (modal) modal.classList.add('active');
    };

    window.saveTaskSchedulePlacement = function () {
        if (!activeSchedTaskInfo) return;
        const { catId, taskId } = activeSchedTaskInfo;
        const week = getCurrentWeekObj();
        const task = (week.tasks && week.tasks[catId]) ? week.tasks[catId].find(t => t.id === taskId) : null;
        if (!task) return;

        const dateStr = document.getElementById('sched-date-picker').value;
        if (!dateStr) return alert('אנא בחר תאריך יעד');

        const [y, m, d] = dateStr.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        const targetWeekKey = getWeekKey(targetDate);
        const dayIdx = targetDate.getDay();

        const slot = document.getElementById('sched-slot-select').value;
        const durationHours = parseInt(document.getElementById('sched-duration-select').value, 10) || 1;
        const isFixed = document.getElementById('sched-type-select').value === 'true';

        // Clear previous placement if exists
        if (task.scheduledWeekKey && appData.weeks[task.scheduledWeekKey]) {
            const oldWeek = appData.weeks[task.scheduledWeekKey];
            if (task.scheduledSlot && task.scheduledDay !== undefined && oldWeek.weeklySchedule[task.scheduledSlot]) {
                if (oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay] && typeof oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay] === 'object') {
                    if (oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay].text === task.title) {
                        oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay] = null;
                    }
                }
            }
        }

        // Save placement properties on task
        task.scheduledDateStr = dateStr;
        task.scheduledWeekKey = targetWeekKey;
        task.scheduledDay = dayIdx;
        task.scheduledSlot = slot;
        task.scheduledDuration = durationHours;
        task.scheduledIsFixed = isFixed;

        // Ensure week data exists for target week key and place in grid
        ensureWeekData(targetWeekKey);
        const targetWeek = appData.weeks[targetWeekKey];
        if (!targetWeek.weeklySchedule) targetWeek.weeklySchedule = {};
        if (!targetWeek.weeklySchedule[slot]) targetWeek.weeklySchedule[slot] = {};
        targetWeek.weeklySchedule[slot][dayIdx] = {
            text: task.title,
            isFixed: isFixed,
            durationHours: durationHours
        };

        saveData();
        window.closeModal('schedule-picker-modal');
        renderAll();
    };

    window.clearTaskSchedulePlacement = function () {
        if (!activeSchedTaskInfo) return;
        const { catId, taskId } = activeSchedTaskInfo;
        const week = getCurrentWeekObj();
        const task = (week.tasks && week.tasks[catId]) ? week.tasks[catId].find(t => t.id === taskId) : null;
        if (!task) return;

        if (task.scheduledWeekKey && appData.weeks[task.scheduledWeekKey]) {
            const oldWeek = appData.weeks[task.scheduledWeekKey];
            if (task.scheduledSlot && task.scheduledDay !== undefined && oldWeek.weeklySchedule[task.scheduledSlot]) {
                if (oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay] && typeof oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay] === 'object') {
                    if (oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay].text === task.title) {
                        oldWeek.weeklySchedule[task.scheduledSlot][task.scheduledDay] = null;
                    }
                }
            }
        }

        delete task.scheduledDateStr;
        delete task.scheduledWeekKey;
        delete task.scheduledDay;
        delete task.scheduledSlot;
        delete task.scheduledDuration;
        delete task.scheduledIsFixed;

        saveData();
        window.closeModal('schedule-picker-modal');
        renderAll();
    };

    window.jumpToScheduledWeek = function (weekKey, dateStr) {
        if (dateStr) {
            const [y, m, d] = dateStr.split('-').map(Number);
            currentDate = new Date(y, m - 1, d);
            currentWeekKey = getWeekKey(currentDate);
        } else if (weekKey) {
            const [yearStr, weekStr] = weekKey.split('-W');
            const year = parseInt(yearStr, 10);
            const weekNo = parseInt(weekStr, 10);
            currentDate = new Date(year, 0, 1 + (weekNo - 1) * 7);
            currentWeekKey = weekKey;
        }
        renderAll();
    };

    window.moveCoreTableToTab = function (tableKey, newTabId) {
        if (!appData.coreTableTabs) appData.coreTableTabs = JSON.parse(JSON.stringify(DEFAULT_CORE_TABS));
        appData.coreTableTabs[tableKey] = newTabId;
        saveData();
        renderAll();
    };

    function getCoreTableTab(tableKey) {
        if (!appData.coreTableTabs) appData.coreTableTabs = JSON.parse(JSON.stringify(DEFAULT_CORE_TABS));
        let tab = appData.coreTableTabs[tableKey] || DEFAULT_CORE_TABS[tableKey] || 'life';
        if (tab === 'today') {
            tab = (DEFAULT_CORE_TABS[tableKey] && DEFAULT_CORE_TABS[tableKey] !== 'today') ? DEFAULT_CORE_TABS[tableKey] : 'life';
            appData.coreTableTabs[tableKey] = tab;
            const todayStr = new Date().toISOString().split('T')[0];
            if (!appData.coreTodayVisibility) appData.coreTodayVisibility = {};
            appData.coreTodayVisibility[tableKey] = { mode: 'permanent', setDate: todayStr };
            saveData();
        }
        return tab;
    }

    // --- DYNAMIC CARD WIDTH (50% VS 100%) & POSITION REORDERING ---
    window.toggleCardWidth = function (key) {
        if (!appData.cardWidths) appData.cardWidths = {};
        const current = appData.cardWidths[key] || '50';
        appData.cardWidths[key] = current === '100' ? '50' : '100';
        saveData();
        renderAll();
    };

    function getCardWidthClass(key) {
        if (!appData.cardWidths) appData.cardWidths = {};
        const w = appData.cardWidths[key] || '50';
        return w === '100' ? 'card-width-100' : 'card-width-50';
    }

    window.moveCategoryPosition = function (catId, direction) {
        window.moveCardPositionInTab(catId, direction, '');
    };

    window.moveCoreTablePosition = function (key, direction) {
        window.moveCardPositionInTab(key, direction, '');
    };

    window.moveCardPositionInTab = function (key, direction, tabId) {
        if (!tabId) {
            const activeSubtab = document.querySelector('.subtab-content.active');
            if (activeSubtab) {
                tabId = activeSubtab.id.replace('subtab-', '');
            } else {
                tabId = 'today';
            }
        }

        if (!appData.cardOrders) appData.cardOrders = {};

        const grid = document.getElementById(`${tabId}-custom-tables-container`) || document.getElementById(`${tabId}-blocks-grid`);
        if (!grid) return;

        const currentCardEls = Array.from(grid.querySelectorAll('[data-category]'));
        const currentKeys = currentCardEls.map(el => el.getAttribute('data-category')).filter(Boolean);

        const idx = currentKeys.indexOf(key);
        if (idx === -1) return;

        const newIdx = idx + direction;
        if (newIdx >= 0 && newIdx < currentKeys.length) {
            const temp = currentKeys[idx];
            currentKeys[idx] = currentKeys[newIdx];
            currentKeys[newIdx] = temp;

            appData.cardOrders[tabId] = currentKeys;
            saveData();
            renderAll();
        }
    };

    // --- TODAY TAB PARALLEL MULTI-DISPLAY & 24H VISIBILITY ENGINE (v37.0) ---
    function getTodayVisibility(key, isCore) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (isCore) {
            if (!appData.coreTodayVisibility) appData.coreTodayVisibility = {};
            const config = appData.coreTodayVisibility[key];
            if (!config) {
                if (['habits', 'todayTasks', 'todayScheduleFeed', 'todayPhoto', 'todayDrawing'].includes(key)) {
                    return 'permanent';
                }
                return 'none';
            }
            if (config.mode === 'daily' && config.setDate !== todayStr) {
                config.mode = 'none';
                saveData();
                return 'none';
            }
            return config.mode || 'none';
        } else {
            const cat = (appData.categories || []).find(c => c.id === key);
            if (!cat) return 'none';
            if (cat.todayVisibility === 'daily' && cat.todayVisibilitySetDate !== todayStr) {
                cat.todayVisibility = 'none';
                saveData();
                return 'none';
            }
            return cat.todayVisibility || 'none';
        }
    }

    window.setTodayVisibility = function(key, isCore, mode) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (isCore) {
            if (!appData.coreTodayVisibility) appData.coreTodayVisibility = {};
            appData.coreTodayVisibility[key] = { mode: mode, setDate: todayStr };
        } else {
            const cat = (appData.categories || []).find(c => c.id === key);
            if (cat) {
                cat.todayVisibility = mode;
                cat.todayVisibilitySetDate = todayStr;
            }
        }
        saveData();
        renderAll();
    };

    function createTodayVisibilitySelectHTML(key, isCore) {
        const currentMode = getTodayVisibility(key, isCore);
        return `
            <select class="tab-move-select today-vis-select" onchange="window.setTodayVisibility('${key}', ${isCore}, this.value)" title="תצוגה בלשונית היום (במקביל ללשונית האם)">
                <option value="none" ${currentMode === 'none' ? 'selected' : ''}>ללא בהיום</option>
                <option value="daily" ${currentMode === 'daily' ? 'selected' : ''}>יום אחד (24 שעות)</option>
                <option value="permanent" ${currentMode === 'permanent' ? 'selected' : ''}>קבוע בהיום</option>
            </select>
        `;
    }

    
    // ==========================================
    // DYNAMIC SUB-CATEGORY & ISOLATION FILTER ENGINE
    // ==========================================
    
    // ==========================================
    // STRICTLY TAB-SCOPED SUB-CATEGORY ENGINE
    // ==========================================
    
    // ==========================================
    // 100% STRICT TAB-ISOLATED SUB-CATEGORY ENGINE
    // ==========================================
    
    // ==========================================
    // 100% STRICT TAB-ISOLATED SUB-CATEGORY ENGINE
    // ==========================================
    window.DEFAULT_SUB_CATEGORIES = {
        'subtab-life': [
            { id: 'all', name: 'הכל' },
            { id: 'life_home', name: 'בית & ניקיון' },
            { id: 'life_shopping', name: 'קניות & סידורים' },
            { id: 'life_health', name: 'בריאות & אישי' }
        ],
        'subtab-work': [
            { id: 'all', name: 'הכל' },
            { id: 'work_studio', name: 'אולפן & הקלטות' },
            { id: 'work_projects', name: 'פרויקטים & לקוחות' },
            { id: 'work_students', name: 'תלמידים' },
            { id: 'work_orchestra', name: 'אורקסטרה' },
            { id: 'work_beit_tefilla', name: 'בית תפילה' },
            { id: 'work_amlih', name: 'AMLIH' }
        ],
        'subtab-fun': [
            { id: 'all', name: 'הכל' },
            { id: 'fun_shows', name: 'הופעות & סרטים' },
            { id: 'fun_trips', name: 'טיולים & אירועים' },
            { id: 'fun_ideas', name: 'רעיונות & חלומות' }
        ],
        'subtab-all': [
            { id: 'all', name: 'הכל' }
        ],
        'subtab-today': [
            { id: 'all', name: 'הכל' }
        ]
    };

    window.currentActiveTabId = 'subtab-all';
    window.activeSubCategoryFilter = 'all';

    window.initSubCategoryTabs = function() {
        if (!appData.customSubCategories || typeof appData.customSubCategories !== 'object' || Array.isArray(appData.customSubCategories)) {
            appData.customSubCategories = JSON.parse(JSON.stringify(DEFAULT_SUB_CATEGORIES));
        }
        if (!appData.tableSubCategories) {
            appData.tableSubCategories = {
                'studio': 'work_studio',
                'groceries': 'life_shopping',
                'house_shopping': 'life_home',
                'weekly': 'life_home',
                'someday': 'work_projects',
                'important': 'work_projects',
                'fun': 'fun_shows',
                'cat_beit_tefilla': 'work_beit_tefilla',
                'c_all_my_life_changes': 'work_amlih'
            };
        }
    };

    window.renderSubCategoryPillsBar = function() {
        initSubCategoryTabs();
        const bar = document.getElementById('subcategories-pills-bar');
        if (!bar) return;

        // Hide pills bar on Today tab or Overview (all) tab
        if (currentActiveTabId === 'subtab-today' || currentActiveTabId === 'subtab-all') {
            bar.style.display = 'none';
            return;
        } else {
            bar.style.display = 'flex';
        }

        // STRICTLY FETCH ONLY SUB-CATEGORIES BELONGING TO THE CURRENT ACTIVE TAB!
        const subCats = (appData.customSubCategories && appData.customSubCategories[currentActiveTabId]) 
            ? appData.customSubCategories[currentActiveTabId] 
            : (DEFAULT_SUB_CATEGORIES[currentActiveTabId] || [{ id: 'all', name: 'הכל' }]);

        let html = '<span style="font-size:12px; font-weight:700; color:var(--text-secondary-dark); margin-left:6px;">תת-קטגוריות:</span>';
        subCats.forEach(sc => {
            const isActive = activeSubCategoryFilter === sc.id;
            
            // Count matching tables in active tab for badge
            let matchCount = 0;
            if (sc.id === 'all') {
                matchCount = (appData.categories || []).filter(c => {
                    const assignedTabs = Array.isArray(c.tabs) ? c.tabs : (c.tabId ? c.tabId.split(',').map(s => s.trim()) : ['work']);
                    return assignedTabs.includes(currentActiveTabId.replace('subtab-', ''));
                }).length;
            } else {
                matchCount = (appData.categories || []).filter(c => {
                    const cardSubCat = (appData.tableSubCategories && appData.tableSubCategories[c.id]) || '';
                    return cardSubCat === sc.id;
                }).length;
            }

            html += `
                <button class="subcat-pill-btn ${isActive ? 'active' : ''}" onclick="window.filterBySubCategory('${sc.id}')" style="padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid ${isActive ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.1)'}; background:${isActive ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))' : 'rgba(255,255,255,0.04)'}; color:${isActive ? '#ffffff' : 'var(--text-secondary-dark)'}; transition:all 0.2s ease; display:inline-flex; align-items:center; gap:6px;">
                    ${sc.id !== 'all' ? `<span onclick="event.stopPropagation(); window.deleteSubCategoryPill('${sc.id}')" title="מחק תת-קטגוריה" style="font-size:10px; opacity:0.6; cursor:pointer;">✕</span>` : ''}
                    <span style="background:rgba(255,255,255,0.2); padding:1px 6px; border-radius:10px; font-size:10px;">${matchCount}</span>
                    <span>${escapeHtml(sc.name)}</span>
                </button>
            `;
        });

        html += `
            <button onclick="window.openAddSubCategoryPrompt()" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer; border:1px dashed rgba(99,102,241,0.5); background:rgba(99,102,241,0.1); color:#a5b4fc; margin-right:auto;">
                + תת-קטגוריה
            </button>
        `;

        bar.innerHTML = html;
    };

    window.deleteSubCategoryPill = function(subCatId) {
        if (!confirm('האם למחוק תת-קטגוריה זו?')) return;
        initSubCategoryTabs();
        if (appData.customSubCategories[currentActiveTabId]) {
            appData.customSubCategories[currentActiveTabId] = appData.customSubCategories[currentActiveTabId].filter(sc => sc.id !== subCatId);
            saveData();
            if (activeSubCategoryFilter === subCatId) activeSubCategoryFilter = 'all';
            renderSubCategoryPillsBar();
            renderDynamicTabGrids();
        }
    };

    window.filterBySubCategory = function(subCatId) {
        window.activeSubCategoryFilter = subCatId;
        renderSubCategoryPillsBar();
        renderDynamicTabGrids();
    };

    window.openAddSubCategoryPrompt = function() {
        const name = prompt('הכנס שם לתת-הקטגוריה החדשה בלשונית זו:');
        if (!name || !name.trim()) return;
        initSubCategoryTabs();
        if (!appData.customSubCategories[currentActiveTabId]) {
            appData.customSubCategories[currentActiveTabId] = JSON.parse(JSON.stringify(DEFAULT_SUB_CATEGORIES[currentActiveTabId] || [{ id: 'all', name: 'הכל' }]));
        }

        const newId = 'sc_' + Date.now();
        appData.customSubCategories[currentActiveTabId].push({ id: newId, name: name.trim() });
        saveData();
        filterBySubCategory(newId);
    };

    window.setTableSubCategory = function(catId, subCatId) {
        initSubCategoryTabs();
        appData.tableSubCategories[catId] = subCatId;
        saveData();
        renderAll();
    };

    window.createSubCategorySelectorHTML = function(catId, parentTabId) {
        initSubCategoryTabs();
        const currentSubCat = appData.tableSubCategories[catId] || 'all';
        const targetTabKey = parentTabId ? (parentTabId.startsWith('subtab-') ? parentTabId : `subtab-${parentTabId}`) : currentActiveTabId;
        
        // STRICTLY FETCH ONLY SUB-CATEGORIES OF THIS TAB
        const tabSubCats = (appData.customSubCategories && appData.customSubCategories[targetTabKey])
            ? appData.customSubCategories[targetTabKey]
            : (DEFAULT_SUB_CATEGORIES[targetTabKey] || []);

        let options = '<option value="all">ללא תת-קטגוריה</option>';
        tabSubCats.forEach(sc => {
            if (sc.id !== 'all') {
                options += `<option value="${sc.id}" ${currentSubCat === sc.id ? 'selected' : ''}>🏷️ ${escapeHtml(sc.name)}</option>`;
            }
        });

        return `
            <select class="table-subcat-select" onchange="window.setTableSubCategory('${catId}', this.value)" style="background:rgba(99,102,241,0.1); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); border-radius:6px; font-size:11px; padding:2px 6px; font-weight:700; cursor:pointer;">
                ${options}
            </select>
        `;
    };

    window.switchSubTab = function (targetTabId, btnEl) {
        window.currentActiveTabId = targetTabId;
        window.activeSubCategoryFilter = 'all';

        const subTabBtns = document.querySelectorAll('.sub-tab-btn');
        subTabBtns.forEach(b => b.classList.remove('active'));

        const contents = document.querySelectorAll('.subtab-content');
        contents.forEach(c => c.classList.remove('active'));

        if (btnEl) btnEl.classList.add('active');
        const targetEl = document.getElementById(targetTabId);
        if (targetEl) targetEl.classList.add('active');

        renderSubCategoryPillsBar();
        renderDynamicTabGrids();
    };


    function renderDynamicTabGrids() {
        const week = getCurrentWeekObj();
        const tabs = ['today', 'life', 'work', 'fun', 'all'];
        if (!appData.cardOrders) appData.cardOrders = {};

        tabs.forEach(tabId => {
            const grid = document.getElementById(`${tabId}-custom-tables-container`) || document.getElementById(`${tabId}-blocks-grid`);
            if (!grid) return;
            grid.innerHTML = '';

            const cardsMap = getCoreCardsMapForTab(tabId, week);

            const tabCategories = (appData.categories || []).filter(c => {
                let matchesTab = false;
                if (tabId === 'today') matchesTab = getTodayVisibility(c.id, false) !== 'none';
                else if (tabId === 'all') matchesTab = true;
                else {
                    const assignedTabs = Array.isArray(c.tabs) ? c.tabs : (c.tabId ? c.tabId.split(',').map(s => s.trim()) : ['work']);
                    matchesTab = assignedTabs.includes(tabId.replace('subtab-', ''));
                }

                if (!matchesTab) return false;

                if (window.activeSubCategoryFilter && window.activeSubCategoryFilter !== 'all') {
                    const cardSubCat = (appData.tableSubCategories && appData.tableSubCategories[c.id]) || 'all';
                    return cardSubCat === window.activeSubCategoryFilter;
                }
                return true;
            });

            tabCategories.forEach(cat => {
                let div = document.createElement('div');
                if (cat.type === 'matrix') {
                    div = createMatrixTableCardElement(cat, week);
                } else {
                    div = createCategoryCardElement(cat, week, tabId);
                }
                cardsMap[cat.id] = div.outerHTML;
            });

            const availableKeys = Object.keys(cardsMap);
            const savedOrder = appData.cardOrders[tabId] || [];

            const sortedKeys = [];
            savedOrder.forEach(k => {
                if (availableKeys.includes(k)) sortedKeys.push(k);
            });
            availableKeys.forEach(k => {
                if (!sortedKeys.includes(k)) sortedKeys.push(k);
            });

            sortedKeys.forEach(k => {
                if (cardsMap[k]) {
                    grid.innerHTML += cardsMap[k];
                }
            });
        });

        updateOverviewTabHeaderControls();

        const containerAll = document.getElementById('all-custom-tables-container');
        if (containerAll) {
            containerAll.innerHTML = '';
            (appData.categories || []).forEach(cat => {
                if (cat.type === 'matrix') {
                    containerAll.appendChild(createMatrixTableCardElement(cat, week));
                } else {
                    containerAll.appendChild(createCategoryCardElement(cat, week));
                }
            });
        }
    }

    function updateOverviewTabHeaderControls() {
        const coreKeys = ['someday', 'weekly', 'studio', 'important', 'fun', 'groceries', 'debts', 'todayPhoto', 'todayDrawing', 'funScratchpad', 'funDrawing', 'funPhotos'];
        coreKeys.forEach(key => {
            const currentTab = getCoreTableTab(key);
            const blockEl = document.querySelector(`#subtab-all [data-category="${key}"]`);
            if (blockEl) {
                let actionsDiv = blockEl.querySelector('.block-actions');
                if (!actionsDiv) {
                    const header = blockEl.querySelector('.block-header');
                    if (header) {
                        actionsDiv = document.createElement('div');
                        actionsDiv.className = 'block-actions';
                        header.appendChild(actionsDiv);
                    }
                }
                if (actionsDiv) {
                    let selectEl = actionsDiv.querySelector(`.tab-move-select-${key}`);
                    if (!selectEl) {
                        selectEl = document.createElement('select');
                        selectEl.className = `tab-move-select tab-move-select-${key}`;
                        selectEl.setAttribute('onchange', `window.moveCoreTableToTab('${key}', this.value)`);
                        selectEl.setAttribute('title', 'העבר לשונית');
                        selectEl.innerHTML = `
                            <option value="life" ${currentTab === 'life' ? 'selected' : ''}>חיים</option>
                            <option value="work" ${currentTab === 'work' ? 'selected' : ''}>עבודה</option>
                            <option value="fun" ${currentTab === 'fun' ? 'selected' : ''}>כיף</option>
                        `;
                        actionsDiv.appendChild(selectEl);
                    } else {
                        selectEl.value = currentTab;
                    }
                }
            }
        });
    }

    function createTabMoveSelectHTML(tableKey, currentTab) {
        return `
            ${createTodayVisibilitySelectHTML(tableKey, true)}
            
        `;
    }

    function createOrderControlsHTML(key, isCore, tabId) {
        const currentWidth = (appData.cardWidths && appData.cardWidths[key] === '100') ? '100%' : '50%';
        return `
            <button class="table-card-order-btn" onclick="window.moveCardPositionInTab('${key}', -1, '${tabId || ''}')" title="הזז למעלה">⬆️</button>
            <button class="table-card-order-btn" onclick="window.moveCardPositionInTab('${key}', 1, '${tabId || ''}')" title="הזז למטה">⬇️</button>
            <button class="table-width-toggle-btn" onclick="window.toggleCardWidth('${key}')" title="שנה רוחב (50% שתיים בשורה / 100% רוחב מלא)"> ${currentWidth}</button>
        `;
    }

    function getCoreCardsMapForTab(tabId, week) {
        const cardsMap = {};

        function shouldInclude(key) {
            if (tabId === 'today') {
                return getTodayVisibility(key, true) !== 'none';
            } else if (tabId === 'all') {
                return true;
            } else {
                const curVal = (appData.coreTableTabs && appData.coreTableTabs[key]) ? appData.coreTableTabs[key] : (DEFAULT_CORE_TABS[key] || 'work');
                const assignedTabs = curVal.split(',').map(s => s.trim());
                return assignedTabs.includes(tabId);
            }
        }

        if (shouldInclude('habits')) {
            cardsMap['habits'] = `
                <section class="dashboard-block task-dropzone ${getCardWidthClass('habits')}" data-category="habits">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('habits', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('habits', this.innerText)">${escapeHtml(getCoreHeaderTitle('habits', 'לעשות יום יום'))}</h2>
                        </div>
                        <div class="block-actions">
                            <button class="btn secondary-btn sm-btn" onclick="window.resetHabits()">איפוס</button>
                            <button class="btn primary-btn sm-btn" onclick="window.openAddHabitPrompt()">הרגל</button>
                        </div>
                    </div>
                    <div class="habits-card-container">
                        <ul class="habits-list" id="habits-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('someday')) {
            cardsMap['someday'] = `
                <section class="dashboard-block task-dropzone ${getCardWidthClass('someday')}" data-category="someday">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('someday', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('someday', this.innerText)">${escapeHtml(getCoreHeaderTitle('someday', 'משימות שיום אחד אעשה וחשוב'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('someday', getCoreTableTab('someday'))}
                            <button class="btn secondary-btn sm-btn" onclick="window.openAddTaskModal('someday')">משימה</button>
                        </div>
                    </div>
                    <div class="category-block-card">
                        ${createInlineQuickInputHTML("someday")}
                    <ul class="category-task-list" id="someday-tasks-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('weekly')) {
            cardsMap['weekly'] = `
                <section class="dashboard-block task-dropzone ${getCardWidthClass('weekly')}" data-category="weekly">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('weekly', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('weekly', this.innerText)">${escapeHtml(getCoreHeaderTitle('weekly', 'משימות לשבוע הקרוב'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('weekly', getCoreTableTab('weekly'))}
                            <button class="btn primary-btn sm-btn" onclick="window.openAddTaskModal('weekly')">משימה</button>
                        </div>
                    </div>
                    <div class="category-block-card">
                        ${createInlineQuickInputHTML("weekly")}
                    <ul class="category-task-list" id="weekly-tasks-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('studio')) {
            cardsMap['studio'] = `
                <section class="dashboard-block studio-card-block task-dropzone ${getCardWidthClass('studio')}" data-category="studio">
                    <div class="block-header studio-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('studio', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('studio', this.innerText)">${escapeHtml(getCoreHeaderTitle('studio', 'משימות לאולפן ולמוזיקה'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('studio', getCoreTableTab('studio'))}
                            <button class="btn primary-btn sm-btn" onclick="window.openAddTaskModal('studio')">משימה</button>
                        </div>
                    </div>
                    <div class="category-block-card">
                        ${createInlineQuickInputHTML("studio")}
                    <ul class="category-task-list" id="studio-tasks-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('important')) {
            cardsMap['important'] = `
                <section class="dashboard-block task-dropzone ${getCardWidthClass('important')}" data-category="important">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('important', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('important', this.innerText)">${escapeHtml(getCoreHeaderTitle('important', 'חשוב ולא דחוף'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('important', getCoreTableTab('important'))}
                            <button class="btn secondary-btn sm-btn" onclick="window.openAddTaskModal('important')">משימה</button>
                        </div>
                    </div>
                    <div class="category-block-card">
                        ${createInlineQuickInputHTML("important")}
                    <ul class="category-task-list" id="important-tasks-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('fun')) {
            cardsMap['fun'] = `
                <section class="dashboard-block fun-card-block task-dropzone ${getCardWidthClass('fun')}" data-category="fun">
                    <div class="block-header fun-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('fun', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('fun', this.innerText)">${escapeHtml(getCoreHeaderTitle('fun', 'קופסת כיף שבועית'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('fun', getCoreTableTab('fun'))}
                            <button class="btn primary-btn sm-btn" onclick="window.openAddTaskModal('fun')">רעיון לכיף</button>
                        </div>
                    </div>
                    <div class="category-block-card fun-container">
                        ${createInlineQuickInputHTML("fun")}
                    <ul class="category-task-list" id="fun-tasks-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('groceries')) {
            cardsMap['groceries'] = `
                <section class="dashboard-block ${getCardWidthClass('groceries')}" data-category="groceries">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('groceries', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('groceries', this.innerText)">${escapeHtml(getCoreHeaderTitle('groceries', 'מצרכים וקניות לבית'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('groceries', getCoreTableTab('groceries'))}
                        </div>
                    </div>
                    <div class="shopping-card">
                        <div class="card-header">
                            <h3>מצרכים לבית</h3>
                            <button class="add-item-btn" data-type="groceries">מצרך</button>
                        </div>
                        <ul class="checklist-items" id="groceries-list-${tabId}"></ul>
                    </div>
                    <div class="shopping-card mt-3">
                        <div class="card-header">
                            <h3>קניות כללי וציוד</h3>
                            <button class="add-item-btn" data-type="general_shopping">מוצר</button>
                        </div>
                        <ul class="checklist-items" id="general-shopping-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('debts')) {
            cardsMap['debts'] = `
                <section class="dashboard-block ${getCardWidthClass('debts')}" data-category="debts">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('debts', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('debts', this.innerText)">${escapeHtml(getCoreHeaderTitle('debts', 'כספים שחייבים לי'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('debts', getCoreTableTab('debts'))}
                            <button class="add-item-btn" data-type="debts">רישום חוב</button>
                        </div>
                    </div>
                    <div class="shopping-card">
                        <div class="table-wrapper">
                            <table class="debts-table">
                                <thead>
                                    <tr>
                                        <th>גורם</th>
                                        <th>סכום (₪)</th>
                                        <th>סטטוס</th>
                                        <th>פעולות</th>
                                    </tr>
                                </thead>
                                <tbody id="debts-list-${tabId}"></tbody>
                            </table>
                        </div>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('todayTasks')) {
            cardsMap['todayTasks'] = `
                <section class="dashboard-block ${getCardWidthClass('todayTasks')}" data-category="todayTasks" style="border:1px solid rgba(245, 158, 11, 0.4); box-shadow:0 4px 14px rgba(245,158,11,0.15);">
                    <div class="block-header" style="background:rgba(245, 158, 11, 0.12);">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('todayTasks', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('todayTasks', this.innerText)" style="color:var(--accent-orange);">${escapeHtml(getCoreHeaderTitle('todayTasks', 'משימות ושיבוצי היום'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('todayTasks', getCoreTableTab('todayTasks'))}
                        </div>
                    </div>
                    <div class="category-block-card" style="padding:14px;">
                        <div class="inline-task-input-wrapper" style="display:flex; gap:8px; margin-bottom:12px;">
                            <input type="text" id="inline-input-today-dedicated" class="form-select" placeholder="משימה חדשה להיום..." style="flex:1; padding:8px 12px; font-size:13px; border-color:rgba(245, 158, 11, 0.5);" onkeypress="if(event.key==='Enter'){ event.preventDefault(); window.addDirectTodayTask(); }">
                            <button class="btn primary-btn sm-btn" onclick="window.addDirectTodayTask()" style="background:var(--accent-orange); border:none;" title="הוסף להיום">הוסף להיום</button>
                        </div>
                        <ul class="category-task-list" id="today-tasks-dedicated-list-${tabId}"></ul>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('todayScheduleFeed')) {
            cardsMap['todayScheduleFeed'] = `
                <section class="dashboard-block ${getCardWidthClass('todayScheduleFeed')}" data-category="todayScheduleFeed" style="border:1px solid rgba(99, 102, 241, 0.4); box-shadow:0 4px 14px rgba(99, 102, 241, 0.15);">
                    <div class="block-header" style="background:rgba(99, 102, 241, 0.12);">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('todayScheduleFeed', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('todayScheduleFeed', this.innerText)" style="color:var(--accent-indigo);">${escapeHtml(getCoreHeaderTitle('todayScheduleFeed', 'אירועי היום ממערכת השעות'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('todayScheduleFeed', getCoreTableTab('todayScheduleFeed'))}
                        </div>
                    </div>
                    <div class="category-block-card" style="padding:14px;">
                        <div id="today-schedule-feed-container-${tabId}"></div>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('todayPhoto')) {
            cardsMap['todayPhoto'] = `
                <section class="dashboard-block today-photo-card-block ${getCardWidthClass('todayPhoto')}" data-category="todayPhoto">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('todayPhoto', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('todayPhoto', this.innerText)">${escapeHtml(getCoreHeaderTitle('todayPhoto', 'תמונת היום'))} (<span id="today-photo-date-label"></span>)</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('todayPhoto', getCoreTableTab('todayPhoto'))}
                        </div>
                    </div>
                    <div id="today-featured-photo-wrapper" style="padding:14px; text-align:center;"></div>
                </section>
            `;
        }

        if (shouldInclude('todayDrawing')) {
            cardsMap['todayDrawing'] = `
                <section class="dashboard-block today-drawing-block ${getCardWidthClass('todayDrawing')}" data-category="todayDrawing">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('todayDrawing', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('todayDrawing', this.innerText)">${escapeHtml(getCoreHeaderTitle('todayDrawing', 'משטח ציור ושרבוטי היום'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('todayDrawing', getCoreTableTab('todayDrawing'))}
                            <button class="btn secondary-btn sm-btn" onclick="window.clearTodayCanvas()">נקה</button>
                            <button class="btn primary-btn sm-btn" onclick="window.downloadTodayDrawing()">שמור</button>
                        </div>
                    </div>
                    <div class="fun-canvas-controls" style="margin:10px 14px 4px 14px;">
                        <div style="display:flex; gap:4px; align-items:center;">
                            <button class="color-btn active" style="background:#6366f1;" onclick="window.setTodayCanvasColor('#6366f1', this)"></button>
                            <button class="color-btn" style="background:#ec4899;" onclick="window.setTodayCanvasColor('#ec4899', this)"></button>
                            <button class="color-btn" style="background:#10b981;" onclick="window.setTodayCanvasColor('#10b981', this)"></button>
                            <button class="color-btn" style="background:#f59e0b;" onclick="window.setTodayCanvasColor('#f59e0b', this)"></button>
                            <button class="color-btn" style="background:#ef4444;" onclick="window.setTodayCanvasColor('#ef4444', this)"></button>
                            <button class="color-btn" style="background:#000000;" onclick="window.setTodayCanvasColor('#000000', this)"></button>
                        </div>
                        <input type="range" id="today-brush-slider" min="2" max="24" value="4" style="width:60px;" title="עובי מברשת" onchange="window.setTodayBrushSize(this.value)">
                        <button class="btn secondary-btn sm-btn" id="today-eraser-btn" onclick="window.toggleTodayCanvasEraser()">מחק</button>
                    </div>
                    <div class="fun-canvas-container" style="margin:0 14px 14px 14px;">
                        <canvas id="today-drawing-canvas" width="500" height="200"></canvas>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('funScratchpad')) {
            cardsMap['funScratchpad'] = `
                <section class="dashboard-block ${getCardWidthClass('funScratchpad')}" data-category="funScratchpad">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('funScratchpad', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('funScratchpad', this.innerText)">${escapeHtml(getCoreHeaderTitle('funScratchpad', 'טקסט חופשי'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('funScratchpad', getCoreTableTab('funScratchpad'))}
                            <span class="save-status" id="scratchpad-save-status">נשמר אוטומטית</span>
                        </div>
                    </div>
                    <textarea id="fun-scratchpad" class="fun-scratchpad-input" placeholder=""></textarea>
                </section>
            `;
        }

        if (shouldInclude('funDrawing')) {
            cardsMap['funDrawing'] = `
                <section class="dashboard-block ${getCardWidthClass('funDrawing')}" data-category="funDrawing">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('funDrawing', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('funDrawing', this.innerText)">${escapeHtml(getCoreHeaderTitle('funDrawing', 'משטח ציור ושרבוטים'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('funDrawing', getCoreTableTab('funDrawing'))}
                            <button class="btn secondary-btn sm-btn" onclick="window.clearFunCanvas()">נקה</button>
                            <button class="btn primary-btn sm-btn" onclick="window.downloadFunDrawing()">שמור</button>
                        </div>
                    </div>
                    <div class="fun-canvas-controls" style="margin:10px 14px 4px 14px;">
                        <div style="display:flex; gap:4px; align-items:center;">
                            <button class="color-btn active" style="background:#6366f1;" onclick="window.setCanvasColor('#6366f1', this)"></button>
                            <button class="color-btn" style="background:#ec4899;" onclick="window.setCanvasColor('#ec4899', this)"></button>
                            <button class="color-btn" style="background:#10b981;" onclick="window.setCanvasColor('#10b981', this)"></button>
                            <button class="color-btn" style="background:#f59e0b;" onclick="window.setCanvasColor('#f59e0b', this)"></button>
                            <button class="color-btn" style="background:#ef4444;" onclick="window.setCanvasColor('#ef4444', this)"></button>
                            <button class="color-btn" style="background:#000000;" onclick="window.setCanvasColor('#000000', this)"></button>
                        </div>
                        <input type="range" id="brush-size-slider" min="2" max="24" value="4" style="width:70px;" title="עובי מברשת" onchange="window.setBrushSize(this.value)">
                        <button class="btn secondary-btn sm-btn" id="eraser-btn" onclick="window.toggleCanvasEraser()">מחק</button>
                    </div>
                    <div class="fun-canvas-container" style="margin:0 14px 14px 14px;">
                        <canvas id="fun-drawing-canvas" width="500" height="240"></canvas>
                    </div>
                </section>
            `;
        }

        if (shouldInclude('funPhotos')) {
            cardsMap['funPhotos'] = `
                <section class="dashboard-block card-width-100 ${getCardWidthClass('funPhotos')}" data-category="funPhotos">
                    <div class="block-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${createOrderControlsHTML('funPhotos', true, tabId)}
                            <h2 contenteditable="true" onblur="window.updateHeaderTitle('funPhotos', this.innerText)">${escapeHtml(getCoreHeaderTitle('funPhotos', 'גלריית תמונות השבוע'))}</h2>
                        </div>
                        <div class="block-actions">
                            ${createTabMoveSelectHTML('funPhotos', getCoreTableTab('funPhotos'))}
                        </div>
                    </div>
                    <div class="daily-photos-grid" id="daily-photos-container" style="padding:14px;"></div>
                </section>
            `;
        }

        return cardsMap;
    }

    // --- RENDER DYNAMIC DAY HEADERS WITH EXACT DATES ---
    function renderWeeklyTableHeader() {
        const sundayDate = getSundayOfWeek(currentDate);

        for (let i = 0; i < 7; i++) {
            const th = document.getElementById(`th-day-${i}`);
            if (th) {
                const dt = new Date(sundayDate);
                dt.setDate(sundayDate.getDate() + i);
                const dateStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
                th.innerHTML = `${DAYS_HEBREW[i]} <span class="th-date">(${dateStr})</span>`;
            }
        }
    }

    function getCoreHeaderTitle(catKey, defaultTitle) {
        if (appData && appData.headerTitles && appData.headerTitles[catKey] && appData.headerTitles[catKey].trim()) {
            return appData.headerTitles[catKey];
        }
        return defaultTitle;
    }

    // --- INLINE HEADER EDITING ---
    window.updateHeaderTitle = function (catKey, newText) {
        newText = (newText || '').replace(/\u00a0/g, ' ').trim();
        if (!newText) return;
        if (!appData.headerTitles) appData.headerTitles = {};
        appData.headerTitles[catKey] = newText;
        saveData();
    };

    // --- DRAG & DROP ENGINE FOR TASKS INSIDE TABLES ---
    function initDragAndDropListeners() {
        document.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.task-row-item, .habit-item');
            if (item) {
                const catId = item.closest('[data-category]')?.getAttribute('data-category');
                const taskId = item.getAttribute('data-task-id');
                if (catId && taskId) {
                    draggedTaskInfo = { fromCat: catId, taskId: taskId };
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', taskId);
                }
            }
        });

        document.addEventListener('dragover', (e) => {
            if (!draggedTaskInfo) return;
            const taskItem = e.target.closest('.task-row-item, .habit-item');
            const dropzone = e.target.closest('.task-dropzone');
            if (taskItem || dropzone) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        document.addEventListener('drop', (e) => {
            if (!draggedTaskInfo) return;
            e.preventDefault();

            const targetTaskItem = e.target.closest('.task-row-item, .habit-item');
            const targetDropzone = e.target.closest('.task-dropzone');
            const week = getCurrentWeekObj();

            const fromCat = draggedTaskInfo.fromCat;
            const taskId = draggedTaskInfo.taskId;

            if (fromCat === 'habits') {
                if (week.habits && Array.isArray(week.habits)) {
                    const fromIdx = week.habits.findIndex(h => h.id === taskId);
                    if (fromIdx !== -1) {
                        const [habit] = week.habits.splice(fromIdx, 1);
                        const targetHabitId = targetTaskItem ? targetTaskItem.getAttribute('data-task-id') : null;
                        const toIdx = targetHabitId ? week.habits.findIndex(h => h.id === targetHabitId) : -1;
                        if (toIdx !== -1) {
                            week.habits.splice(toIdx, 0, habit);
                        } else {
                            week.habits.push(habit);
                        }
                        draggedTaskInfo = null;
                        saveData();
                        renderAll();
                        return;
                    }
                }
            } else if (targetTaskItem) {
                const targetCat = targetTaskItem.closest('[data-category]')?.getAttribute('data-category');
                const targetTaskId = targetTaskItem.getAttribute('data-task-id');

                if (targetCat && week.tasks && week.tasks[fromCat]) {
                    const fromList = week.tasks[fromCat];
                    const fromIdx = fromList.findIndex(t => t.id === taskId);
                    
                    if (fromIdx !== -1) {
                        const [task] = fromList.splice(fromIdx, 1);
                        if (!week.tasks[targetCat]) week.tasks[targetCat] = [];
                        const toList = week.tasks[targetCat];
                        const toIdx = toList.findIndex(t => t.id === targetTaskId);

                        if (toIdx !== -1) {
                            toList.splice(toIdx, 0, task);
                        } else {
                            toList.push(task);
                        }

                        draggedTaskInfo = null;
                        saveData();
                        renderAll();
                        return;
                    }
                }
            } else if (targetDropzone) {
                const targetCat = targetDropzone.getAttribute('data-category');
                if (targetCat && week.tasks && week.tasks[fromCat]) {
                    const fromList = week.tasks[fromCat];
                    const fromIdx = fromList.findIndex(t => t.id === taskId);

                    if (fromIdx !== -1) {
                        const [task] = fromList.splice(fromIdx, 1);
                        if (!week.tasks[targetCat]) week.tasks[targetCat] = [];
                        week.tasks[targetCat].push(task);

                        draggedTaskInfo = null;
                        saveData();
                        renderAll();
                        return;
                    }
                }
            }
            draggedTaskInfo = null;
        });
    }

    window.handleTaskDragStart = function (e, fromCat, taskId) {
        e.stopPropagation();
        draggedTaskInfo = { fromCat, taskId };
        e.dataTransfer.effectAllowed = 'move';
    };

    function moveTaskBetweenCategories(fromCat, taskId, targetCat) {
        const week = getCurrentWeekObj();
        if (!week.tasks[fromCat]) return;
        const taskIdx = week.tasks[fromCat].findIndex(t => t.id === taskId);
        if (taskIdx !== -1) {
            const [task] = week.tasks[fromCat].splice(taskIdx, 1);
            if (!week.tasks[targetCat]) week.tasks[targetCat] = [];
            week.tasks[targetCat].push(task);
            saveData();
            renderAll();
        }
    }

    // --- SECTION 1: WEEKLY SCHEDULE TABLE WITH MULTI-HOUR SPANNING (ROWSPAN) ---
    function renderWeeklyTable() {
        const week = getCurrentWeekObj();
        const tbody = document.getElementById('weekly-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const schedule = (week.weeklySchedule && Object.keys(week.weeklySchedule).length > 0) 
            ? week.weeklySchedule 
            : SEED_DATA.weeklySchedule;

        const DEFAULT_HOURLY_SLOTS = [
            '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
            '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
            '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00',
            '20:00 - 21:00', '21:00 - 22:00', '22:00 - 23:00', '23:00 - 00:00'
        ];
        const slotKeys = Array.from(new Set([...DEFAULT_HOURLY_SLOTS, ...Object.keys(schedule)]));
        const spannedCoverage = [0, 0, 0, 0, 0, 0, 0];

        slotKeys.forEach((slot, sIdx) => {
            const tr = document.createElement('tr');
            let tdHtml = `<td contenteditable="true" onblur="window.updateSlotLabel('${slot}', this.innerText)">${escapeHtml(slot)}</td>`;

            for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                if (spannedCoverage[dayIdx] > 0) {
                    spannedCoverage[dayIdx]--;
                    continue;
                }

                const rawVal = getSlotItem(week, slot, dayIdx);
                let text = '';
                let isFixed = false;
                let durationHours = 1;

                if (typeof rawVal === 'string') {
                    text = rawVal;
                } else if (rawVal && typeof rawVal === 'object') {
                    text = rawVal.title || rawVal.text || '';
                    isFixed = !!rawVal.isFixed;
                    durationHours = parseInt(rawVal.durationHours || rawVal.duration, 10) || 1;
                }

                let rowspanAttr = '';
                let cellClass = '';
                if (text && durationHours > 1) {
                    rowspanAttr = `rowspan="${durationHours}"`;
                    cellClass = 'spanned-cell';
                    spannedCoverage[dayIdx] = durationHours - 1;
                }

                let timeBadgeText = '';
                if (durationHours > 1) {
                    const startHour = parseInt(slot.split(':')[0], 10) || 0;
                    const endHour = startHour + durationHours;
                    timeBadgeText = `<span class="duration-badge" style="font-size:10px; padding:1px 5px;">${durationHours} שעות (${String(startHour).padStart(2, '0')}:00 - ${String(endHour).padStart(2, '0')}:00)</span>`;
                }

                const hasItem = !!text && text.trim().length > 0;
                const dragAttr = hasItem ? `draggable="true" ondragstart="window.handleWeeklyCellDragStart(event, '${slot}', ${dayIdx})"` : '';

                tdHtml += `
                    <td ${rowspanAttr} class="${cellClass}" ${dragAttr} ondragover="event.preventDefault()" ondrop="window.handleWeeklyCellDrop(event, '${slot}', ${dayIdx})">
                        <div class="cell-content-wrapper">
                            <div class="cell-text" contenteditable="true" oninput="window.updateWeeklyCell('${slot}', ${dayIdx}, this.innerText, false)" onblur="window.updateWeeklyCell('${slot}', ${dayIdx}, this.innerText, true)">${escapeHtml(text)}</div>
                            ${hasItem ? `
                                <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap; margin-top:4px;">
                                    <button class="cell-delete-btn" onclick="event.stopPropagation(); window.deleteWeeklyCellEvent('${slot}', ${dayIdx})" title="מחק אירוע מהיומן" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); border-radius:4px; padding:2px 5px; font-size:10px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all 0.15s ease;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239,68,68,0.15)'; this.style.color='#ef4444';">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                    <div class="cell-type-toggle flex" onclick="window.toggleCellFixedStatus('${slot}', ${dayIdx})" title="לחץ לשינוי סוג אירוע" style="font-size:10px; padding:1px 5px;">
                                        ${isFixed ? '📌 קבוע' : '🔄 חד-פעמי'}
                                    </div>
                                    ${timeBadgeText}
                                    <button class="btn secondary-btn gcal-single-btn" onclick="window.exportSingleEventToICal('${slot}', ${dayIdx})" style="padding:1px 5px; font-size:10px;">GCal</button>
                                </div>
                            ` : ''}
                        </div>
                    </td>`;
            }

            tr.innerHTML = tdHtml;
            tbody.appendChild(tr);
        });
    }

    window.deleteWeeklyCellEvent = function (slot, dayIdx) {
        const week = getCurrentWeekObj();
        if (week.weeklySchedule && week.weeklySchedule[slot]) {
            delete week.weeklySchedule[slot][dayIdx];
        }
        saveData();
        renderWeeklyTable();
        renderTodayAgendaFeed();
    };

    window.handleWeeklyCellDragStart = function(e, slot, dayIdx) {
        const week = getCurrentWeekObj();
        const item = getSlotItem(week, slot, dayIdx);
        if (!item) return;
        const title = typeof item === 'string' ? item : (item.title || item.text);
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'weekly_cell',
            fromSlot: slot,
            fromDayIdx: dayIdx,
            title: title,
            item: item
        }));
    };

    window.handleWeeklyCellDrop = function(e, targetSlot, targetDayIdx) {
        e.preventDefault();
        const week = getCurrentWeekObj();
        if (!week.weeklySchedule) week.weeklySchedule = {};
        if (!week.weeklySchedule[targetSlot]) week.weeklySchedule[targetSlot] = {};

        let rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;

        try {
            const payload = JSON.parse(rawData);

            if (payload.type === 'weekly_cell') {
                if (week.weeklySchedule[payload.fromSlot]) {
                    delete week.weeklySchedule[payload.fromSlot][payload.fromDayIdx];
                }
                week.weeklySchedule[targetSlot][targetDayIdx] = payload.item;
                saveData();
                renderWeeklyTable();
                renderTodayAgendaFeed();
            } else if (payload.catId && payload.taskId) {
                const task = (week.tasks && week.tasks[payload.catId]) ? week.tasks[payload.catId].find(t => t.id === payload.taskId) : null;
                if (task) {
                    const title = task.title || task.text;
                    week.weeklySchedule[targetSlot][targetDayIdx] = {
                        title: title,
                        text: title,
                        catId: payload.catId,
                        taskId: payload.taskId,
                        isFixed: true,
                        durationHours: 1
                    };

                    const sunday = getSundayOfWeek(currentDate);
                    const targetDate = new Date(sunday);
                    targetDate.setDate(sunday.getDate() + targetDayIdx);
                    const dateIso = targetDate.toISOString().split('T')[0];

                    task.scheduledDateStr = dateIso;
                    task.scheduledWeekKey = currentWeekKey;
                    task.scheduledDay = targetDayIdx;
                    task.scheduledSlot = targetSlot;
                    task.scheduledDuration = 1;

                    saveData();
                    renderAll();
                }
            }
        } catch (err) {
            console.warn('Drop error:', err);
        }
    };


    window.deleteTask = function (catId, taskId) {
        const week = getCurrentWeekObj();
        let targetTitle = '';

        if (week.tasks && week.tasks[catId]) {
            const found = week.tasks[catId].find(t => t.id === taskId);
            if (found) targetTitle = found.title || found.text || '';
            week.tasks[catId] = week.tasks[catId].filter(t => t.id !== taskId);
        }

        // Remove from weeklySchedule in ALL weeks if matching taskId or targetTitle
        if (appData.weeks) {
            for (const wKey in appData.weeks) {
                const w = appData.weeks[wKey];
                if (w.weeklySchedule) {
                    for (const slot in w.weeklySchedule) {
                        for (const day in w.weeklySchedule[slot]) {
                            const item = w.weeklySchedule[slot][day];
                            if (item) {
                                const itemTitle = (typeof item === 'string') ? item : (item.title || item.text || '');
                                const itemTaskId = (typeof item === 'object') ? item.taskId : null;
                                if (itemTaskId === taskId || (targetTitle && itemTitle === targetTitle)) {
                                    delete w.weeklySchedule[slot][day];
                                }
                            }
                        }
                    }
                }
            }
        }

        saveData();
        renderAll();
    };

    window.deleteCategory = function (catId) {
        if (confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו?')) {
            appData.categories = appData.categories.filter(c => c.id !== catId);
            saveData();
            renderAll();
        }
    };

    // --- COMPLETED TASKS ARCHIVE BOX & MASTER V TABLE ---
    function renderCompletedArchive() {
        const week = getCurrentWeekObj();
        const archiveList = document.getElementById('completed-tasks-archive-list');
        if (!archiveList) return;
        archiveList.innerHTML = '';

        const items = week.completedArchive || [];
        if (items.length === 0) {
            archiveList.innerHTML = '<li class="empty-slot-placeholder" style="color:#10b981; font-weight:500;">סמן V על משימות והן יעברו לכאן!</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'completed-item-row';
            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="item-title">${escapeHtml(item.title)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="archive-badge">בוצע (${item.completedAt || ''})</span>
                    <button class="icon-btn" onclick="window.unarchiveTask('${item.id}')" title="החזר למשימות פתוחות"></button>
                    <button class="icon-btn" onclick="window.deleteArchivedTask('${item.id}')" title="מחק"></button>
                </div>
            `;
            archiveList.appendChild(li);
        });
    }

    function renderMasterVTable() {
        const week = getCurrentWeekObj();
        const masterList = document.getElementById('master-v-task-list');
        if (!masterList) return;
        masterList.innerHTML = '';

        const items = week.completedArchive || [];
        if (items.length === 0) {
            masterList.innerHTML = '<li class="empty-slot-placeholder" style="color:#10b981; font-weight:500;">כל משימה שתסמן עליה V (מכל הלשוניות והטבלאות) תופיע כאן אוטומטית!</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'completed-item-row';
            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i>
                    <span class="item-title" style="text-decoration:line-through; color:var(--text-dim-dark);">${escapeHtml(item.title)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="archive-badge">בוצע ב-${item.completedAt || 'שבוע זה'}</span>
                    <button class="icon-btn" onclick="window.unarchiveTask('${item.id}')" title="החזר למשימות פתוחות">החזר</button>
                    <button class="icon-btn" onclick="window.deleteArchivedTask('${item.id}')" title="מחק לצמיתות"></button>
                </div>
            `;
            masterList.appendChild(li);
        });
    }

    window.unarchiveTask = function (itemId) {
        const week = getCurrentWeekObj();
        const index = (week.completedArchive || []).findIndex(i => i.id === itemId);
        if (index !== -1) {
            const [item] = week.completedArchive.splice(index, 1);
            const targetCat = item.originalCategory || 'weekly';
            if (!week.tasks) week.tasks = {};
            if (!week.tasks[targetCat]) week.tasks[targetCat] = [];
            week.tasks[targetCat].push({ id: item.id, title: item.title });
            saveData();
            renderAll();
        }
    };

    window.deleteArchivedTask = function (itemId) {
        const week = getCurrentWeekObj();
        week.completedArchive = (week.completedArchive || []).filter(i => i.id !== itemId);
        saveData();
        renderAll();
    };

    // --- SHOPPING & DEBTS ---
    function renderShoppingAndDebts() {
        const week = getCurrentWeekObj();

        ['today', 'life', 'work', 'fun'].forEach(tabId => {
            const gList = document.getElementById(`groceries-list-${tabId}`);
            if (gList) {
                gList.innerHTML = '';
                const groceriesArr = (week.groceries && week.groceries.length > 0) ? week.groceries : SEED_DATA.groceries;
                groceriesArr.forEach(item => {
                    const li = document.createElement('li');
                    li.className = `check-item ${item.done ? 'done' : ''}`;
                    li.innerHTML = `
                        <span onclick="window.toggleCheckItem('groceries', '${item.id}')" style="cursor:pointer;">
                            ${escapeHtml(item.text)}
                        </span>
                        <button class="icon-btn" onclick="window.deleteCheckItem('groceries', '${item.id}')"></button>
                    `;
                    gList.appendChild(li);
                });
            }

            const gsList = document.getElementById(`general-shopping-list-${tabId}`);
            if (gsList) {
                gsList.innerHTML = '';
                const gsArr = (week.general_shopping && week.general_shopping.length > 0) ? week.general_shopping : SEED_DATA.general_shopping;
                gsArr.forEach(item => {
                    const li = document.createElement('li');
                    li.className = `check-item ${item.done ? 'done' : ''}`;
                    li.innerHTML = `
                        <span onclick="window.toggleCheckItem('general_shopping', '${item.id}')" style="cursor:pointer;">
                            ${escapeHtml(item.text)}
                        </span>
                        <button class="icon-btn" onclick="window.deleteCheckItem('general_shopping', '${item.id}')"></button>
                    `;
                    gsList.appendChild(li);
                });
            }

            const debtsTbody = document.getElementById(`debts-list-${tabId}`);
            if (debtsTbody) {
                debtsTbody.innerHTML = '';
                const debtsArr = (week.debts && week.debts.length > 0) ? week.debts : SEED_DATA.debts;
                debtsArr.forEach(d => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${escapeHtml(d.name)}</strong></td>
                        <td>₪${d.amount}</td>
                        <td><span class="archive-badge">${d.status}</span></td>
                        <td>
                            <button class="icon-btn" onclick="window.toggleDebtStatus('${d.id}')"></button>
                            <button class="icon-btn" onclick="window.deleteDebt('${d.id}')"></button>
                        </td>
                    `;
                    debtsTbody.appendChild(tr);
                });
            }
        });

        document.querySelectorAll('.add-item-btn').forEach(btn => {
            btn.onclick = () => {
                const type = btn.getAttribute('data-type');
                if (type === 'debts') {
                    const name = prompt('שם החייב / גורם:');
                    if (name) {
                        const amt = prompt('סכום בחשבון (₪):', '0');
                        if (!week.debts) week.debts = [];
                        week.debts.push({ id: 'd_' + Date.now(), name: name.trim(), amount: parseFloat(amt) || 0, notes: '', status: 'פתוח' });
                        saveData();
                        renderShoppingAndDebts();
                    }
                } else {
                    const text = prompt('הכנס פריט לקנייה:');
                    if (text && text.trim()) {
                        if (!week[type]) week[type] = [];
                        week[type].push({ id: 'i_' + Date.now(), text: text.trim(), done: false });
                        saveData();
                        renderShoppingAndDebts();
                    }
                }
            };
        });
    }

    window.toggleCheckItem = function (type, id) {
        const week = getCurrentWeekObj();
        if (!week[type]) return;
        const item = week[type].find(i => i.id === id);
        if (item) {
            item.done = !item.done;
            saveData();
            renderShoppingAndDebts();
        }
    };

    window.deleteCheckItem = function (type, id) {
        const week = getCurrentWeekObj();
        if (!week[type]) return;
        week[type] = week[type].filter(i => i.id !== id);
        saveData();
        renderShoppingAndDebts();
    };

    window.toggleDebtStatus = function (id) {
        const week = getCurrentWeekObj();
        if (!week.debts) return;
        const debt = week.debts.find(d => d.id === id);
        if (debt) {
            debt.status = debt.status === 'שולם' ? 'פתוח' : 'שולם';
            saveData();
            renderShoppingAndDebts();
        }
    };

    window.deleteDebt = function (id) {
        const week = getCurrentWeekObj();
        if (!week.debts) return;
        week.debts = week.debts.filter(d => d.id !== id);
        saveData();
        renderShoppingAndDebts();
    };

    function renderTodayTasksList() {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayDayIdx = new Date().getDay();
        const week = getCurrentWeekObj();

        ['today', 'life', 'work', 'fun', 'all'].forEach(suffix => {
            const ul = document.getElementById(`today-tasks-dedicated-list-${suffix}`);
            if (!ul) return;
            ul.innerHTML = '';

            let count = 0;
            for (let catId in (week.tasks || {})) {
                const catObj = (appData.categories || []).find(c => c.id === catId);
                const catTitle = catObj ? catObj.title : (SEED_DATA.headerTitles[catId] || catId);

                (week.tasks[catId] || []).forEach(t => {
                    if (t.scheduledDateStr === todayStr || t.scheduledDay == todayDayIdx || t.isTodayTask) {
                        count++;
                        const li = document.createElement('li');
                        li.className = 'task-row-item';
            li.setAttribute('data-task-id', t.id);
                        li.style.cssText = 'background:rgba(245, 158, 11, 0.08); border-right:3px solid var(--accent-orange); margin-bottom:6px; padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;';
                        
                        const slotLabel = t.scheduledSlot ? ` (${t.scheduledSlot})` : '';
                        li.innerHTML = `
                            <div class="task-checkbox-action" onclick="window.completeTaskAndArchive('${catId}', '${t.id}')" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                                <div class="checkbox-box"></div>
                                <span class="task-row-text" style="font-weight:600;">${escapeHtml(t.title)}</span>
                                <span class="archive-badge" style="background:rgba(245, 158, 11, 0.2); color:var(--accent-orange); font-size:11px; padding:2px 8px; border-radius:12px;"> ${escapeHtml(catTitle)}${escapeHtml(slotLabel)}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <button class="btn secondary-btn sm-btn" onclick="window.toggleTaskTodayQuickSched('${catId}', '${t.id}')" title="הסר מהיום">הסר</button>
                                <button class="icon-btn" onclick="window.deleteTask('${catId}', '${t.id}')" title="מחק"></button>
                            </div>
                        `;
                        uls.forEach(ul => ul.appendChild(li.cloneNode(true)));
                    }
                });
            }

            if (count === 0) {
                ul.innerHTML = `
                    <li class="empty-slot-placeholder" style="padding:16px; font-size:13px; color:var(--text-secondary-dark); text-align:center;">
                        <i class="fa-solid fa-sun" style="font-size:20px; color:var(--accent-orange); display:block; margin-bottom:6px;"></i>
                        אין עדיין משימות משובצות להיום. לחץ <strong>"+ היום"</strong> על משימה כלשהי או הוסף משימה חדשה בשדה למעלה!
                    </li>
                `;
            }
        });
    }

    function renderTodayScheduleFeed() {
        const now = new Date();
        const todayDayIdx = now.getDay();
        const dayName = DAYS_HEBREW[todayDayIdx];
        const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const week = getCurrentWeekObj();

        ['today', 'life', 'work', 'fun', 'all'].forEach(suffix => {
            const container = document.getElementById(`today-schedule-feed-container-${suffix}`);
            if (!container) return;
            container.innerHTML = '';

            const userSchedule = week.weeklySchedule || {};
            let count = 0;

            const listWrapper = document.createElement('div');
            listWrapper.className = 'agenda-items-list-wrapper';

            for (let slot in userSchedule) {
                const itemObj = userSchedule[slot] ? (userSchedule[slot][todayDayIdx] !== undefined ? userSchedule[slot][todayDayIdx] : userSchedule[slot][String(todayDayIdx)]) : null;
                let text = '';
                let isFixed = false;
                let durationHours = 1;

                if (typeof itemObj === 'string') {
                    text = itemObj;
                } else if (itemObj && typeof itemObj === 'object') {
                    text = itemObj.text || '';
                    isFixed = !!itemObj.isFixed;
                    durationHours = parseInt(itemObj.durationHours, 10) || 1;
                }

                if (text && text.trim()) {
                    count++;
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'today-slot-item';
                    let durationLabel = durationHours > 1 ? ` (${durationHours} שעות)` : '';

                    itemDiv.innerHTML = `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span class="today-time-badge">${escapeHtml(slot)}</span>
                            <span class="today-slot-text">${escapeHtml(text)}${durationLabel}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="cell-type-toggle ${isFixed ? 'fixed' : 'flex'}">${isFixed ? ' קבוע' : ' חד-פעמי'}</span>
                            <button class="btn-gcal-cell" onclick="window.openSingleEventInGCal('${slot}', ${todayDayIdx})" title="פתח ב-GCal">
                                GCal
                            </button>
                            <button class="icon-btn" onclick="window.clearSlotItem('${slot}', ${todayDayIdx})" title="מחק אירוע זה מלוז היום"></button>
                        </div>
                    `;
                    listWrapper.appendChild(itemDiv);
                }
            }

            container.appendChild(listWrapper);

            if (count === 0) {
                listWrapper.innerHTML = `
                    <div class="empty-slot-placeholder" style="padding:16px; font-size:13px; color:var(--text-secondary-dark); text-align:center;">
                        <i class="fa-solid fa-calendar-day" style="font-size:22px; color:var(--accent-indigo); display:block; margin-bottom:6px;"></i>
                        אין כרגע אירועים משוריינים במערכת השעות ליום ${dayName} (${dateFormatted}). כל אירוע שתקליד במערכת השעות יופיע כאן אוטומטית!
                    </div>
                `;
            }
        });
    }

    // --- REFLECTIONS ---
    function renderReflection() {
        const week = getCurrentWeekObj();
        const textarea = document.getElementById('weekly-reflection-input');
        if (!textarea) return;
        textarea.value = week.weeklyReflection || '';

        const saveBtn = document.getElementById('save-reflection-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                week.weeklyReflection = textarea.value;
                saveData();
                document.getElementById('reflection-save-status').textContent = 'נשמר בהצלחה!';
                setTimeout(() => document.getElementById('reflection-save-status').textContent = 'נשמר אוטומטית', 2000);
            };
        }
    }

    // --- DYNAMIC ACTIONS & MODALS ---
    function initDynamicActions() {
        const addRowBtn = document.getElementById('add-custom-row-btn');
        if (addRowBtn) {
            addRowBtn.onclick = () => {
                const slotName = prompt('הכנס כותרת/זמן לשורה החדשה (למשל: 07:00 - 08:00):');
                if (slotName && slotName.trim()) {
                    const week = getCurrentWeekObj();
                    if (!week.weeklySchedule) week.weeklySchedule = {};
                    if (!week.weeklySchedule[slotName.trim()]) {
                        week.weeklySchedule[slotName.trim()] = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
                        saveData();
                        renderWeeklyTable();
                        renderTodayAgendaFeed();
                    }
                }
            };
        }
    }

    window.saveTaskFromModal = function (e) {
        if (e) e.preventDefault();
        const catIdEl = document.getElementById('task-category-input');
        const titleEl = document.getElementById('task-title');
        const catId = catIdEl ? catIdEl.value : 'weekly';
        const title = titleEl ? titleEl.value.trim() : '';

        if (!title) return alert('אנא הכנס תיאור למשימה');

        const week = getCurrentWeekObj();
        if (!week.tasks) week.tasks = {};
        if (!week.tasks[catId]) week.tasks[catId] = [];
        week.tasks[catId].push({ id: 't_' + Date.now(), title });
        saveData();
        window.closeModal('task-modal');
        renderAll();
    };

    function initModals() {
        const taskForm = document.getElementById('task-form');
        if (taskForm) {
            taskForm.onsubmit = window.saveTaskFromModal;
        }

        const saveTaskBtn = document.getElementById('save-task-btn');
        if (saveTaskBtn) {
            saveTaskBtn.onclick = window.saveTaskFromModal;
        }
    }

    window.openAddTaskModal = function (catId) {
        const catInput = document.getElementById('task-category-input');
        const titleInput = document.getElementById('task-title');
        if (catInput) catInput.value = catId;
        if (titleInput) titleInput.value = '';
        const modal = document.getElementById('task-modal');
        if (modal) {
            modal.classList.add('active');
            setTimeout(() => { if (titleInput) titleInput.focus(); }, 100);
        }
    };

    function renderStats() {
        const week = getCurrentWeekObj();
        let plannedCount = 0;
        const schedule = (week.weeklySchedule && Object.keys(week.weeklySchedule).length > 0) 
            ? week.weeklySchedule 
            : SEED_DATA.weeklySchedule;

        for (let slot in schedule) {
            for (let d = 0; d < 7; d++) {
                if (schedule[slot] && schedule[slot][d]) plannedCount++;
            }
        }
        const statPlanned = document.getElementById('stat-planned-hours');
        if (statPlanned) statPlanned.textContent = `${plannedCount} פעילויות`;

        const habitsArr = (week.habits && week.habits.length > 0) ? week.habits : SEED_DATA.habits;
        const totalHabits = habitsArr.length;
        const checkedHabits = habitsArr.filter(h => h.checked).length;
        const habitsPct = totalHabits ? Math.round((checkedHabits / totalHabits) * 100) : 0;

        const statHabits = document.getElementById('stat-habits-rate');
        if (statHabits) statHabits.textContent = `${checkedHabits} / ${totalHabits} (${habitsPct}%)`;
        const habitsBar = document.getElementById('habits-progress-bar');
        if (habitsBar) habitsBar.style.width = `${habitsPct}%`;

        let openTasksCount = 0;
        const tasksObj = (week.tasks && Object.keys(week.tasks).length > 0) ? week.tasks : SEED_DATA.tasks;
        for (let c in tasksObj) {
            openTasksCount += (tasksObj[c] || []).length;
        }
        const statOpen = document.getElementById('stat-open-tasks');
        if (statOpen) statOpen.textContent = `${openTasksCount} משימות`;

        const completedCount = (week.completedArchive || []).length;
        const statDone = document.getElementById('stat-completed-tasks');
        if (statDone) statDone.textContent = `${completedCount} משימות`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // --- CREATIVE FUN SUITE WIDGETS (v34.0) ---

    // 1. FREE TEXT SCRATCHPAD
    function initFunScratchpad() {
        const textarea = document.getElementById('fun-scratchpad');
        if (!textarea) return;

        textarea.oninput = () => {
            const week = getCurrentWeekObj();
            week.funScratchpad = textarea.value;
            saveData();
            const status = document.getElementById('scratchpad-save-status');
            if (status) {
                status.textContent = 'נשמר בהצלחה!';
                setTimeout(() => { status.textContent = 'נשמר אוטומטית'; }, 1500);
            }
        };
    }

    function renderFunScratchpad() {
        const textarea = document.getElementById('fun-scratchpad');
        if (!textarea) return;
        const week = getCurrentWeekObj();
        textarea.value = week.funScratchpad || '';
    }

    // 2. INTERACTIVE DRAWING CANVAS
    let isDrawing = false;
    let canvasColor = '#6366f1';
    let brushSize = 4;
    let isEraserMode = false;

    function initFunCanvas() {
        const canvas = document.getElementById('fun-drawing-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        function startDraw(e) {
            isDrawing = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            e.preventDefault();
        }

        function draw(e) {
            if (!isDrawing) return;
            const pos = getPos(e);
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = isEraserMode ? '#ffffff' : canvasColor;
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            e.preventDefault();
        }

        function endDraw() {
            if (isDrawing) {
                isDrawing = false;
                ctx.closePath();
                saveFunCanvasData();
            }
        }

        canvas.onmousedown = startDraw;
        canvas.onmousemove = draw;
        canvas.onmouseup = endDraw;
        canvas.onmouseleave = endDraw;

        canvas.ontouchstart = startDraw;
        canvas.ontouchmove = draw;
        canvas.ontouchend = endDraw;
    }

    function saveFunCanvasData() {
        const canvas = document.getElementById('fun-drawing-canvas');
        if (!canvas) return;
        const week = getCurrentWeekObj();
        week.funDrawingDataUrl = canvas.toDataURL();
        saveData();
    }

    function renderFunCanvas() {
        const canvas = document.getElementById('fun-drawing-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const week = getCurrentWeekObj();
        if (week.funDrawingDataUrl) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = week.funDrawingDataUrl;
        }
    }

    window.setCanvasColor = function(color, btn) {
        canvasColor = color;
        isEraserMode = false;
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const eraserBtn = document.getElementById('eraser-btn');
        if (eraserBtn) eraserBtn.classList.remove('primary-btn');
    };

    window.setBrushSize = function(size) {
        brushSize = parseInt(size, 10) || 4;
    };

    window.toggleCanvasEraser = function() {
        isEraserMode = !isEraserMode;
        const eraserBtn = document.getElementById('eraser-btn');
        if (eraserBtn) {
            if (isEraserMode) {
                eraserBtn.classList.add('primary-btn');
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            } else {
                eraserBtn.classList.remove('primary-btn');
            }
        }
    };

    window.clearFunCanvas = function() {
        const canvas = document.getElementById('fun-drawing-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const week = getCurrentWeekObj();
        delete week.funDrawingDataUrl;
        saveData();
    };

    window.downloadFunDrawing = function() {
        const canvas = document.getElementById('fun-drawing-canvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `ziv_drawing_${currentWeekKey}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // 3. DAILY PHOTO GALLERY OF THE WEEK
    function renderDailyPhotoGallery() {
        const container = document.getElementById('daily-photos-container');
        if (!container) return;
        container.innerHTML = '';

        const week = getCurrentWeekObj();
        if (!week.dailyPhotos) week.dailyPhotos = {};

        const sunday = getSundayOfWeek(currentDate);

        for (let i = 0; i < 7; i++) {
            const dt = new Date(sunday);
            dt.setDate(sunday.getDate() + i);
            const dateStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const photoUrl = week.dailyPhotos[i];

            const card = document.createElement('div');
            card.className = 'daily-photo-card';

            card.innerHTML = `
                <div class="daily-photo-header">
                    <span>יום ${DAYS_HEBREW[i]}</span>
                    <span style="font-size:11px; opacity:0.7;">(${dateStr})</span>
                </div>
                <div class="daily-photo-preview-wrapper">
                    ${photoUrl ? `
                        <img src="${photoUrl}" alt="תמונת יום ${DAYS_HEBREW[i]}" class="daily-photo-preview-img">
                        <button class="daily-photo-delete-btn" onclick="window.deleteDailyPhoto(${i})" title="מחק תמונה">&times;</button>
                    ` : `
                        <span style="font-size:11px; color:var(--text-dim-dark);"><i class="fa-solid fa-image" style="font-size:20px; display:block; margin-bottom:4px; opacity:0.5;"></i>אין תמונה</span>
                    `}
                </div>
                <button class="daily-photo-upload-btn" onclick="window.uploadDailyPhoto(${i})">
                    ${photoUrl ? 'החלף' : 'העלה'}
                </button>
            `;
            container.appendChild(card);
        }
    }

    window.uploadDailyPhoto = function(dayIdx) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxDim = 800;
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

                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

                    const week = getCurrentWeekObj();
                    if (!week.dailyPhotos) week.dailyPhotos = {};
                    week.dailyPhotos[dayIdx] = compressedDataUrl;
                    saveData();
                    renderDailyPhotoGallery();
                    renderTodayFeaturedPhoto();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };

        fileInput.click();
    };

    window.deleteDailyPhoto = function(dayIdx) {
        const week = getCurrentWeekObj();
        if (week.dailyPhotos && week.dailyPhotos[dayIdx]) {
            delete week.dailyPhotos[dayIdx];
            saveData();
            renderDailyPhotoGallery();
            renderTodayFeaturedPhoto();
        }
    };

    // 4. TODAY FEATURED PHOTO CARD (Synced with Weekly Photo Gallery)
    function renderTodayFeaturedPhoto() {
        const wrapper = document.getElementById('today-featured-photo-wrapper');
        const label = document.getElementById('today-photo-date-label');
        if (!wrapper) return;

        const now = new Date();
        const todayDayIdx = now.getDay();
        const dayName = DAYS_HEBREW[todayDayIdx];
        const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (label) label.textContent = `יום ${dayName} ${dateFormatted}`;

        const week = getCurrentWeekObj();
        const photoUrl = (week.dailyPhotos && week.dailyPhotos[todayDayIdx]) ? week.dailyPhotos[todayDayIdx] : null;

        if (photoUrl) {
            wrapper.innerHTML = `
                <div style="position:relative; max-width:340px; margin:0 auto; border-radius:12px; overflow:hidden; border:1px solid rgba(249, 115, 22, 0.3); box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
                    <img src="${photoUrl}" alt="תמונת יום ${dayName}" style="width:100%; max-height:260px; object-fit:cover; display:block; border-radius:12px; transition:transform 0.3s ease;">
                </div>
                <div style="margin-top:12px; display:flex; justify-content:center; gap:8px;">
                    <button class="btn primary-btn sm-btn" onclick="window.uploadDailyPhoto(${todayDayIdx})">החלף תמונת יום</button>
                    <button class="btn secondary-btn sm-btn" onclick="window.deleteDailyPhoto(${todayDayIdx})">מחק</button>
                </div>
            `;
        } else {
            wrapper.innerHTML = `
                <div style="padding:24px; border:2px dashed rgba(249, 115, 22, 0.3); border-radius:12px; background:rgba(249, 115, 22, 0.05);">
                    <i class="fa-solid fa-camera" style="font-size:32px; color:var(--accent-orange); margin-bottom:10px; display:block;"></i>
                    <p style="font-size:13px; color:var(--text-secondary-dark); margin-bottom:12px; font-weight:600;">טרם הועלתה תמונה עבור יום ${dayName} (${dateFormatted})</p>
                    <button class="btn primary-btn sm-btn" onclick="window.uploadDailyPhoto(${todayDayIdx})">העלה תמונת יום להיום</button>
                </div>
            `;
        }
    }

    // 5. TODAY DRAWING CANVAS
    let isTodayDrawing = false;
    let todayCanvasColor = '#6366f1';
    let todayBrushSize = 4;
    let isTodayEraserMode = false;

    function initTodayCanvas() {
        const canvas = document.getElementById('today-drawing-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        function startDraw(e) {
            isTodayDrawing = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            e.preventDefault();
        }

        function draw(e) {
            if (!isTodayDrawing) return;
            const pos = getPos(e);
            ctx.lineWidth = todayBrushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = isTodayEraserMode ? '#ffffff' : todayCanvasColor;
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            e.preventDefault();
        }

        function endDraw() {
            if (isTodayDrawing) {
                isTodayDrawing = false;
                ctx.closePath();
                saveTodayCanvasData();
            }
        }

        canvas.onmousedown = startDraw;
        canvas.onmousemove = draw;
        canvas.onmouseup = endDraw;
        canvas.onmouseleave = endDraw;

        canvas.ontouchstart = startDraw;
        canvas.ontouchmove = draw;
        canvas.ontouchend = endDraw;
    }

    function saveTodayCanvasData() {
        const canvas = document.getElementById('today-drawing-canvas');
        if (!canvas) return;
        const week = getCurrentWeekObj();
        week.todayDrawingDataUrl = canvas.toDataURL();
        saveData();
    }

    function renderTodayCanvas() {
        const canvas = document.getElementById('today-drawing-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const week = getCurrentWeekObj();
        if (week.todayDrawingDataUrl) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = week.todayDrawingDataUrl;
        }
    }

    window.setTodayCanvasColor = function(color, btn) {
        todayCanvasColor = color;
        isTodayEraserMode = false;
        document.querySelectorAll('#subtab-today .color-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const eraserBtn = document.getElementById('today-eraser-btn');
        if (eraserBtn) eraserBtn.classList.remove('primary-btn');
    };

    window.setTodayBrushSize = function(size) {
        todayBrushSize = parseInt(size, 10) || 4;
    };

    window.toggleTodayCanvasEraser = function() {
        isTodayEraserMode = !isTodayEraserMode;
        const eraserBtn = document.getElementById('today-eraser-btn');
        if (eraserBtn) {
            if (isTodayEraserMode) {
                eraserBtn.classList.add('primary-btn');
                document.querySelectorAll('#subtab-today .color-btn').forEach(b => b.classList.remove('active'));
            } else {
                eraserBtn.classList.remove('primary-btn');
            }
        }
    };

    window.clearTodayCanvas = function() {
        const canvas = document.getElementById('today-drawing-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const week = getCurrentWeekObj();
        delete week.todayDrawingDataUrl;
        saveData();
    };

    window.downloadTodayDrawing = function() {
        const canvas = document.getElementById('today-drawing-canvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `ziv_today_drawing_${currentWeekKey}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };


    
    window.toggleCategoryTabAssignment = function (catId, tabName, isChecked) {
        const cat = (appData.categories || []).find(c => c.id === catId);
        if (!cat) return;
        if (!cat.tabs) {
            cat.tabs = cat.tabId ? cat.tabId.split(',').map(s => s.trim()) : ['work'];
        }
        if (isChecked) {
            if (!cat.tabs.includes(tabName)) cat.tabs.push(tabName);
        } else {
            cat.tabs = cat.tabs.filter(t => t !== tabName);
            if (cat.tabs.length === 0) cat.tabs = [tabName]; // Keep at least 1 tab
        }
        cat.tabId = cat.tabs.join(',');
        saveData();
        renderAll();
    };


    
    window.toggleTableTabAssignment = function (catId, tabName, isChecked) {
        const cat = (appData.categories || []).find(c => c.id === catId);
        if (cat) {
            if (!cat.tabs) {
                cat.tabs = cat.tabId ? cat.tabId.split(',').map(s => s.trim()) : ['work'];
            }
            if (isChecked) {
                if (!cat.tabs.includes(tabName)) cat.tabs.push(tabName);
            } else {
                cat.tabs = cat.tabs.filter(t => t !== tabName);
                if (cat.tabs.length === 0) cat.tabs = [tabName];
            }
            cat.tabId = cat.tabs.join(',');
        } else {
            if (!appData.coreTableTabs) appData.coreTableTabs = JSON.parse(JSON.stringify(DEFAULT_CORE_TABS));
            let curVal = appData.coreTableTabs[catId] || 'work';
            let curTabs = curVal.split(',').map(s => s.trim());
            if (isChecked) {
                if (!curTabs.includes(tabName)) curTabs.push(tabName);
            } else {
                curTabs = curTabs.filter(t => t !== tabName);
                if (curTabs.length === 0) curTabs = [tabName];
            }
            appData.coreTableTabs[catId] = curTabs.join(',');
        }

        saveData();
        renderAll();
    };

    window.toggleCategoryTabAssignment = window.toggleTableTabAssignment;


    window.deleteTableCard = function (key) {
        let title = key;
        const cat = (appData.categories || []).find(c => c.id === key);
        if (cat) title = cat.title || key;
        else if (appData.headerTitles && appData.headerTitles[key]) title = appData.headerTitles[key];

        if (confirm('האם אתה בטוח לחלוטין שברצונך למחוק את הטבלה "' + title + '"?')) {
            if (cat) {
                appData.categories = (appData.categories || []).filter(c => c.id !== key);
            } else {
                if (!appData.hiddenCoreTables) appData.hiddenCoreTables = {};
                appData.hiddenCoreTables[key] = true;
            }
            saveData();
            renderAll();
        }
    };

})();
