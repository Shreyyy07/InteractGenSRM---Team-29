(function () {
    if (window.AdaptiveWeb) return;

    const CONFIG = {
        hoverDelay: 1500,
        hoverPersist: 3000,
        scrollBackWindow: 3000,
        scrollBackMinDelta: 100,
        skimScrollCount: 3,
        skimTimeWindow: 2000,
        skimMinDelta: 200,
        cursorBuffer: 20,
        cursorVarianceThreshold: 5000,
        cursorCheckInterval: 3000,
        debug: true
    };

    class BehaviorDetector {
        constructor(intentSystem) {
            this.intentSystem = intentSystem;
            this.initHoverTracking();
            this.initScrollTracking();
            this.initCursorTracking();
        }

        // --- Feature 1: Hover Tracking ---
        initHoverTracking() {
            let hoverTimer = null;

            const handleEnter = (e) => {
                const el = e.target;
                // Filter small elements or navigation
                if (!el || el.closest('nav, header, footer, menu')) return;
                const rect = el.getBoundingClientRect();
                if (rect.width < 50 || rect.height < 50) return;
                if (!['P', 'H1', 'H2', 'H3', 'DIV', 'SECTION', 'ARTICLE', 'LI'].includes(el.tagName)) return;

                hoverTimer = setTimeout(() => {
                    this.intentSystem.onHoverDwell(el);
                }, CONFIG.hoverDelay);
            };

            const handleLeave = (e) => {
                if (hoverTimer) {
                    clearTimeout(hoverTimer);
                    hoverTimer = null;
                }
                // Notify intent system of leave to manage persistence
                this.intentSystem.onHoverLeave(e.target);
            };

            document.body.addEventListener('mouseenter', handleEnter, true);
            document.body.addEventListener('mouseleave', handleLeave, true);
        }

        // --- Feature 2 & 3: Scroll Tracking ---
        initScrollTracking() {
            let scrollHistory = [];
            let lastScrollTime = Date.now();
            let lastScrollPos = window.scrollY;

            const handleScroll = () => {
                const now = Date.now();
                const currentPos = window.scrollY;

                // Throttling handled by only pushing history occasionally or analysing on every event?
                // PRD mentions throttling to 100ms.
                if (now - lastScrollTime < 100) return;

                const delta = currentPos - lastScrollPos;
                const absDelta = Math.abs(delta);

                scrollHistory.push({ time: now, pos: currentPos, delta });
                if (scrollHistory.length > 20) scrollHistory.shift();

                // Feature 3: Skimming Detection
                // Detect 3+ fast scrolls in 2 seconds
                const recentFastScrolls = scrollHistory.filter(e =>
                    now - e.time < CONFIG.skimTimeWindow && Math.abs(e.delta) > CONFIG.skimMinDelta
                );

                if (recentFastScrolls.length >= CONFIG.skimScrollCount) {
                    this.intentSystem.onRapidSkim();
                }

                // Feature 2: Scroll-Back Detection
                // Check for scroll down > 100px followed by scroll up within 3s
                this.checkScrollBack(scrollHistory, now);

                lastScrollTime = now;
                lastScrollPos = currentPos;
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
        }

        checkScrollBack(history, now) {
            // Look for a reversal pattern: Down, Down, ... Up
            // Find the latest 'Up' movement (delta < 0)
            const lastMove = history[history.length - 1];
            if (lastMove.delta >= 0) return; // Currently scrolling down or still

            // Check if we were previously scrolling down significantly
            // Find the point where we started going down?
            // Simplified: Find a point in history within window that was > 100px higher (delta sum)

            // Let's sum deltas backwards?
            // Logic: "User scrolls down more than 100 pixels, User then scrolls upward within 3 seconds"

            // We are currently scrolling UP.
            // Did we scroll DOWN explicitly just before this?

            // Look back in history for the transition point (Down -> Up)
            let maxDepth = -Infinity;
            let startDepth = history[history.length - 1].pos; // current pos approx

            // This is complex to do perfectly on every scroll event without noise.
            // Alternative: Track "Max Scroll Depth" in the current "Down Session".
            // If we scroll UP from that max depth quickly, trigger.

            // Let's try:
            // If we have a sequence of Downs totalling > 100px...
            // Followed by Ups...

            // For MVP, simplistic check:
            // Find a historical point 'H' within 3s where (CurrentPos < H.pos - 100) ??
            // No, that means we simply scrolled up 100px.
            // We want: We scrolled DOWN 100px, then UP.

            // Let's store "MaxReach" and timestamp.
            // Reset MaxReach when we scroll up significantly?
        }

        // --- Feature 4: Cursor Tracking ---
        initCursorTracking() {
            const positions = [];
            const MAX_POS = CONFIG.cursorBuffer;

            const track = (e) => {
                positions.push({ x: e.clientX, y: e.clientY, t: Date.now() });
                if (positions.length > MAX_POS) positions.shift();
            };

            // Throttle cursor sampling 50ms
            let lastSample = 0;
            window.addEventListener('mousemove', (e) => {
                const now = Date.now();
                if (now - lastSample > 50) {
                    track(e);
                    lastSample = now;
                }
            });

            // Periodic check for hesitation
            setInterval(() => {
                if (positions.length < MAX_POS) return;

                // Check time span
                const timeSpan = positions[positions.length - 1].t - positions[0].t;
                if (timeSpan < 2000) return; // Must have tracked for ~2-3s

                // Calculate Centroid
                let sumX = 0, sumY = 0;
                for (const p of positions) { sumX += p.x; sumY += p.y; }
                const avgX = sumX / positions.length;
                const avgY = sumY / positions.length;

                // Calculate Variance
                let variance = 0;
                for (const p of positions) {
                    const distSq = (p.x - avgX) ** 2 + (p.y - avgY) ** 2;
                    variance += distSq;
                }

                if (variance < CONFIG.cursorVarianceThreshold) {
                    this.intentSystem.onCursorHesitation({ x: avgX, y: avgY });
                }
            }, CONFIG.cursorCheckInterval);
        }
    }

    class IntentInference {
        constructor(uiAdapter) {
            this.ui = uiAdapter;
            this.API_URL = 'http://localhost:8000/api';

            // Scroll back specific state
            this.scrollState = {
                state: 'idle', // idle, scrolling_down
                startDownY: 0,
                maxDownY: 0,
                startTime: 0
            };

            // Listen to scroll globally
            window.addEventListener('scroll', () => this.updateScrollState());
        }

        async logEvent(type, metadata = {}) {
            try {
                await fetch(`${this.API_URL}/analytics`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventType: type,
                        domain: window.location.hostname,
                        metadata: metadata,
                        timestamp: new Date().toISOString()
                    })
                });
                console.log(`[AdaptiveWeb] Logged: ${type}`);
            } catch (e) {
                if (CONFIG.debug) console.warn('[AdaptiveWeb] API Error:', e);
            }
        }

        updateScrollState() {
            const scrollY = window.scrollY;
            const now = Date.now();

            if (this.scrollState.state === 'idle') {
                this.scrollState.state = 'monitoring';
                this.scrollState.startDownY = scrollY;
                this.scrollState.maxDownY = scrollY;
                this.scrollState.startTime = now;
            }

            const delta = scrollY - this.lastScrollY || 0;
            this.lastScrollY = scrollY;

            if (delta > 0) {
                // Going Down
                if (scrollY > this.scrollState.maxDownY) {
                    this.scrollState.maxDownY = scrollY;
                }
            } else if (delta < 0) {
                // Going Up
                const totalDown = this.scrollState.maxDownY - this.scrollState.startDownY;
                const timeElapsed = now - this.scrollState.startTime;

                if (totalDown > CONFIG.scrollBackMinDelta && timeElapsed < CONFIG.scrollBackWindow) {
                    this.onScrollBack();
                    this.scrollState.state = 'idle';
                }
            }

            if (now - this.scrollState.startTime > CONFIG.scrollBackWindow) {
                this.scrollState.state = 'idle';
            }
        }

        onHoverDwell(element) {
            console.log('Detected: Hover Dwell');
            this.ui.applyHighlight(element);
            this.logEvent('hover', { tag: element.tagName });
        }

        onHoverLeave(element) {
            setTimeout(() => {
                this.ui.removeHighlight(element);
            }, CONFIG.hoverPersist);
        }

        onRapidSkim() {
            console.log('Detected: Rapid Skimming');
            this.ui.applyTLDR();
            this.logEvent('skim', { speed: 'fast' });
        }

        async onScrollBack() {
            console.log('Detected: Scroll Back');
            this.logEvent('scroll_back');

            const text = this.getCurrentSectionText();
            if (text.length > 200) {
                // Use Backend AI Summary if available
                this.ui.showSummary("Loading AI Summary...", true);

                try {
                    const res = await fetch(`${this.API_URL}/summarize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: text })
                    });
                    const data = await res.json();
                    if (data.summary) {
                        this.ui.updateSummaryContent(data.summary);
                    }
                } catch (e) {
                    console.error("AI Summary failed", e);
                    this.ui.updateSummaryContent(text.substring(0, 150) + "...");
                }
            }
        }

        getCurrentSectionText() {
            // Simple heuristic to get visible text
            return document.body.innerText.substring(0, 800);
        }

        onCursorHesitation(coords) {
            console.log('Detected: Cursor Hesitation');
            this.ui.showSuggestion(coords, () => this.onManualHelp());
            this.logEvent('hesitation', { x: coords.x, y: coords.y });
        }

        async onManualHelp() {
            console.log('User accepted help');
            this.logEvent('help_accepted');

            const text = this.getCurrentSectionText();
            this.ui.showSummary("Analyzing for suggestions...", true);

            try {
                const res = await fetch(`${this.API_URL}/suggest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });
                const data = await res.json();
                if (data.summary) {
                    this.ui.updateSummaryContent(data.summary, data.suggestions);
                }
            } catch (e) {
                console.error("Help action failed", e);
                this.ui.updateSummaryContent("Could not analyze page content: " + e.message);
            }
        }
    }

    class UIAdapter {
        applyHighlight(el) {
            el.classList.add('aw-highlighted');
            // Remove on interaction (click)
            const remove = () => {
                el.classList.remove('aw-highlighted');
                el.removeEventListener('click', remove);
            }
            el.addEventListener('click', remove);
        }

        removeHighlight(el) {
            el.classList.remove('aw-highlighted');
        }

        showSummary(text, isLoading = false) {
            if (document.querySelector('.aw-summary-box')) return;

            const box = document.createElement('div');
            box.className = 'aw-summary-box';

            const content = isLoading
                ? `<div class="aw-loading">✨ Generating Smart Summary...</div>`
                : text.substring(0, 200) + '...';

            box.innerHTML = `
        <div class="aw-summary-box-header">
          <span>Quick Summary</span>
          <button class="aw-close-btn">&times;</button>
        </div>
        <div class="aw-summary-content">
          ${content}
        </div>
        <button class="aw-read-full-btn">Read Full Section</button>
      `;

            document.body.appendChild(box);
            requestAnimationFrame(() => box.classList.add('aw-visible'));
            box.querySelector('.aw-close-btn').onclick = () => this.dismissSummary(box);
            setTimeout(() => this.dismissSummary(box), 12000);

            this.currentSummaryBox = box;
        }

        updateSummaryContent(newText, suggestions = []) {
            if (this.currentSummaryBox) {
                const contentDiv = this.currentSummaryBox.querySelector('.aw-summary-content');

                let html = newText;
                if (suggestions && suggestions.length > 0) {
                    html += '<div class="aw-suggestions-title">Suggested Actions:</div>';
                    html += '<div class="aw-suggestions-list">';
                    suggestions.forEach(s => {
                        html += `<button class="aw-suggestion-chip">${s}</button>`;
                    });
                    html += '</div>';
                }

                if (contentDiv) contentDiv.innerHTML = html;
            }
        }

        dismissSummary(box) {
            if (!box) return;
            box.classList.remove('aw-visible');
            setTimeout(() => box.remove(), 200);
        }

        applyTLDR() {
            const paragraphs = document.querySelectorAll('p');
            paragraphs.forEach(p => {
                if (p.innerText.length > 300 && !p.classList.contains('aw-tldr-processed')) {
                    p.classList.add('aw-tldr-processed');

                    const fullText = p.innerHTML; // Keep HTML? PRD says maintain formatting.
                    const shortText = p.innerText.substring(0, 120);

                    // We'll wrap logic to toggle
                    p.dataset.fullHtml = fullText;
                    p.innerHTML = `${shortText}... <span class="aw-tldr-read-more">read more</span>`;
                    p.classList.add('aw-tldr-collapsed');

                    p.querySelector('.aw-tldr-read-more').onclick = (e) => {
                        e.stopPropagation();
                        p.innerHTML = fullText;
                        p.classList.remove('aw-tldr-collapsed');
                        p.classList.add('aw-tldr-expanded');
                    };
                }
            });
        }

        showSuggestion(coords, onAction) {
            if (document.querySelector('.aw-suggestion-bubble')) return;

            const bubble = document.createElement('div');
            bubble.className = 'aw-suggestion-bubble';
            bubble.innerHTML = `
        <div class="aw-suggestion-arrow"></div>
        <div style="display:flex; align-items:center; gap:10px;">
            <span>Need help?</span>
            <button class="aw-help-btn" style="background:white; color:#2196F3; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-weight:bold; font-size:12px;">Summarize</button>
        </div>
      `;

            document.body.appendChild(bubble);

            // Ensure position is absolute relative to document
            bubble.style.left = (coords.x + window.scrollX + 15) + 'px';
            bubble.style.top = (coords.y + window.scrollY + 15) + 'px';

            // Add click listener
            const btn = bubble.querySelector('.aw-help-btn');
            if (btn && onAction) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    onAction();
                    this.dismissSuggestion(bubble);
                };
            }

            requestAnimationFrame(() => bubble.classList.add('aw-visible'));

            // Auto dismiss timer
            const autoDismiss = setTimeout(() => {
                this.dismissSuggestion(bubble);
            }, 8000);

            // Dismiss on purposeful movement away
            const checkMove = (e) => {
                if (bubble.contains(e.target)) return;

                const dist = Math.hypot(e.clientX - coords.x, e.clientY - coords.y);
                if (dist > 150) {
                    clearTimeout(autoDismiss);
                    this.dismissSuggestion(bubble);
                    window.removeEventListener('mousemove', checkMove);
                }
            };
            window.addEventListener('mousemove', checkMove);

            // Cleanup event listener if bubble is removed
            bubble.dataset.listenerAttached = 'true';
        }

        dismissSuggestion(bubble) {
            if (!bubble) return;
            bubble.classList.remove('aw-visible');
            setTimeout(() => bubble.remove(), 300);
        }
    }

    // Initialize
    console.log('AdaptiveWeb: Engine Starting');
    const ui = new UIAdapter();
    const intent = new IntentInference(ui);
    new BehaviorDetector(intent);
    window.AdaptiveWeb = {
        init: (config) => Object.assign(CONFIG, config)
    };
})();
