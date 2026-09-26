# Releasing Spyret to Google Drive

With Node 22+, [GitHub CLI](https://cli.github.com/), and `tar` installed, run
from this checkout (no `npm install` or build needed):

```sh
npm run release:drive
```

The script downloads the latest GitHub release and walks you through:

1. Upload the prepared `.js` file to your Google Drive. Set **Anyone with the
   link / Viewer**, then paste its Drive link into the script.
2. Upload the generated `.arr` file with the same sharing setting and paste
   its Drive link into the script.
3. Copy the printed import into CPO and run the provided diagram example.
   Share that import line with users: it includes typed constructors and diagrams.

Keep both filenames unchanged and upload them as files without conversion.
The two upload files are in `release/vVERSION/upload/`; the CPO example is
saved separately as `release/vVERSION/import.arr`. Keep published Drive files
unchanged so existing imports continue to work.

To select a specific release, use `npm run release:drive -- --tag v0.2.0`.
The release must contain the browser module and Pyret rules; `v0.1.1` is headless
and cannot be used. No Google Cloud project, service account, or API setup is needed.
