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

        // --- Feature 4: Exit Intent ---
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

        showTakeaways(summary) {
            if (document.querySelector('.aw-takeaways')) return;
            const box = document.createElement('div');
            box.className = 'aw-takeaways';
            box.innerHTML = `
                <h3 style="margin:0 0 10px 0">⚡ Key Takeaways</h3>
                <p style="font-size: 14px; line-height: 1.5; color: #444;">${summary}</p>
                <div style="text-align:right; margin-top:10px;">
                    <small style="color:#888; cursor:pointer;" id="aw-takeaways-close">Dismiss</small>
                </div>
            `;
            document.body.appendChild(box);
            box.querySelector('#aw-takeaways-close').onclick = () => box.remove();
        }

        // 4. Exit Modal
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

    // Init
    console.log('AdaptiveWeb: Publisher Edition Active');
    const ui = new UIAdapter();
    new BehaviorDetector(ui);
    window.AdaptiveWeb = true;

})();
