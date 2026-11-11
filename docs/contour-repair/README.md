# Shaded artwork repair

The submitted tiger project used its saved 1000 px resolution, automatic
threshold and disabled small-shape cleanup. Opening it reproduced the cheek
and nose artifacts. The threshold mask already showed the stray regions before
tracing. Parts of the orange shadows were close to the selected brightness
boundary, so the threshold split them into patches and extra material islands.

The repair flattens the artwork to six colours before thresholding, using the
existing Reduce colours step with no extra blur. This keeps the orange shading
out of the dark mask and retains the dark red nose and intentional whisker dots.
The four- and five-colour trials excluded the red nose. Six colours at 1400 px,
with gentle vector tracing and 64 px² cleanup, gave the cleanest tested result.

New Standard image projects use this preparation by default. Older simple
vector projects offer **Clean shaded artwork** in Quick Adjustments. The action
keeps the original artwork, framing, threshold choice, physical dimensions and
support settings. It can be undone in one step. **Artwork colours** is editable under
Detailed artwork. The repair remains a saved graph built from existing engine
operations, so previous Studio builds and the CLI can replay it.

The exact submitted project and all its embedded images were checked through
the browser. Its original export matched the baseline byte for byte. The repaired
project keeps automatic threshold and produces one closed 200 × 200 × 5.2 mm
mesh with 45,896 triangles, zero open edges and zero degenerate triangles. The
material island count fell from 28 to 12. A fresh upload using the new defaults,
the repaired saved project and the native CLI produced identical STL bytes.
See [exact project checks](tiger-verification.json).

The production build and TypeScript checks passed. Twelve focused tests cover
styles, preparation, defaults, live updates, settings, presets and native text
replay. The final preset test passed after restoring the expected tolerance of a
saved template created after an engine-default reset. Cat and lettering samples
also passed independent closed-mesh checks. Package QA rechecks the fresh
defaults, export workflows and shutdown. Both Macs were tested on hosted macOS.
