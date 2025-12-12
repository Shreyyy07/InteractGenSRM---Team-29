# AdaptiveWeb 🌐✨

> Intelligent UI adaptation layer that detects user micro-behaviors and adapts web interfaces in real-time.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Overview

AdaptiveWeb is a zero-configuration, client-side browser extension that intelligently adapts web page interfaces based on user behavior patterns. It reduces cognitive load, improves navigation efficiency, and creates a seamless browsing experience through subtle, non-disruptive interventions.

### Key Features

- **🎨 Hover Dwell Highlight** - Highlights content you're interested in
- **📋 Scroll-Back Auto-Pin Summary** - Shows contextual summaries when you scroll back
- **⚡ Rapid-Skimming TL;DR Mode** - Condenses long content when you're skimming
- **🤔 Cursor Hesitation Suggestion** - Offers help when you seem confused

## 🚀 Quick Start

### Chrome Extension Installation

1. Clone this repository: 
   ```bash
   git clone https://github.com/yourusername/adaptiveweb.git
   cd adaptiveweb
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the `extension/` folder

5. The extension will automatically activate on all websites!  🎉

### Standalone Script Usage

Add to any webpage: 

```html
<link rel="stylesheet" href="injected.css">
<script src="injected.js"></script>
```

Optional configuration:

```html
<script>
  window. AdaptiveWeb.init({
    hoverDelay: 1500,
    scrollBackWindow:  3000,
    debug: false
  });
