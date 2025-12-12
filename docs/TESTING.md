# Testing Procedures

## Functional Testing

### Feature 1: Hover Dwell
- **Action**: Hover over a paragraph (>50px size) for 1.5 seconds.
- **Expected**: A yellow highlight appears.
- **Verification**: Check `injected.css` class `.aw-highlighted` is applied.

### Feature 2: Scroll-Back Summary
- **Action**: Scroll down at least 100px deep into a page. Then immediately scroll up within 3 seconds.
- **Expected**: A summary box appears in the top right.
- **Verification**: Check element `.aw-summary-box` exists in DOM.

### Feature 3: Rapid Skimming
- **Action**: Scroll quickly (3+ swipes) through a long text area (like the Demo page text).
- **Expected**: Long paragraphs collapse with "...read more".
- **Verification**: Check for `.aw-tldr-collapsed` class.

### Feature 4: Cursor Hesitation
- **Action**: Move mouse in circles/zig-zags for 3 seconds in one small area.
- **Expected**: A blue "Need help?" bubble appears.
- **Verification**: Check for `.aw-suggestion-bubble`.

## Troubleshooting
- **Extension not working?**: Check `chrome://extensions` for errors. Ensure "Reload" is clicked after code changes.
- **No Styles?**: Ensure `injected.css` is loaded (Network tab).
