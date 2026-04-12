import { redirectText } from '~/server/utils/redirect-i18n'

function renderDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #f8fafc, #f1f5f9);
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 1rem;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background: linear-gradient(180deg, #0f172a, #1e293b);
          color: #f1f5f9;
        }
      }
      main {
        width: min(92vw, 28rem);
        padding: 2.5rem;
        border-radius: 1.75rem;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
        border: 1px solid rgba(226, 232, 240, 0.8);
      }
      @media (prefers-color-scheme: dark) {
        main {
          background: rgba(30, 41, 59, 0.95);
          border-color: rgba(51, 65, 85, 0.8);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
      }
      h1 {
        margin: 0 0 0.75rem 0;
        font-size: 1.875rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        color: #0f172a;
      }
      @media (prefers-color-scheme: dark) {
        h1 { color: #f1f5f9; }
      }
      p {
        margin: 0 0 1.5rem 0;
        color: #64748b;
        line-height: 1.6;
        font-size: 0.9375rem;
      }
      @media (prefers-color-scheme: dark) {
        p { color: #94a3b8; }
      }
      .error-message {
        margin-bottom: 1rem;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        font-size: 0.875rem;
      }
      @media (prefers-color-scheme: dark) {
        .error-message {
          background: rgba(127, 29, 29, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }
      }
      input, button, a {
        font: inherit;
      }
      input {
        width: 100%;
        margin-top: 0.5rem;
        padding: 0.875rem 1.125rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.75rem;
        background: white;
        color: #0f172a;
        font-size: 0.9375rem;
        transition: all 0.15s ease;
      }
      input:focus {
        outline: none;
        border-color: #0d9488;
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
      }
      @media (prefers-color-scheme: dark) {
        input {
          background: #1e293b;
          border-color: #475569;
          color: #f1f5f9;
        }
        input:focus {
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
        }
      }
      button, .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin-top: 1.25rem;
        padding: 0.875rem 1.5rem;
        border: 0;
        border-radius: 0.75rem;
        background: #0d9488;
        color: white;
        font-weight: 600;
        font-size: 0.9375rem;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      button:hover, .button:hover {
        background: #0f766e;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
      }
      button:active, .button:active {
        transform: translateY(0);
      }
      @media (prefers-color-scheme: dark) {
        button, .button {
          background: #14b8a6;
        }
        button:hover, .button:hover {
          background: #0d9488;
          box-shadow: 0 4px 12px rgba(20, 184, 166, 0.4);
        }
      }
      a:not(.button) {
        color: #0d9488;
        text-decoration: underline;
      }
      @media (prefers-color-scheme: dark) {
        a:not(.button) { color: #5eead4; }
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`
}

export function renderPasswordPage(action: string, hasError = false) {
  return renderDocument(
    redirectText.passwordTitle,
    `<main>
      <h1>${redirectText.passwordTitle}</h1>
      <p>${redirectText.passwordDescription}</p>
      ${hasError ? '<div class="error-message">That password did not match. Please try again.</div>' : ''}
      <form method="post" action="${action}">
        <input type="password" name="password" placeholder="Enter password" autocomplete="current-password" required />
        <button type="submit">${redirectText.passwordButton}</button>
      </form>
    </main>`,
  )
}

export function renderUnsafePage(continueTo: string) {
  return renderDocument(
    redirectText.unsafeTitle,
    `<main>
      <h1>${redirectText.unsafeTitle}</h1>
      <p>${redirectText.unsafeDescription}</p>
      <a class="button" href="${continueTo}">${redirectText.unsafeButton}</a>
    </main>`,
  )
}

export function renderCloakPage(destination: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Opening destination</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        overflow: hidden;
      }
      .iframe-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #f1f5f9;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }
      .error-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, #f8fafc, #f1f5f9);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .error-card {
        max-width: 32rem;
        padding: 2.5rem;
        background: white;
        border-radius: 1.5rem;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
        text-align: center;
      }
      .error-icon {
        width: 4rem;
        height: 4rem;
        margin: 0 auto 1.5rem;
        background: #fef2f2;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
      }
      h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0.75rem;
      }
      p {
        color: #64748b;
        line-height: 1.6;
        margin-bottom: 1.5rem;
      }
      .url-box {
        padding: 1rem;
        background: #f8fafc;
        border-radius: 0.75rem;
        margin-bottom: 1.5rem;
        word-break: break-all;
        font-size: 0.875rem;
        color: #475569;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.875rem 1.5rem;
        background: #0d9488;
        color: white;
        text-decoration: none;
        border-radius: 0.75rem;
        font-weight: 600;
        transition: all 0.15s ease;
      }
      .button:hover {
        background: #0f766e;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
      }
      @media (prefers-color-scheme: dark) {
        body { background: #0f172a; }
        .iframe-container { background: #1e293b; }
        .error-overlay { background: linear-gradient(180deg, #0f172a, #1e293b); }
        .error-card { background: #1e293b; }
        .error-icon { background: rgba(127, 29, 29, 0.2); }
        h1 { color: #f1f5f9; }
        p { color: #94a3b8; }
        .url-box { background: #0f172a; color: #cbd5e1; }
        .button { background: #14b8a6; }
        .button:hover { background: #0d9488; }
      }
    </style>
  </head>
  <body>
    <div class="iframe-container">
      <iframe 
        id="destination-frame"
        src="${destination}" 
        title="Destination"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      ></iframe>
    </div>
    
    <div class="error-overlay" id="error-overlay">
      <div class="error-card">
        <div class="error-icon">🔒</div>
        <h1>Site Cannot Be Framed</h1>
        <p>This website has security restrictions that prevent it from being displayed in a frame. This is a security feature set by the destination site.</p>
        <div class="url-box">${destination}</div>
        <a href="${destination}" class="button">Open Site Directly</a>
      </div>
    </div>

    <script>
      // Detect if iframe fails to load due to CSP
      const iframe = document.getElementById('destination-frame');
      const errorOverlay = document.getElementById('error-overlay');
      let hasLoaded = false;
      
      // Listen for iframe load success
      iframe.addEventListener('load', () => {
        hasLoaded = true;
      });
      
      // Handle iframe errors (CSP violations)
      iframe.addEventListener('error', () => {
        errorOverlay.style.display = 'flex';
      });
      
      // Fallback: Check after 5 seconds if iframe never loaded
      setTimeout(() => {
        if (!hasLoaded) {
          // Try to check if iframe is accessible
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc || iframeDoc.body.innerHTML === '') {
              errorOverlay.style.display = 'flex';
            }
          } catch (e) {
            // Cross-origin or CSP blocked
            errorOverlay.style.display = 'flex';
          }
        }
      }, 5000);
      
      // Listen for console errors (CSP violations)
      window.addEventListener('securitypolicyviolation', (e) => {
        if (e.violatedDirective.includes('frame-ancestors')) {
          errorOverlay.style.display = 'flex';
        }
      });
    </script>
  </body>
</html>`
}

export function renderOpenGraphPage(destination: string, title: string | null, description: string | null, image: string | null) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0;url=${destination}">
    <meta property="og:title" content="${title || 'Syano link'}">
    <meta property="og:description" content="${description || destination}">
    ${image ? `<meta property="og:image" content="${image}">` : ''}
    <title>${title || 'Syano link'}</title>
  </head>
  <body>
    <p>Redirecting to <a href="${destination}">${destination}</a></p>
  </body>
</html>`
}

