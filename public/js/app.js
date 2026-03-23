document.addEventListener('DOMContentLoaded', () => {
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const statusBadge = document.querySelector('.status-badge');
    const statusTime = document.getElementById('statusTime');
    const historyList = document.getElementById('historyList');
    const refreshBtn = document.getElementById('refreshBtn');
    const actionFeedback = document.getElementById('actionFeedback');
    const liveSeconds = document.getElementById('liveSeconds');
    const liveDate = document.getElementById('liveDate');
    const totalEventsLabel = document.getElementById('totalEventsLabel');
    const totalHours = document.getElementById('totalHours');
    const totalEvents = document.getElementById('totalEvents');
    const summaryDate = document.getElementById('summaryDate');
    const progressFill = document.getElementById('progressFill');
    const overtimeLabel = document.getElementById('overtimeLabel');
    const targetHoursEl = document.getElementById('targetHours');
    const healthDot = document.getElementById('healthDot');
    const healthText = document.getElementById('healthText');

    let currentStatus = 'OUT'; // Track current clock state
    let allHistoryEvents = [];
    let currentHistoryFilter = 'ALL';

    const USER_ID = 1;
    const API_BASE = '/api';

    // ── Init ──
    const initStatus = fetchStatus();
    const initHistory = fetchHistory();
    const initSummary = fetchTodaySummary();
    updateLiveClock();
    setInterval(updateLiveClock, 1000);
    updateSummaryDate();
    
    // System Health Check
    fetchHealth();
    setInterval(fetchHealth, 30000); // Check every 30s

    // ── Events ──
    const filterTabs = document.querySelectorAll('.filter-tab');
    const tabSlider = document.getElementById('tabSlider');

    filterTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Slide the physical thumb underlying the tabs
            if (tabSlider) {
                tabSlider.style.transform = `translateX(${index * 58}px)`;
            }

            currentHistoryFilter = tab.dataset.filter;
            applyHistoryFilter();
        });
    });

    clockInBtn.addEventListener('click', () => handleClockAction('IN'));
    clockOutBtn.addEventListener('click', () => handleClockAction('OUT'));
    refreshBtn.addEventListener('click', () => {
        animatePress(refreshBtn);
        fetchStatus();
        fetchHistory();
        fetchTodaySummary();
    });

    // ── Live Clock ──
    function updateLiveClock() {
        const now = new Date();
        const hour = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('liveHour').textContent = hour;
        document.getElementById('liveMinute').textContent = min;
        liveSeconds.textContent = ':' + String(now.getSeconds()).padStart(2, '0');
        liveDate.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function updateSummaryDate() {
        const now = new Date();
        summaryDate.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // ── API ──
    async function fetchStatus() {
        try {
            const res = await fetch(`${API_BASE}/clock/status/${USER_ID}`);
            if (res.ok) {
                const data = await res.json();
                updateStatusUI(data.status, data.since);
            } else if (res.status === 404) {
                updateStatusUI('OUT', null);
            } else {
                showFeedback('Failed to load status', 'error');
            }
        } catch (err) {
            console.error('API Error:', err);
            showFeedback('Network error', 'error');
        }
    }

    async function fetchHistory() {
        try {
            // Increased limit to 50 so filtering has meaningful data
            const res = await fetch(`${API_BASE}/events?userId=${USER_ID}&page=1&limit=50`);
            if (res.ok) {
                const data = await res.json();
                
                allHistoryEvents = data.events;
                updateTabCounts();
                applyHistoryFilter();
                totalEventsLabel.textContent = data.total;
                
                // Count today's events
                const today = new Date().toDateString();
                const todayEvents = data.events.filter(e => new Date(e.timestamp).toDateString() === today);
                totalEvents.textContent = todayEvents.length;
            } else {
                historyList.innerHTML = `
                    <tr>
                        <td colspan="3" class="empty-state">
                            <div class="empty-state-content">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                <span class="empty-state-title">FAILED TO LOAD</span>
                                <span class="empty-state-desc">SERVER RETURNED AN ERROR</span>
                            </div>
                        </td>
                    </tr>`;
            }
        } catch (err) {
            console.error('API Error:', err);
            historyList.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state">
                        <div class="empty-state-content">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span class="empty-state-title">CONNECTION ERROR</span>
                            <span class="empty-state-desc">NETWORK UNREACHABLE</span>
                        </div>
                    </td>
                </tr>`;
        }
    }

    function updateTabCounts() {
        const inCount = allHistoryEvents.filter(e => e.type === 'IN').length;
        const outCount = allHistoryEvents.filter(e => e.type === 'OUT').length;
        document.getElementById('countAll').textContent = allHistoryEvents.length;
        document.getElementById('countIn').textContent = inCount;
        document.getElementById('countOut').textContent = outCount;
    }

    function applyHistoryFilter() {
        let filtered = allHistoryEvents;
        if (currentHistoryFilter !== 'ALL') {
            filtered = allHistoryEvents.filter(e => e.type === currentHistoryFilter);
        }
        renderHistory(filtered);
    }

    // ── System Health ──
    async function fetchHealth() {
        try {
            const res = await fetch(`${API_BASE}/health`);
            if (res.ok) {
                const data = await res.json();
                healthDot.className = 'health-dot online';
                healthText.textContent = `ONLINE // ${data.service.toUpperCase()}`;
            } else {
                throw new Error();
            }
        } catch (err) {
            healthDot.className = 'health-dot offline';
            healthText.textContent = 'ERROR // CONNECTION_LOST';
        }
    }

    // ── Today's Summary (Report API) ──
    async function fetchTodaySummary() {
        try {
            // Use start-of-day (local) to NOW as the report range.
            // IMPORTANT: The Report API counts open sessions up to endDate,
            // so we must use NOW (not end-of-day) to avoid counting future hours.
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startISO = startOfDay.toISOString();
            const endISO = now.toISOString();

            const res = await fetch(`${API_BASE}/report?userId=${USER_ID}&start=${startISO}&end=${endISO}`);
            if (res.ok) {
                const data = await res.json();
                
                // Sum all daily entries (handles UTC day split)
                let worked = 0;
                let overtime = 0;
                let normalHours = 8;
                for (const d of (data.daily || [])) {
                    worked += d.workedHours;
                    overtime += d.overtime;
                    normalHours = d.normalHours || 8;
                }
                worked = Math.round(worked * 100) / 100;
                overtime = Math.round(overtime * 100) / 100;

                // Update hours display
                totalHours.textContent = worked.toFixed(1);
                targetHoursEl.textContent = normalHours;

                // Update progress bar segments
                const pct = Math.min((worked / normalHours) * 100, 100);
                updateProgressSegments(pct);

                // Active pulse when clocked in
                if (currentStatus === 'IN') {
                    progressFill.classList.add('is-active');
                } else {
                    progressFill.classList.remove('is-active');
                }

                // Overtime display
                if (overtime > 0) {
                    overtimeLabel.textContent = `+${overtime.toFixed(1)}H OT`;
                } else {
                    overtimeLabel.textContent = 'NO OT';
                }
            }
        } catch (err) {
            console.error('Report API Error:', err);
        }
    }

    // ── Progress bar segment updater ──
    function updateProgressSegments(pct) {
        const segments = progressFill.querySelectorAll('.progress-segment');
        const totalSegments = segments.length;
        let activeCount = Math.round((pct / 100) * totalSegments);
        if (pct > 0 && activeCount === 0) {
            activeCount = 1; // Show first segment once any time is worked
        }
        if (activeCount > totalSegments) {
            activeCount = totalSegments;
        }
        segments.forEach((seg, i) => {
            if (i < activeCount) {
                seg.classList.add('filled');
            } else {
                seg.classList.remove('filled');
            }
        });
    }

    async function handleClockAction(type) {
        const btn = type === 'IN' ? clockInBtn : clockOutBtn;
        animatePress(btn);

        try {
            const res = await fetch(`${API_BASE}/clock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, type })
            });

            if (res.status === 201) {
                const feedbackType = type === 'OUT' ? 'error' : 'success';
                showFeedback(`Clocked ${type.toLowerCase()} — OK`, feedbackType);
                await fetchStatus();
                await fetchHistory();
                await fetchTodaySummary();
            } else if (res.status === 409) {
                showFeedback(`Already clocked ${type.toLowerCase()}`, 'error');
            } else {
                const errData = await res.json();
                showFeedback(errData.error || 'Failed', 'error');
            }
        } catch (err) {
            console.error('API Error:', err);
            showFeedback('Network error', 'error');
        }
    }

    // ── UI ──
    function updateStatusUI(status, sinceStr) {
        statusIndicator.className = 'status-dot';
        statusBadge.className = 'status-badge'; // Reset classes
        currentStatus = status; // Track for progress bar pulse
        if (status === 'IN') {
            statusIndicator.classList.add('is-in');
            statusBadge.classList.add('badge-in');
            statusText.textContent = 'Clocked In';
        } else {
            statusIndicator.classList.add('is-out');
            statusBadge.classList.add('badge-out');
            statusText.textContent = 'Clocked Out';
        }

        if (sinceStr) {
            const d = new Date(sinceStr);
            statusTime.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            statusTime.textContent = '--:--';
        }
    }

    function renderHistory(events) {
        if (!events || events.length === 0) {
            historyList.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state">
                        <div class="empty-state-content">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <span class="empty-state-title">NO EVENTS FOUND</span>
                            <span class="empty-state-desc">OR SYSTEM IDLE</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        historyList.innerHTML = '';
        let lastDateGroup = null;

        // IMPORTANT: Always build session map from ALL events, not the filtered subset.
        // If built from filtered events (e.g. OUT-only), paired IN events are missing
        // and elapsed time cannot be computed for any row.
        const allSorted = [...allHistoryEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const sessionMap = new Map();
        let pendingIn = null;
        for (const evt of allSorted) {
            if (evt.type === 'IN') {
                pendingIn = evt;
            } else if (evt.type === 'OUT' && pendingIn) {
                const elapsed = new Date(evt.timestamp) - new Date(pendingIn.timestamp);
                const isOvertime = elapsed > 8 * 60 * 60 * 1000; // > 8 hours
                sessionMap.set(pendingIn.id, { elapsed, isOvertime });
                sessionMap.set(evt.id, { elapsed, isOvertime, isOut: true });
                pendingIn = null;
            }
        }

        function formatElapsed(ms) {
            const totalMin = Math.floor(ms / 60000);
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            if (h > 0) return `${h}h ${m}m`;
            return `${m}m`;
        }

        events.forEach(evt => {
            const t = new Date(evt.timestamp);
            const dateStr = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // Generate Date Group Separator
            if (dateStr !== lastDateGroup) {
                const sepTr = document.createElement('tr');
                sepTr.className = 'date-separator';
                sepTr.innerHTML = `
                    <td colspan="3">
                        <div class="date-separator-wrapper">
                            <span class="date-separator-label">${dateStr.toUpperCase()}</span>
                        </div>
                    </td>
                `;
                historyList.appendChild(sepTr);
                lastDateGroup = dateStr;
            }

            const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const isIn = evt.type === 'IN';
            const color = isIn ? 'green' : 'red';
            const label = isIn ? 'CLOCK IN' : 'CLOCK OUT';

            // Compute STATUS tag
            const session = sessionMap.get(evt.id);

            // Reusable icon snippets — inherit currentColor from badge
            // Activity pulse wave for ACTIVE — "live/running signal", clean at 7px
            const iconActive   = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
            const iconLogged = `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">     
                                    <g transform="translate(24,0) scale(-1,1)">
                                    <polyline points="9 10 4 15 9 20"/>
                                    <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                                    </g>
                                </svg>`;            
            const iconClosed   = `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>`;
            const iconOvertime = `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
            const iconMissed   = `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="flex-shrink:0;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

            let statusTag = '';
            if (isIn) {
                if (!session) {
                    // Currently clocked in, no OUT yet
                    statusTag = `<span class="type-badge badge-status-active">${iconActive}ACTIVE</span>`;
                } else if (session.isOvertime) {
                    statusTag = `<span class="type-badge badge-status-overtime">${iconOvertime}OVERTIME</span>`;
                } else {
                    // IN row of a completed session → LOGGED
                    statusTag = `<span class="type-badge badge-status-started">${iconLogged}LOGGED</span>`;
                }
            } else {
                // OUT event
                if (session) {
                    statusTag = session.isOvertime
                        ? `<span class="type-badge badge-status-overtime">${iconOvertime}OVERTIME</span>`
                        : `<span class="type-badge badge-status-closed">${iconClosed}CLOSED</span>`;
                } else {
                    statusTag = `<span class="type-badge badge-status-missed">${iconMissed}MISSED</span>`;
                }
            }

            // Elapsed chip: only show on OUT events that have a paired IN
            const iconDuration = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
            let elapsedHtml = '';
            if (!isIn && session && session.isOut) {
                elapsedHtml = `<span class="time-elapsed-sub">${iconDuration}${formatElapsed(session.elapsed)}</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="type-badge badge-${color}">${label}</div>
                </td>
                <td style="text-align: center;">${statusTag}</td>
                <td class="table-data-value" style="text-align:right;">
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
                        <span>${timeStr}</span>
                        ${elapsedHtml}
                    </div>
                </td>
            `;
            historyList.appendChild(tr);
        });
    }

    let feedbackTimeout;
    function showFeedback(msg, type) {
        const feedbackEl = document.getElementById('actionFeedback');
        const feedbackText = document.getElementById('feedbackText');
        
        feedbackText.textContent = msg;
        feedbackEl.className = `printer-slip show ${type}`;
        
        clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(() => feedbackEl.classList.remove('show'), 4000);
    }

    function animatePress(el) {
        el.classList.add('is-active');
        el.classList.add('active-press');
        setTimeout(() => {
            el.classList.remove('is-active');
            el.classList.remove('active-press');
        }, 150);
    }

    // ── Panel Connectors (Machined System Bus) ──
    function drawConnectors() {
        const dashboard = document.querySelector('.dashboard');
        const layer = document.getElementById('connectorLayer');
        if (!dashboard || !layer) return;

        const status = document.querySelector('[data-panel="status"]');
        const controls = document.querySelector('[data-panel="controls"]');
        const summary = document.querySelector('[data-panel="summary"]');
        const activity = document.querySelector('[data-panel="activity"]');
        const userprofile = document.querySelector('[data-panel="userprofile"]');
        if (!status || !controls || !summary || !activity) return;

        const dRect = dashboard.getBoundingClientRect();
        const rel = (el) => {
            const r = el.getBoundingClientRect();
            return {
                top: r.top - dRect.top,
                bottom: r.bottom - dRect.top,
                left: r.left - dRect.left,
                right: r.right - dRect.left,
                cx: (r.left + r.right) / 2 - dRect.left,
                cy: (r.top + r.bottom) / 2 - dRect.top,
                w: r.width,
                h: r.height
            };
        };

        const sR = rel(status);
        const cR = rel(controls);
        const smR = rel(summary);
        const aR = rel(activity);

        const ns = 'http://www.w3.org/2000/svg';

        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'panel-connector');
        svg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible;`;

        // Draws a groove + highlight pair (like panel-divider)
        function addTrace(d) {
            // Highlight (white specular, offset right+down for top-left light)
            const highlight = document.createElementNS(ns, 'path');
            highlight.setAttribute('d', d);
            highlight.setAttribute('class', 'connector-highlight');
            highlight.setAttribute('transform', 'translate(1, 1)');
            svg.appendChild(highlight);

            // Dark groove (on top)
            const groove = document.createElementNS(ns, 'path');
            groove.setAttribute('d', d);
            groove.setAttribute('class', 'connector-path');
            svg.appendChild(groove);
        }

        // 1. Status bottom-center → Controls top-center
        addTrace(`M${sR.cx} ${sR.bottom} V${cR.top}`);

        // 2. Controls bottom-center → Summary top-center
        addTrace(`M${cR.cx} ${cR.bottom} V${smR.top}`);

        // 3. Controls right → Activity left (L-shaped bridge with 90° bends)
        const midX = (cR.right + aR.left) / 2;
        const targetY = aR.top + 40;
        addTrace(`M${cR.right} ${cR.cy} H${midX} V${targetY} H${aR.left}`);

        // 4. Activity top-right → User Profile bottom (vertical up)
        if (userprofile) {
            const upR = rel(userprofile);
            const connX = aR.right - 30; // Near the right edge
            addTrace(`M${connX} ${aR.top} V${upR.bottom}`);
        }

        layer.innerHTML = '';
        layer.appendChild(svg);
    }

    // Draw after layout settles
    setTimeout(drawConnectors, 100);
    window.addEventListener('resize', drawConnectors);
    // ── ONBOARDING TOUR ──
    const startTourBtn = document.getElementById('startTourBtn');
    const tourSpotlight = document.getElementById('tourSpotlight');
    const tourTooltip = document.getElementById('tourTooltip');
    const tourTitle = document.getElementById('tourTitle');
    const tourStepIndicator = document.getElementById('tourStepIndicator');
    const tourContent = document.getElementById('tourContent');
    const tourSkipBtn = document.getElementById('tourSkipBtn');
    const tourPrevBtn = document.getElementById('tourPrevBtn');
    const tourNextBtn = document.getElementById('tourNextBtn');

    const tourSteps = [
        {
            sel: '[data-panel="status"]',
            title: 'SYSTEM STATUS',
            text: 'Here is your live time and status indicator. Tells you if you are clocked in or out.'
        },
        {
            sel: '[data-panel="controls"]',
            title: 'HARDWARE BUTTONS',
            text: 'Use these buttons to clock in or out. Please ensure you only press once.'
        },
        {
            sel: '[data-panel="summary"]',
            title: 'DAILY SUMMARY',
            text: 'Your total hours and overtime for the day. Watch the progress bar fill up while you grind.'
        },
        {
            sel: '[data-panel="activity"]',
            title: 'EVENT LOG',
            text: 'Every single event is logged here. Use the filter tabs to sort your activity.'
        }
    ];

    let currentTourStep = 0;
    let activeTourElement = null;
    let tourActive = false;

    function posTooltip(elRect, stepIndex) {
        let top = elRect.bottom + 16;
        let left = elRect.left + (elRect.width / 2) - 160;
        
        // Adjust vertically for last step to be INSIDE the panel at bottom
        if (stepIndex === tourSteps.length - 1) {
            top = elRect.bottom - 160 - 24; 
        } else if (top + 150 > window.innerHeight) {
            top = elRect.top - 180;
        }
        if (left < 10) left = 10;
        if (left + 330 > window.innerWidth) left = window.innerWidth - 340;

        tourTooltip.style.top = `${top}px`;
        tourTooltip.style.left = `${left}px`;
        
        tourSpotlight.style.top = `${elRect.top - 8}px`;
        tourSpotlight.style.left = `${elRect.left - 8}px`;
        tourSpotlight.style.width = `${elRect.width + 16}px`;
        tourSpotlight.style.height = `${elRect.height + 16}px`;
    }

    function showTourStep(index) {
        if (activeTourElement) activeTourElement.classList.remove('tour-element-active');
        
        if (index < 0 || index >= tourSteps.length) {
            endTour();
            return;
        }
        tourActive = true;
        
        const step = tourSteps[index];
        activeTourElement = document.querySelector(step.sel);
        
        if (!activeTourElement) {
            endTour();
            return;
        }
        
        activeTourElement.classList.add('tour-element-active');
        
        tourTitle.textContent = step.title;
        tourStepIndicator.textContent = `${index + 1}/${tourSteps.length}`;
        tourContent.textContent = step.text;
        
        tourSpotlight.classList.add('active');
        tourTooltip.classList.add('active');
        
        const rect = activeTourElement.getBoundingClientRect();
        posTooltip(rect, index);
        
        tourPrevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
        tourNextBtn.textContent = index === tourSteps.length - 1 ? 'FINISH' : 'NEXT';
    }

    // ── Tour persistence helpers ──
    // Store in BOTH localStorage AND a cookie so clearing one doesn't re-trigger.
    function setTourSeen() {
        try { localStorage.setItem('tourSeen', '1'); } catch (_) {}
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `tourSeen=1; path=/; max-age=31536000; SameSite=Lax${secure}`;
    }

    function hasTourBeenSeen() {
        // Check localStorage first
        try { if (localStorage.getItem('tourSeen')) return true; } catch (_) {}
        // Fallback: check cookie
        if (document.cookie.split('; ').some(c => c.startsWith('tourSeen='))) return true;
        return false;
    }

    function endTour() {
        if (activeTourElement) activeTourElement.classList.remove('tour-element-active');
        activeTourElement = null;
        tourActive = false;
        tourSpotlight.classList.remove('active');
        tourTooltip.classList.remove('active');
        setTourSeen();
    }

    tourNextBtn.addEventListener('click', () => { currentTourStep++; showTourStep(currentTourStep); });
    tourPrevBtn.addEventListener('click', () => { currentTourStep--; showTourStep(currentTourStep); });
    tourSkipBtn.addEventListener('click', endTour);

    if (startTourBtn) {
        startTourBtn.addEventListener('click', () => {
            if (tourActive) return; // Prevent double-firing
            currentTourStep = 0;
            showTourStep(0);
        });
    }

    // Auto-trigger on genuinely first visit.
    // Wait for all API data to load so panels are properly sized before spotlighting.
    if (!hasTourBeenSeen()) {
        Promise.allSettled([initStatus, initHistory, initSummary]).then(() => {
            if (tourActive) return; // Manual trigger already started it
            // Extra frame to let the browser paint the fetched data
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (tourActive) return;
                    showTourStep(0);
                });
            });
        });
    }
});
