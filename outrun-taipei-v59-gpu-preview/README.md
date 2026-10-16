# Outrun Taipei — V59.7 GPU prewarm preview

Source: cb8b270da560dc34913a7a6d3159b9e7f6ab5566
PR: https://github.com/kevin781130-netizen/Outrun-Taipei/pull/34

This is a separate Pages folder and does not modify `outrun-taipei/`
or the earlier V59.5 preview.

## Playtest
Open `index.html`. The right-top V59.5 preview diagnostics panel lets
you fast-jump to the fork, read actual RAF frame intervals and JS CPU time,
and export JSON. Those are not completed GPU timings. The rendering bundle
is V59.7 with staged invisible vertex-buffer upload. The panel text still
says V59.5 because its UI/layout is deliberately unchanged between trials.

GitHub Actions `V59.7 GPU Preview WebGL QA` validates the published
build's exact source SHA and drives one desktop left + one narrow-screen
right route join in headless Chromium with SwiftShader, saving screenshots
and timing receipts. A passing screenshot-file check is not a substitute
for a human visual audit or playing on the user's actual device.
