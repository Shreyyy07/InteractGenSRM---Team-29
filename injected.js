(function () {
    if (window.AdaptiveWeb) return;

    const CONFIG = {
        // Feature 1: Reading Difficulty
        difficultyRevisitCount: 3,
        difficultyTimeWindow: 10000, // 10s

        // Feature 2: Engaged Reader
        engagedScrollMaxSpeed: 300, // px/s
        engagedHoverTime: 3000,
        engagedMinDepth: 0.5, // 50%

        // Feature 3: Skimmer
        skimScrollMinSpeed: 800,
        skimEventCount: 3,
        skimTimeWindow: 5000,

        // Feature 4: Exit Intent
        exitThresholdY: 50,

        serverUrl: 'http://localhost:8000/api',
        debug: true
    };

    class BehaviorDetector {
        constructor(ui) {
            this.ui = ui;
            this.api = new ApiService();

            this.initScrollAnalysis();
            // this.initParagraphTracking(); // Disable "Simplify" feature as requested
            this.initExitIntent();
            this.initHoverDwell(); // New Universal Hover
        }

        // --- Feature 5: Universal Hover Dwell ---
        initHoverDwell() {
            let hoverTimer = null;
            let currentTarget = null;

            document.body.addEventListener('mouseover', (e) => {
                const target = e.target.closest('p, article, h1, h2, h3, li');
                if (!target || target === currentTarget) return;

                // Clear previous
                if (hoverTimer) clearTimeout(hoverTimer);
                if (currentTarget) this.ui.removeHoverEffect(currentTarget);

                currentTarget = target;

                // Start Timer (1.5s as requested)
                hoverTimer = setTimeout(() => {
                    if (currentTarget && currentTarget.isConnected) {
                        this.onHoverDwell(currentTarget);
                    }
                }, 1500);
            }, { passive: true });

            document.body.addEventListener('mouseout', (e) => {
                if (!currentTarget) return;

                // Only clear if we really left the element (not just moved to a child)
                if (currentTarget.contains(e.relatedTarget)) return;

                if (hoverTimer) clearTimeout(hoverTimer);
                this.ui.removeHoverEffect(currentTarget);
                currentTarget = null;
            }, { passive: true });

            // Clear on scroll to prevent sticky highlights
            window.addEventListener('scroll', () => {
                if (hoverTimer) clearTimeout(hoverTimer);
                if (currentTarget) this.ui.removeHoverEffect(currentTarget);
                currentTarget = null;
            }, { passive: true });
        }

        onHoverDwell(element) {
            if (CONFIG.debug) console.log('Detected: Universal Hover Dwell', element);

            // Smarter Theme Detection: Traverse up to find effective background
            const bgColor = this.getEffectiveBackgroundColor(element);
            const isDark = this.isDarkColor(bgColor);

            this.ui.applyHoverEffect(element, isDark, this.api);
            this.api.log('hover_dwell', {
                tag: element.tagName,
                text_len: element.innerText.length,
                theme: isDark ? 'dark' : 'light',
                bg_color: bgColor
            });
        }

        getEffectiveBackgroundColor(el) {
            let current = el;
            while (current) {
                const style = window.getComputedStyle(current);
                const color = style.backgroundColor;
                // Check if transparent (rgba(0,0,0,0) or transparent)
                if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
                    return color;
                }
                current = current.parentElement;
            }
            return 'rgb(255, 255, 255)'; // Fallback to white (Light Mode) if no bg found
        }

        isDarkColor(color) {
            if (!color) return false;

            const rgb = color.match(/\d+/g);
            if (!rgb) return false;

            // Luminance formula
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            return brightness < 128; // < 128 is dark
        }

        // --- Feature 1: Reading Difficulty (Re-reading) ---
        initParagraphTracking() {
            const paragraphs = document.querySelectorAll('p');
            // Store revisit timestamps: Map<Element, number[]>
            this.paragraphVisits = new Map();

            // IntersectionObserver to detect when a paragraph enters viewport
            const observer = new IntersectionObserver((entries) => {
                const now = Date.now();
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.registerVisit(entry.target, now);
                    }
                });
            }, { threshold: 0.8 }); // Must be 80% visible

            paragraphs.forEach(p => observer.observe(p));
        }

        registerVisit(p, time) {
            if (!this.paragraphVisits.has(p)) {
                this.paragraphVisits.set(p, []);
            }
            const visits = this.paragraphVisits.get(p);
            // Clean old visits
            while (visits.length > 0 && time - visits[0] > CONFIG.difficultyTimeWindow) {
                visits.shift();
            }
            visits.push(time);

            // Check Trigger
            if (visits.length >= CONFIG.difficultyRevisitCount) {
                if (!p.classList.contains('aw-difficulty-processed')) {
                    this.onReadingDifficulty(p);
                }
            }
        }

        onReadingDifficulty(p) {
            if (CONFIG.debug) console.log('Detected: Reading Difficulty', p);
            p.classList.add('aw-difficulty-processed');
            this.ui.highlightAndPrompt(p, async () => {
                const simplified = await this.api.simplify(p.innerText);
                if (simplified) this.ui.updateParagraph(p, simplified.simplified);
            });
            this.api.log('reading_difficulty', { text_len: p.innerText.length });
        }

        // --- Feature 2 & 3: Scroll Analysis (Engaged & Skimmer) ---
        initScrollAnalysis() {
            let lastScrollY = window.scrollY;
            let lastScrollTime = Date.now();
            let scrollEvents = []; // {time, speed}

            window.addEventListener('scroll', () => {
                const now = Date.now();
                const currentY = window.scrollY;
                const dt = now - lastScrollTime;

                if (dt > 100) { // Check every 100ms
                    const dy = Math.abs(currentY - lastScrollY);
                    const speed = (dy / dt) * 1000; // px/sec

                    this.checkSkimmer(now, speed, scrollEvents);
                    this.checkEngaged(now, speed, currentY);

                    lastScrollY = currentY;
                    lastScrollTime = now;
                }
            }, { passive: true });
        }

        checkSkimmer(now, speed, events) {
            if (speed > CONFIG.skimScrollMinSpeed) {
                events.push(now);
                // Clean old
                while (events.length > 0 && now - events[0] > CONFIG.skimTimeWindow) {
                    events.shift();
                }

                if (events.length >= CONFIG.skimEventCount) {
                    this.onSkimmerDetected();
                    // Reset to avoid spam
                    events.length = 0;
                }
            }
        }

        async onSkimmerDetected() {
            if (this.skimmerTriggered) return;
            this.skimmerTriggered = true;

            if (CONFIG.debug) console.log('Detected: Skimmer');
            this.ui.showToast('We see you are skimming! Loading key takeaways...');
            this.api.log('skimmer_detected');

            const text = document.body.innerText.substring(0, 1000);
            const summary = await this.api.summarize(text);
            if (summary) {
                this.ui.showTakeaways(summary.summary);
            }
        }

        checkEngaged(now, speed, scrollY) {
            if (this.engagedTriggered) return;
            // Check Depth
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const depth = scrollY / docHeight;

            if (depth > CONFIG.engagedMinDepth && speed < CONFIG.engagedScrollMaxSpeed && speed > 0) {
                // We are deep and scrolling slowly.
                // Simplified "Hover" check: Assume if scrolling slow deep, they are engaged.
                // Real hover check is expensive on all elements.

                // Debounce
                if (!this.engagedTimer) {
                    this.engagedTimer = setTimeout(() => {
                        this.onEngagedReader();
                    }, CONFIG.engagedHoverTime);
                }
            } else {
                if (this.engagedTimer) {
                    clearTimeout(this.engagedTimer);
                    this.engagedTimer = null;
                }
            }
        }

        async onEngagedReader() {
            this.engagedTriggered = true;
            if (CONFIG.debug) console.log('Detected: Engaged Reader');
            this.api.log('engaged_reader');

            // Real-time: Scrape the current page for "Related" or interesting links
            const relatedLinks = this.scrapeRelatedLinks();

            if (relatedLinks.length > 0) {
                this.ui.showSidebar(relatedLinks);
            } else {
                // Fallback to API if we can't find anything nice
                const related = await this.api.getRelated(window.location.href);
                if (related) {
                    this.ui.showSidebar(related.articles);
                }
            }
        }

        scrapeRelatedLinks() {
            // Heuristic: Find links in <aside>, or links with images, or just reasonable links
            const links = [];
            const candidates = document.querySelectorAll('aside a, .sidebar a, .related a, article a');

            for (let a of candidates) {
                if (links.length >= 5) break;

                // Filter nice links
                const title = a.innerText.trim();
                if (title.length > 15 && a.href && !a.href.includes('#')) {
                    // Try to find an image nearby
                    let img = a.querySelector('img');
                    if (!img) {
                        // Look at parent
                        const parent = a.parentElement;
                        if (parent) img = parent.querySelector('img');
                    }

                    links.push({
                        title: title,
                        url: a.href,
                        image: img ? img.src : 'https://placehold.co/100x100?text=News' // Fallback
                    });
                }
            }

            // Dedup
            return links.filter((v, i, a) => a.findIndex(v2 => (v2.url === v.url)) === i);
        }

        // --- Feature 4: Cursor Hesitation (Help) ---
        initCursorHesitation() {
            let hesitationTimer = null;
            let lastCoords = { x: 0, y: 0 };

            document.addEventListener('mousemove', (e) => {
                // Update Coords
                lastCoords = { x: e.clientX, y: e.clientY };

                // Clear Timer
                if (hesitationTimer) clearTimeout(hesitationTimer);

                // Remove existing bubble if moving significantly? 
                // Currently keeping it simple: bubble stays until dismissed or clicked

                // Start Timer (2000ms idle)
                hesitationTimer = setTimeout(() => {
                    // Only if no hover effect is currently active (priority to hover)
                    if (!document.querySelector('.aw-highlight') && !document.querySelector('.aw-hover-light') && !document.querySelector('.aw-hover-dark')) {
                        this.onCursorHesitation(lastCoords);
                    }
                }, 2000);
            }, { passive: true });
        }

        onCursorHesitation(coords) {
            // Check if we already showed it recently to avoid annoyance
            if (this.hesitationTriggered) return;
            // Simple throttle: don't show again this session or reset flag after delay

            if (CONFIG.debug) console.log('Detected: Cursor Hesitation at', coords);
            this.hesitationTriggered = true;

            // Reset trigger after 30s so it can happen again
            setTimeout(() => this.hesitationTriggered = false, 30000);

            this.ui.showSuggestion(coords, () => {
                this.onManualHelp();
            });
            this.api.log('hesitation', { x: coords.x, y: coords.y });
        }

        async onManualHelp() {
            console.log('User accepted help');
            this.api.log('help_accepted');

            // Broad context: Visible text or Body text
            const text = document.body.innerText.substring(0, 3000);

            this.ui.showSummary("🤔 Analyzing page context...", true);

            // POST to /api/suggest
            const res = await fetch(`${CONFIG.serverUrl}/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            }).then(r => r.json()).catch(e => null);

            if (res && res.suggestions) {
                this.ui.updateSummaryContent(res.summary, res.suggestions);
            } else {
                this.ui.updateSummaryContent("Could not get suggestions.");
            }
        }

        // --- Feature 5: Exit Intent ---
        initExitIntent() {
            document.addEventListener('mouseleave', (e) => {
                if (e.clientY < CONFIG.exitThresholdY) {
                    this.onExitIntent();
                }
            });
        }

        onExitIntent() {
            if (this.exitTriggered) return;
            // Check session storage to prevent annoyance
            if (sessionStorage.getItem('aw-exit-dismissed')) return;

            this.exitTriggered = true;

            if (CONFIG.debug) console.log('Detected: Exit Intent');
            this.api.log('exit_intent');

            // Calc Progress
            const scrollY = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = (scrollY / docHeight) * 100;

            this.ui.showExitModal(progress, this.api);
        }
    }

    class ApiService {
        async post(endpoint, body) {
            try {
                const res = await fetch(`${CONFIG.serverUrl}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                return await res.json();
            } catch (e) {
                console.error(`API Error ${endpoint}:`, e);
                return null;
            }
        }

        async simplify(text) {
            return this.post('simplify', { text });
        }

        async summarize(text) {
            return this.post('summarize', { text });
        }

        async getRelated(url) {
            return this.post('related', { url });
        }

        log(type, metadata = {}) {
            this.post('analytics', {
                eventType: type,
                domain: window.location.hostname,
                timestamp: new Date().toISOString(),
                metadata
            });
        }
    }

    class UIAdapter {
        constructor() {
            this.injectStyles();
        }

        injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
                /* Highlight */
                .aw-highlight {
                    background: rgba(255, 235, 59, 0.2);
                    box-shadow: 0 0 0 2px rgba(255, 235, 59, 0.4);
                    border-radius: 4px;
                    transition: all 0.3s;
                    position: relative;
                }
                .aw-simplify-btn {
                    position: absolute;
                    top: -25px;
                    right: 0;
                    background: #222;
                    color: #fff;
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    z-index: 1000;
                    font-family: sans-serif;
                }
                
                /* Sidebar */
                .aw-sidebar {
                    position: fixed;
                    top: 0;
                    right: -320px;
                    width: 320px;
                    height: 100vh;
                    background: white;
                    box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                    transition: right 0.3s ease-out;
                    z-index: 9999;
                    padding: 20px;
                    font-family: sans-serif;
                    overflow-y: auto;
                }
                .aw-sidebar.visible { right: 0; }
                .aw-card {
                    border: 1px solid #eee;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    overflow: hidden;
                }
                .aw-card img { width: 100%; height: 100px; object-fit: cover; }
                .aw-card-content { padding: 10px; }
                
                /* Takeaways */
                .aw-takeaways {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    width: 300px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                    padding: 15px;
                    z-index: 9998;
                    font-family: sans-serif;
                    border-left: 4px solid #3b82f6;
                    animation: slideIn 0.5s ease;
                }
                @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                
                /* Exit Modal */
                .aw-modal-backdrop {
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 10000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .aw-modal {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    width: 400px;
                    text-align: center;
                    font-family: sans-serif;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                }
                .aw-btn {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    margin-top: 15px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                }
                .aw-btn:hover { opacity: 0.9; }
                .aw-btn.secondary { background: #eee; color: #333; margin-left: 10px; }
                
                /* Universal Hover Styles */
                /* For LIGHT BG websites (Dark Overlay) */
                .aw-hover-light {
                    background-color: rgba(0, 0, 0, 0.9) !important;
                    color: white !important;
                    border: 2px solid white !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    border-radius: 8px;
                    transition: all 0.2s ease-out;
                    z-index: 1000;
                    position: relative;
                }
                
                /* For DARK BG websites (White Overlay) */
                .aw-hover-dark {
                    background-color: rgba(255, 255, 255, 0.9) !important;
                    color: black !important;
                    border: 2px solid black !important;
                    box-shadow: 0 10px 30px rgba(255,255,255,0.3);
                    border-radius: 8px;
                    transition: all 0.2s ease-out;
                    z-index: 1000;
                    position: relative;
                }
            `;
            document.head.appendChild(style);
        }

        applyHoverEffect(el, isCurrentBgDark, api) {
            // If current BG is Dark -> We want White Overlay (aw-hover-dark)
            // If current BG is Light -> We want Black Overlay (aw-hover-light)
            if (isCurrentBgDark) {
                el.classList.add('aw-hover-dark');
            } else {
                el.classList.add('aw-hover-light');
            }

            // Inject Summarize Button
            if (el.querySelector('.aw-summarize-btn')) return;

            const btn = document.createElement('div');
            btn.className = 'aw-summarize-btn';
            btn.innerHTML = '📝 Summarize';

            Object.assign(btn.style, {
                position: 'absolute',
                top: '-25px',
                right: '10px',
                background: isCurrentBgDark ? '#fff' : '#222',
                color: isCurrentBgDark ? '#000' : '#fff',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                zIndex: '1001',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                fontWeight: 'bold',
                fontFamily: 'sans-serif'
            });

            btn.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                btn.innerHTML = 'Thinking...';

                // Use passed API or fallback
                const apiService = api || new ApiService();
                const text = el.innerText;
                const res = await apiService.summarize(text);

                if (res && res.summary) {
                    this.showTakeaways(res.summary);
                    btn.innerHTML = 'Done!';
                    setTimeout(() => btn.innerHTML = '📝 Summarize', 2000);
                } else {
                    btn.innerHTML = 'Error';
                }
            };

            // Relative position for absolute button
            const pos = window.getComputedStyle(el).position;
            if (pos === 'static') {
                el.style.position = 'relative';
            }

            el.appendChild(btn);
        }

        removeHoverEffect(el) {
            if (el) {
                el.classList.remove('aw-hover-light', 'aw-hover-dark');
                const btn = el.querySelector('.aw-summarize-btn');
                if (btn) btn.remove();
            }
        }

        // 1. Difficulty
        highlightAndPrompt(p, onSimplify) {
            p.classList.add('aw-highlight');
            const btn = document.createElement('div');
            btn.className = 'aw-simplify-btn';
            btn.innerHTML = '✨ Simplify';
            btn.onclick = (e) => {
                e.stopPropagation();
                btn.innerHTML = 'Thinking...';
                onSimplify();
            };
            // Insert relative to P
            p.style.position = 'relative';
            p.appendChild(btn);
        }

        updateParagraph(p, text) {
            p.innerHTML = text; // Replace content
            p.classList.remove('aw-highlight');
            const btn = p.querySelector('.aw-simplify-btn');
            if (btn) btn.remove();

            p.style.borderLeft = "4px solid #4caf50";
            p.style.paddingLeft = "10px";
        }

        // 2. Sidebar
        showSidebar(articles) {
            const sidebar = document.createElement('div');
            sidebar.className = 'aw-sidebar';
            sidebar.innerHTML = `
                <h2>You might also like</h2>
                <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
                ${articles.map(a => `
                    <div class="aw-card">
                        <img src="${a.image}" alt="">
                        <div class="aw-card-content">
                            <strong>${a.title}</strong>
                        </div>
                    </div>
                `).join('')}
                <button class="aw-btn" style="width:100%" id="aw-sidebar-close">Close</button>
            `;
            document.body.appendChild(sidebar);

            sidebar.querySelector('#aw-sidebar-close').onclick = () => {
                sidebar.classList.remove('visible');
                setTimeout(() => sidebar.remove(), 300);
            }

            // Trigger reflow
            sidebar.offsetHeight;
            sidebar.classList.add('visible');
        }

        // 3. Takeaways
        showToast(msg) {
            // Optional simple toast
            console.log(msg);
        }

        showSuggestion(coords, onAction) {
            if (document.querySelector('.aw-suggestion-bubble')) return;

            const bubble = document.createElement('div');
            bubble.className = 'aw-suggestion-bubble';
            bubble.innerHTML = `
                <div class="aw-suggestion-arrow"></div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:14px;">💡 Need a hint?</span>
                    <button class="aw-help-btn">Suggest Actions</button>
                    <div class="aw-suggestion-close">&times;</div>
                </div>
            `;

            // Inline Styles for Bubble (Injecting class in stylesheet is cleaner but this works for now)
            Object.assign(bubble.style, {
                position: 'absolute',
                left: (coords.x + window.scrollX + 20) + 'px',
                top: (coords.y + window.scrollY) + 'px',
                background: '#fff',
                color: '#333',
                padding: '8px 12px',
                borderRadius: '50px', // Pill shape
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                zIndex: '9999',
                fontFamily: 'sans-serif',
                border: '1px solid #eee',
                animation: 'fadeIn 0.3s ease',
                display: 'flex',
                alignItems: 'center'
            });

            // Button Style
            const btn = bubble.querySelector('.aw-help-btn');
            Object.assign(btn.style, {
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginLeft: '5px'
            });

            // Close Style
            const close = bubble.querySelector('.aw-suggestion-close');
            Object.assign(close.style, {
                marginLeft: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#888'
            });

            document.body.appendChild(bubble);

            // Events
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                onAction();
                bubble.remove();
            };

            close.onclick = (e) => {
                e.stopPropagation();
                bubble.remove();
            };

            // Auto-dismiss after 8 seconds
            setTimeout(() => {
                if (bubble.isConnected) bubble.remove();
            }, 8000);
        }

        updateSummaryContent(newText, suggestions = []) {
            if (this.currentSummaryBox) {
                const contentDiv = this.currentSummaryBox.querySelector('.aw-summary-content');

                let html = `<p>${newText}</p>`;
                if (suggestions && suggestions.length > 0) {
                    html += '<div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">';
                    suggestions.forEach(s => {
                        // Use inline onclick for simplicity, or add listeners later
                        html += `<span style="background:#f0f7ff; color:#0066cc; padding:4px 10px; border-radius:12px; font-size:12px; border:1px solid #cce5ff;">${s}</span>`;
                    });
                    html += '</div>';
                }

                if (contentDiv) contentDiv.innerHTML = html;
            }
        }
        showSummary(initialText, isLoading = false) {
            // Remove existing if any
            if (this.currentSummaryBox && this.currentSummaryBox.isConnected) {
                this.currentSummaryBox.remove();
            }

            const box = document.createElement('div');
            box.className = 'aw-takeaways'; // Reuse existing styles
            this.currentSummaryBox = box;

            box.innerHTML = `
                <h3 style="margin:0 0 10px 0">⚡ Adaptive Helper</h3>
                <div class="aw-summary-content">
                    <p style="font-size: 14px; line-height: 1.5; color: #444;">
                        ${isLoading ? '<i>' + initialText + '</i>' : initialText}
                    </p>
                </div>
                <div style="text-align:right; margin-top:10px;">
                    <small style="color:#888; cursor:pointer;" id="aw-takeaways-close">Dismiss</small>
                </div>
            `;
            document.body.appendChild(box);

            box.querySelector('#aw-takeaways-close').onclick = () => {
                box.remove();
                this.currentSummaryBox = null;
            };
        }

        showTakeaways(summary) {
            // "Summarize" button output -> Use same box but add expansion logic
            if (this.currentSummaryBox && this.currentSummaryBox.isConnected) {
                this.currentSummaryBox.remove();
            }

            const box = document.createElement('div');
            box.className = 'aw-takeaways';
            this.currentSummaryBox = box;

            // Simple truncate for visual cleaness, "Expand" to see full
            const isLong = summary.length > 150; // Lowered from 300
            const displaySummary = isLong ? summary.substring(0, 150) + '...' : summary;

            box.innerHTML = `
                <h3 style="margin:0 0 10px 0">⚡ Key Takeaways</h3>
                <div class="aw-summary-content">
                    <p style="font-size: 14px; line-height: 1.5; color: #444;">${displaySummary}</p>
                </div>
                ${isLong ? '<div style="margin-top:5px;"><button id="aw-expand-btn" style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size:12px; font-weight:bold; padding:0;">View Full Context ⬇</button></div>' : ''}
                <div style="text-align:right; margin-top:10px;">
                    <small style="color:#888; cursor:pointer;" id="aw-takeaways-close">Dismiss</small>
                </div>
            `;
            document.body.appendChild(box);

            // Expand Logic
            if (isLong) {
                box.querySelector('#aw-expand-btn').onclick = (e) => {
                    e.target.remove();
                    box.querySelector('.aw-summary-content p').innerText = summary;
                };
            }

            box.querySelector('#aw-takeaways-close').onclick = () => box.remove();
        }

        showExitModal(progress, api) {
            if (document.querySelector('.aw-modal-backdrop')) return;

            let title = "Wait!";
            let text = "Don't miss out.";
            let btnText = "Stay";

            if (progress < 30) {
                title = "Save for later?";
                text = "You've barely started. Enter your email to get the PDF.";
                btnText = "Save Article";
            } else if (progress > 70) {
                title = "Loved it?";
                text = "Share this with your network before you go.";
                btnText = "Share Article";
            } else {
                title = "Jump to conclusion?";
                text = "Short on time? Read the summary instead.";
                btnText = "Show Summary";
            }

            const backdrop = document.createElement('div');
            backdrop.className = 'aw-modal-backdrop';
            backdrop.innerHTML = `
                <div class="aw-modal">
                    <h2>${title}</h2>
                    <p style="color:#666; margin: 15px 0;">${text}</p>
                    <button class="aw-btn" id="aw-modal-pri">${btnText}</button>
                    <button class="aw-btn secondary" id="aw-modal-sec">Close</button>
                </div>
            `;
            document.body.appendChild(backdrop);

            // Handlers
            const close = () => {
                backdrop.remove();
                sessionStorage.setItem('aw-exit-dismissed', 'true'); // Prevent reappear
            };

            backdrop.querySelector('#aw-modal-sec').onclick = close;

            const primaryBtn = backdrop.querySelector('#aw-modal-pri');
            primaryBtn.onclick = async () => {
                if (btnText === "Show Summary") {
                    primaryBtn.innerText = "Summarizing...";
                    const text = document.body.innerText.substring(0, 2000);
                    const summary = await api.summarize(text);
                    if (summary) {
                        this.showTakeaways(summary.summary);
                        close();
                    }
                } else {
                    alert("Feature coming soon!");
                    close();
                }
            };
        }
    }

    class ShortcutsManager {
        constructor(api) {
            this.api = api;
            this.shortcuts = [];
            this.init();
        }

        async init() {
            // Get content for context
            const text = document.body.innerText.substring(0, 3000);
            const res = await this.api.post('shortcuts', { text });

            if (res && res.shortcuts && res.shortcuts.length > 0) {
                this.shortcuts = res.shortcuts;
                this.renderSidebar();
                this.startListening();
            }
        }

        renderSidebar() {
            const container = document.createElement('div');
            container.className = 'aw-shortcuts-sidebar';
            container.innerHTML = `
                <div style="margin-bottom:10px; font-weight:bold; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Shortcuts</div>
                ${this.shortcuts.map(s => `
                    <div class="aw-shortcut-item" data-key="${s.key.toLowerCase()}">
                        <kbd>${s.key}</kbd>
                        <span>${s.action}</span>
                    </div>
                `).join('')}
            `;

            // Styles
            const style = document.createElement('style');
            style.textContent = `
                .aw-shortcuts-sidebar {
                    position: fixed;
                    left: 20px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(30, 30, 30, 0.95); /* DARK MODE */
                    border: 1px solid #444;
                    border-radius: 12px;
                    padding: 15px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 9999;
                    font-family: 'Segoe UI', sans-serif;
                    width: 220px;
                    transition: opacity 0.3s;
                    opacity: 0.8; /* Slightly more visible by default */
                    color: #fff;
                    backdrop-filter: blur(10px);
                }
                .aw-shortcuts-sidebar:hover { opacity: 1; }
                .aw-shortcut-item {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    font-size: 13px;
                    color: #ddd;
                    padding: 6px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                .aw-shortcut-item.active {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: rgba(59, 130, 246, 0.5);
                    color: white;
                    transform: scale(1.02);
                }
                .aw-shortcut-item kbd {
                    background: #333;
                    border: 1px solid #555;
                    border-radius: 4px;
                    color: #fff;
                    padding: 3px 8px;
                    font-family: monospace;
                    font-size: 12px;
                    margin-right: 12px;
                    min-width: 25px;
                    text-align: center;
                    box-shadow: 0 2px 0 #111;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(container);
        }

        startListening() {
            document.addEventListener('keydown', (e) => {
                // Ignore input fields
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;

                const pressed = e.key.toLowerCase();
                const item = document.querySelector(`.aw-shortcut-item[data-key="${pressed}"]`);

                if (item) {
                    item.classList.add('active');
                    setTimeout(() => item.classList.remove('active'), 300);
                }
            });
        }
    }

    // Init
    console.log('AdaptiveWeb: Publisher Edition Active');
    const ui = new UIAdapter();
    const detector = new BehaviorDetector(ui);
    detector.initCursorHesitation();

    // Init Shortcuts
    new ShortcutsManager(new ApiService());

    window.AdaptiveWeb = true;

})();
