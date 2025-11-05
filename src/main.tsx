import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback-simple.tsx'

import "./main.css"

console.log('🧹 COMPLETE GitHub Spark elimination - localStorage only mode');

// NUCLEAR OPTION: Block ALL possible GitHub/Spark communication
(function() {
  'use strict';
  
  // Block all globals
  const blockedGlobals = ['spark', '__GITHUB_SPARK__', '_spark', 'github'];
  blockedGlobals.forEach(global => {
    try {
      Object.defineProperty(window, global, {
        value: undefined,
        writable: false,
        configurable: false
      });
    } catch(e) {}
  });

  // TOTAL NETWORK BLOCKING for GitHub/Spark
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : 
               input instanceof URL ? input.href : 
               (input as any).url || '';
    
    if (url.includes('/_spark/') || 
        url.includes('github.com') || 
        url.includes('spark') ||
        url.includes('githubnext')) {
      console.log('🚫 NUCLEAR BLOCKED:', url);
      return Promise.reject(new Error('ALL GitHub/Spark communication blocked'));
    }
    return originalFetch.call(this, input, init);
  };

  // Block ALL XHR to GitHub/Spark
  const OriginalXHR = window.XMLHttpRequest;
  (window as any).XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    xhr.open = function(method: string, url: string | URL) {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/_spark/') || 
          urlStr.includes('github.com') || 
          urlStr.includes('spark') ||
          urlStr.includes('githubnext')) {
        console.log('🚫 NUCLEAR BLOCKED XHR:', urlStr);
        throw new Error('ALL GitHub/Spark XHR blocked');
      }
      return originalOpen.apply(this, arguments);
    };
    return xhr;
  } as any;

  // Clear only GitHub/Spark API-related storage, preserve admin authentication
  try {
    Object.keys(localStorage).forEach(key => {
      // Only clear GitHub API tokens and Spark API data, NOT admin authentication
      if ((key.includes('github') && key.includes('token')) || 
          (key.includes('spark') && key.includes('api')) ||
          key.includes('github_spark_fallback')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach(key => {
      // Only clear GitHub API tokens and Spark API data, NOT admin authentication  
      if ((key.includes('github') && key.includes('token')) || 
          (key.includes('spark') && key.includes('api')) ||
          key.includes('github_spark_fallback')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch(e) {}

  console.log('✅ NUCLEAR GitHub Spark blocking active');
})();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
