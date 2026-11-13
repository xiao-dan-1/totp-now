# Repository Guidelines

## Project Structure

This repository contains a browser-based TOTP calculator. The first version takes a Base32 setup key and displays a six-digit code and its remaining validity. The page lives at `index.html` and its styles at `styles.css`. In `src/`, `config.js` validates settings, `totp.js` decodes Base32 and calculates codes, and `app.js` handles the browser interface.

## Local Development

Run `python3 -m http.server 8000 --bind 127.0.0.1` from the repository root and open `http://127.0.0.1:8000`. This serves the static files and lets you exercise Web Crypto and clipboard behavior on localhost. Use HTTPS for deployment. The repository currently has no build, lint, or test commands. Document any commands when introducing tooling.

## Coding Style

Use two spaces for indentation in HTML, CSS, and JavaScript. Use `camelCase` for JavaScript functions and variables and `kebab-case` for CSS classes. Pass an explicit timestamp to the TOTP calculation so tests can use a fixed clock. Keep countdown and clipboard behavior in the UI module.

## Testing

Check the default SHA-1, 30-second, six-digit configuration against public RFC test vectors. Cover invalid Base32 input, leading zeroes, and the exact boundary between time windows. In the browser, check that copying yields six contiguous digits and that returning to the tab refreshes the code. Use public test keys in fixtures and screenshots.

## Key Handling

Compute codes locally with Web Crypto. Keep the setup key in page memory and clear it when the user resets the form. Keep keys out of URLs, logs, network requests, and persistent browser storage. Verify key handling in the browser after changes to input or analytics.

## Commits and Pull Requests

Git history is empty. Use short, imperative subjects such as `Add Base32 input validation`. In pull requests, describe the user-facing change and how you verified it. Link a relevant issue when available and include a screenshot for visible UI changes.
