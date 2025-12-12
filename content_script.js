(function() {
  // Prevent duplicate injection
  if (window.AdaptiveWebInjected) return;
  window.AdaptiveWebInjected = true;

  console.log('AdaptiveWeb: Initializing injection...');

  // Inject CSS
  const link = document.createElement('link');
  link.href = chrome.runtime.getURL('injected.css');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  document.head.appendChild(link);

  // Inject JS
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
})();
