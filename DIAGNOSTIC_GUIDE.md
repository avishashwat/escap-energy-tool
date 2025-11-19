# GeoServer WFS URL Diagnostic Guide

## What We've Done So Far

✅ **Restarted all Docker containers** with proper environment variables
- `VITE_BACKEND_URL=http://escap_backend:5000` is now set
- `VITE_GEOSERVER_URL=http://geoserver:8080/geoserver` is set
- Vite dev server is running with access to these env vars

✅ **Added diagnostic logging** to `src/config/api-config.ts`
- Module-level logging to show env vars at load time
- Function-level logging in `getGeoServerWfsUrl()` to show:
  - What `import.meta.env.VITE_BACKEND_URL` contains
  - What `API_CONFIG.BACKEND.BASE_URL` contains  
  - What `getBackendUrl()` returns
  - What the final WFS URL is

✅ **Verified backend WFS proxy is working**
- Endpoint: `http://localhost:5000/api/geoserver/escap_climate/ows?...`
- Status: 200 OK
- Returns valid GeoJSON with 20 features

## What To Check Now

### Step 1: Open Browser DevTools
1. Open http://localhost:3000 in your browser
2. Press **F12** to open DevTools
3. Go to the **Console** tab
4. Look for messages starting with:
   - `🔧 [API-CONFIG Module]` - Shows env vars at module load
   - `🔧 [getGeoServerWfsUrl]` - Shows what the function returns

### Step 2: Trigger Boundary Load
1. In the browser, interact with the map (the bhutan boundary should load by default)
2. Check the console output - you should see:
   ```
   🔗 Fetching boundary data from: <URL_HERE>
   ```

### Step 3: What To Look For

**EXPECTED OUTPUT (correct behavior):**
```
🔧 [API-CONFIG Module] Environment variables at load time:
   import.meta.env.VITE_BACKEND_URL: http://escap_backend:5000
   import.meta.env.VITE_GEOSERVER_URL: http://geoserver:8080/geoserver

🔧 [getGeoServerWfsUrl] Configuration:
   VITE_BACKEND_URL env: http://escap_backend:5000
   API_CONFIG.BACKEND.BASE_URL: http://escap_backend:5000
   getBackendUrl result: http://escap_backend:5000/api/geoserver
   Final WFS URL: http://escap_backend:5000/api/geoserver/escap_climate/ows?service=WFS&...

🔗 Fetching boundary data from: http://escap_backend:5000/api/geoserver/escap_climate/ows?...
✅ Found 20 boundary features for bhutan
```

**PROBLEMATIC OUTPUT (if something is wrong):**
- If `VITE_BACKEND_URL` shows `undefined` or `http://localhost:5000`
- If final URL shows `http://geoserver:8080/geoserver/ows` instead of `http://escap_backend:5000/api/geoserver/...`

## Possible Outcomes & Next Steps

### Outcome 1: Diagnostic shows CORRECT URL
→ The fix is working! Boundary data should load successfully.
→ If not loading, the issue is network-related (CORS, docker networking, etc.)

### Outcome 2: Diagnostic shows WRONG URL
→ Environment variable is not being read by Vite
→ Might need to rebuild/restart frontend container
→ May need to check Vite configuration

### Outcome 3: No diagnostic messages appear
→ Changes might not have been hot-reloaded
→ Try: Hard refresh browser (Ctrl+Shift+R)
→ Or: Restart frontend container

## Network Tab Check (Optional)

If console output looks correct but boundaries still don't load:
1. Go to DevTools **Network** tab
2. Reload the page
3. Look for requests to:
   - `/api/geoserver/escap_climate/ows` (should be 200)
   - `http://geoserver:8080/geoserver/ows` (should NOT appear)

## Environment Variable Verification

The environment variables were set in docker-compose.yml:
```yaml
environment:
  - VITE_BACKEND_URL=http://escap_backend:5000
  - VITE_GEOSERVER_URL=http://geoserver:8080/geoserver
```

Vite converts these to `import.meta.env.*` at runtime in the browser.

---

**Next Action:** Open the browser, check the console, and report what you see in the diagnostic output.
