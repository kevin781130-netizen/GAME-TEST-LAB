# V59.5 Deployed WebGL QA

Runs Chromium against the already-published V59.5 preview, not a local source copy.

Desktop (1280 × 800) drives 1A → 2A using the left fast-jump button. Mobile (390 × 844) drives 1A → 2B using the right fast-jump button. It checks the WebGL canvas, exact deployed source SHA, successful route handoff, JavaScript errors, and captures before/after screenshots and two seconds of RAF / CPU frame timing around the boundary.

This is headless Chromium with SwiftShader, not a physical device. If drift is not active at the handoff, the test explicitly marks active-drift continuity unverified. Screenshots are for human visual review. Production deployment and the game source are untouched.
