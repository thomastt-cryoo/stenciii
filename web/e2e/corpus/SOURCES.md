# M2 artwork corpus

The synthetic artwork is original, deterministic test material under this repository's license. `scripts/m2/create_corpus.py` regenerates it; generated lettering uses Arial Bold on the recorded Windows run (a rendered bitmap, no font redistribution). Committed fixtures and their SHA-256 hashes are authoritative for replay on other systems.

Two unmodified sample photographs are from the official scikit-image v0.19.3 repository:

- `astronaut.png`: NASA photograph of Eileen Collins, public domain / no known copyright restrictions. [Dataset description and provenance](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut).
- `coins.png`: Brooklyn Museum collection, no known copyright restrictions. [Dataset description and provenance](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.coins).

Exact download URLs and SHA-256 hashes are in `manifest.json`. Photographs test the limitations of threshold-based stencil creation; including them does not imply endorsement or a promise of faithful photographic reproduction. Fixtures are local during tests and application processing makes no external requests.