</script>
```

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Page                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │   Browser Extension Layer    │
          │  (Manifest V3 - Content      │
          │   Script Orchestration)      │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │      Core Engine Layer       │
          │       (injected.js)          │
          └──────────────┬───────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────┐
│  Behavior    │ │    Intent    │ │     UI      │
│  Detector    │ │  Inference   │ │   Adapter   │
└──────┬───────┘ └──────┬───────┘ └──────┬──────┘
       │                │                │
       │  ┌─────────────┴─────────────┐  │
       │  │                           │  │
       ▼  ▼                           ▼  ▼
┌─────────────────────────────────────────────┐
│         Event Tracking Layer                │
│  • Scroll Monitor (throttled 100ms)         │
│  • Hover Tracker (1500ms threshold)         │
│  • Cursor Position Sampler (50ms)           │
│  • Scroll-Back Detection (3s window)        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│         Styling Layer (injected.css)        │
│  • Non-conflicting classes (aw- prefix)     │
│  • Smooth animations & transitions          │
│  • Responsive design support                │
└─────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Responsibility | Key Technologies |
|-----------|---------------|------------------|
| **Behavior Detector** | Monitors user interactions (scrolls, hovers, cursor movement) | Event listeners, throttling/debouncing |
| **Intent Inference** | Analyzes patterns to determine user intent | Statistical variance, pattern recognition |
| **UI Adapter** | Applies visual adaptations to the DOM | Dynamic CSS injection, DOM manipulation |
| **Event Tracking** | Captures and buffers user events efficiently | Circular buffers, performance optimization |

## 🎨 Features in Detail

### 1. Hover Dwell Highlight

When you hover over content for **1.5+ seconds**, it gets subtly highlighted to confirm your interest.

**Trigger**: Hover on content element for >1500ms  
**Effect**: Soft yellow highlight with smooth transition  
**Duration**:  Persists for 3 seconds after hover ends

### 2. Scroll-Back Auto-Pin Summary

Scrolling down then quickly back up shows a floating summary of the current section.

**Trigger**: Scroll down >100px, then scroll up within 3 seconds  
**Effect**: Summary box in top-right corner (first 200 chars)  
**Duration**: Auto-dismiss after 10 seconds

### 3. Rapid-Skimming TL;DR Mode

When scrolling rapidly, long paragraphs automatically condense to summaries.

**Trigger**: 3+ scrolls of 200px+ within 2 seconds  
**Effect**: Paragraphs collapse to first 120 characters with "read more"  
**Interaction**: Click to expand smoothly to full content

### 4. Cursor Hesitation Suggestion

Circular or erratic cursor movement triggers contextual help.

**Trigger**: Cursor variance <5000px² for 3+ seconds  
**Effect**: Suggestion bubble near cursor:  "Need help finding something?"  
**Duration**: Auto-dismiss after 5 seconds

## 📁 Project Structure

```
adaptiveweb/
├── extension/
│   ├── manifest.json          # Chrome extension manifest (V3)
│   ├── content_script.js      # Injection orchestrator
│   ├── injected.js            # Core behavior detection engine
│   ├── injected.css           # Adaptive UI styles
│   ├── icons/                 # Extension icons (16, 48, 128px)
│   └── README.md              # Extension-specific docs
├── demo/
│   ├── index.html             # Demo page with test content
│   ├── test. js                # Behavior simulation scripts
│   └── styles.css             # Demo page styles
├── docs/
│   ├── PRD.md                 # Product Requirements Document
│   ├── INSTALLATION.md        # Detailed installation guide
│   └── TESTING.md             # Testing procedures
└── README.md                  # This file
```

## ⚙️ Configuration

All thresholds are configurable: 

```javascript
window.AdaptiveWeb.init({
  // Hover Dwell Settings
  hoverDelay: 1500,           // ms before highlight appears
  highlightDuration: 3000,    // ms highlight persists
  
  // Scroll-Back Settings
  scrollBackWindow: 3000,     // ms window to detect scroll-back
  summaryLength: 200,         // characters in summary
  
  // Rapid Skim Settings
  skimScrollCount: 3,         // minimum scrolls to trigger
  skimTimeWindow: 2000,       // ms window for detection
  tldrLength: 120,            // characters in collapsed text
  
  // Cursor Hesitation Settings
  cursorBufferSize: 20,       // positions tracked
  varianceThreshold: 5000,    // px² trigger threshold
  
  // General
  debug: false                // enable console logging
});
```

## 🎯 Performance

AdaptiveWeb is designed for minimal impact:

| Metric | Target | Achieved |
|--------|--------|----------|
| Script Load Time | <100ms | ✅ |
| Memory Footprint | <5MB | ✅ |
| Scroll Performance | 60fps | ✅ |
| Website Compatibility | 95%+ | ✅ |

**Optimization Techniques:**
- Throttled scroll events (100ms intervals)
- Debounced hover events (100ms delay)
- Cursor sampling at 50ms (not every movement)
- WeakMap for efficient element tracking
- Limited historical buffers (10 scrolls, 20 cursor positions)

## 🌐 Browser Support

- ✅ Chrome 90+
- ✅ Microsoft Edge 90+
- ✅ Brave Browser
- ✅ Opera Browser
- ✅ Any Chromium-based browser with Manifest V3 support

## 🔒 Privacy & Security

- **100% client-side processing** - No data ever leaves your browser
- **Zero data collection** - We don't track or store anything
- **No external API calls** - Everything runs locally
- **Open source** - Audit the code yourself

## 🧪 Testing

Run the demo page to test all features:

```bash
cd demo
python -m http.server 8000
# Visit http://localhost:8000
```

**Test Scenarios:**
1.  Hover over headings for 2+ seconds → Highlight appears
2. Scroll down, then quickly back up → Summary box shows
3. Rapidly scroll 3+ times → TL;DR mode activates
4. Move cursor in circles for 3+ seconds → Suggestion appears

See [docs/TESTING.md](docs/TESTING.md) for comprehensive test procedures.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🗺️ Roadmap

### Phase 2 (Post-MVP)
- [ ] Machine learning for personalized behavior patterns
- [ ] User preference learning and adaptation
- [ ] Additional behavior patterns (double-tap, long-press)
- [ ] Enhanced accessibility features

### Phase 3 (Advanced)
- [ ] Optional AI-powered content summarization
- [ ] Multi-language interface support
- [ ] Custom behavior rule editor
- [ ] Cross-device behavior synchronization

## 📧 Contact

Questions or feedback? Open an issue or reach out! 

---

<p align="center">Made with ❤️ for better web browsing experiences</p>
