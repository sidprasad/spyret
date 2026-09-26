# Releasing Spyret to Google Drive

With Node 22+, [GitHub CLI](https://cli.github.com/), and `tar` installed, run
from this checkout (no `npm install` or build needed):

```sh
npm run release:drive
```

The script downloads the latest GitHub release and walks you through:

1. Open a new [CPO editor](https://code.pyret.org/editor) with normal Google login.
   Replace **all** editor text (including the initial `use context` line) with the
   contents of the prepared `.js` file. Name it `spyret-vVERSION.js`, **Save**, and
   wait for saving to finish. **Do not Run** this document: it contains JavaScript.
   In Google Drive, set the saved file to **Anyone with the link / Viewer** and
   keep it under **My Drive**. Paste its CPO editor URL (`#program=...`), Drive
   link, or file ID into the script. Use the saved file, not a CPO Share copy.
2. Upload the generated `.arr` wrapper to My Drive with the same sharing setting
   and paste its Drive link into the script.
3. Copy the printed import into CPO and run the provided diagram example.
4. Test that same import with a **second account using normal CPO login** before
   distributing it. The script prepares artifacts; it does not verify Google
   permissions or perform either browser test.

### Why save the JavaScript through CPO?

CPO's normal login requests `drive.file`. Its `gdrive-js` loader uses an
authenticated request, so uploading a public JavaScript file directly to Drive
does not by itself authorize CPO to read it. Saving through CPO creates the file
with CPO's authorization. CPO saves the editor text without compiling it.
The outer `.arr` wrapper uses `shared-gdrive`, which has a public-file retrieval
path, so that file can still be uploaded directly.

For an existing JavaScript upload, **Open with → Code Pyret** in Google Drive,
if offered, is another way to grant per-file access without changing its ID.
Google documents this mechanism in its
[Drive authorization guidance](https://developers.google.com/workspace/drive/api/guides/handle-errors#appNotAuthorizedToFile).
Opening an arbitrary `editor#program=ID` link alone is not the same authorization
action. Pasting a link into this script only selects an ID; it grants no access.

This workflow still needs end-to-end verification with real CPO accounts.
Success as the publisher does not establish access for other users. If another
user gets a 403, they may need to authorize the JavaScript through Drive's
**Open with → Code Pyret** too. Do not advertise a setup-free import until the
second-account test passes. The old full-access login flow is not a prerequisite
or a recommended workaround: Google may block it.

Keep both filenames unchanged and preserve the file contents without conversion.
Use **My Drive**, not a Google **Shared drive**: CPO’s Drive loader omits the
shared-drive API flag, so files in Shared drives return 404 even when public.
A shortcut under My Drive does not change where a file lives.
The two upload files are in `release/vVERSION/upload/`; the CPO example is
saved separately as `release/vVERSION/import.arr`. Keep published Drive files
unchanged so existing imports continue to work.

If you previously uploaded directly to Drive (or used a Shared drive), rerun with
`npm run release:drive -- --tag v0.2.0 --out release/cpo-authorized` and follow
the CPO-save workflow above. Paste the new links when prompted so the wrapper
uses the new JavaScript file ID. The fresh output directory preserves the old
release artifacts; existing wrappers are never overwritten with a different ID.

To select a specific release, use `npm run release:drive -- --tag v0.2.0`.
The release must contain the browser module and Pyret rules; `v0.1.1` is headless
and cannot be used. No Google Cloud project, service account, or API setup is needed.
