BACKUP BEFORE MAQUETTE CHANGE

Timestamp: 2026-01-30 (snapshot before implementing `maquette` folder)

Frontend files snapshot:
- _deploy/js/app.js (main frontend logic; ~16864 lines)
- index.html (entry page; sets window.API_BASE_URL)
- maquettes.txt (generated list of existing quote-images/*maquette*.jpg)
- README.md (current documentation - this snapshot accompanies it)

GCS (history - do NOT modify):
- Bucket: gs://qcag-483014-qcag-images/quote-images/
- Example object found: quote-images/1769407623579_2f7653430b27dd0926be_maquette.jpg
- Note: treat `quote-images/` as read-only historical archive going forward.

Backend endpoints verified (used during mapping/patching):
- GET /quotations
- GET /quotations/:id/images
- PATCH /quotations/:id
- POST /images/upload (accepts folder, quoteKey, orderKey)
- GET /images/v/:b64 (proxy to GCS object name, base64url encoded)

Temporary files produced by preparatory steps (may exist in this folder):
- maquettes.txt  (list of maquette objects)
- quotes.json    (snapshot of GET /quotations?limit=1000)
- mapping.ps1    (PS script used for mapping/patching)
- results.json   (mapping script results)

Revert guidance:
- Keep copies of `_deploy/js/app.js` and this backup file.
- If a change causes regressions, re-deploy previous `app.js` to the frontend bucket and restore DB fields by PATCHing `images` back to previous JSON values using the API.

Next steps (after your approval):
1) Implement frontend upload flow to use folder `maquette` and store results into `maquette_images` field on quote.
2) Ensure newly created quotes re-upload any pre-uploaded images with `quoteKey` so files go to `maquette/<quote_code>/...`.
3) Do not modify `quote-images/` historical folder.

Approve to proceed or tell me to hold.