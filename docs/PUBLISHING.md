# Publishing Event Horizon as a Vortex extension

How this extension gets from this repo onto someone else's Vortex.

Everything in **Mechanism** below was read out of the Vortex installation on
this machine (`C:\Program Files\Vortex\resources\app.asar` and its unpacked
`bundledPlugins`), not from documentation or memory. Where something could not
be verified that way it says so explicitly — those are the parts to confirm
before relying on them.

---

## 1. What a Vortex extension actually is

A folder containing a manifest and an entry point. Vortex loads extensions from
`%APPDATA%/Vortex/plugins/<name>/`.

Ours consists of exactly four things, which is what
`scripts/deploy-to-vortex.js` installs and what the release package contains:

| Path | What it is |
| --- | --- |
| `info.json` | The manifest. **Must be at the archive root.** |
| `index.js` | Entry point Vortex requires at load. |
| `dist/**` | Compiled TypeScript (`npm run build`). |
| `assets/**` | Static assets — currently the sidebar icon sprite. |

### `info.json`

**Verified:** all 60 extensions bundled with this Vortex build use exactly
these four fields and no others:

```json
{
  "name": "Event Horizon",
  "author": "DuduPhudu and Bluuuk",
  "version": "0.1.0-alpha.1",
  "description": "Capture and reproduce a curator's exact mod state ..."
}
```

`version` here is what the extension browser displays. `npm run
package:extension` refuses to build if it disagrees with `package.json`,
because shipping them out of step advertises a version the code does not claim.

---

## 2. Mechanism — how Vortex finds extensions

Two separate things, and conflating them is why "I uploaded it and it isn't in
the list" happens.

### 2a. Extensions are Nexus mods under the `site` game

Vortex builds extension links as `` `${NEXUS_BASE_URL}/site/mods/` `` — the
`site` game domain, presented in the UI as **"Tools & Extensions"**
(`SITE_GAME_NAME`). So an extension is uploaded like any other Nexus mod, just
under that pseudo-game rather than Fallout 4.

Vortex special-cases downloads from it: when the download's game is `site` it
emits `install-extension-from-download` instead of installing a mod.

### 2b. The browser list is a CURATED manifest, not a Nexus query

Vortex's extension browser does not search Nexus. It downloads:

```
https://raw.githubusercontent.com/Nexus-Mods/Vortex-Backend/main/out/extensions-manifest.json
```

(`EXTENSION_URL` = `githubRawUrl("Nexus-Mods/Vortex-Backend", "main",
"out/extensions-manifest.json")`. Preview builds read `Vortex-Staging`
instead.)

That file is `{ "last_updated": <ms>, "extensions": [ ... ] }`. A full entry
looks like:

```json
{
  "name": "Archive binding fix",
  "description": { "short": "...", "long": "..." },
  "image": "https://staticdelivery.nexusmods.com/mods/2295/images/25/...",
  "tags": [], "downloads": 8600, "endorsements": 910,
  "author": "Nexus Mods", "version": "0.1.0",
  "modId": 25, "fileId": 71,
  "timestamp": 1537516083, "uploader": "Tannin42"
}
```

Only `modId` and `fileId` are load-bearing — some entries carry nothing else,
and the rest is metadata mirrored from the Nexus page. Some entries also carry
`type` (`"translation"`, `"theme"`) or `language`.

**The consequence:** uploading to Nexus makes the extension *installable by
URL/file*. It does **not** put it in the browser. That requires an entry in a
repository owned by Nexus Mods.

> **NOT VERIFIED:** the human process for getting an entry added — who reviews
> it, on what timeline, and through which channel (PR to `Vortex-Backend`,
> Discord, or forum request). The repo is Nexus's, and nothing in the shipped
> app states the submission route. **Confirm this with Nexus before promising
> anyone a listing date.** The Vortex Discord's extension-development channel
> is the usual starting point.

---

## 3. Procedure — cutting a release

### Step 1 — decide the version

Bump **both** `info.json` and `package.json` to the same value.

Alpha/beta suffixes are fine (`0.1.0-alpha.1`); the browser shows the string
verbatim.

### Step 2 — build and package

```
npm run package:extension
```

This runs `npm run build` (which itself runs `check-version-sync`), then writes
`release/event-horizon-<version>.zip` with `info.json` at the archive root.

Why a script rather than zipping the folder: Vortex reads `info.json` from the
archive **root**, and zipping the project directory buries it one level down.
Vortex then rejects the extension for a missing manifest, and you find out
after the upload.

### Step 3 — check it before uploading

Do not skip this. It is two minutes and it is the difference between a broken
release and a working one.

```
npm test                 # full suite
npm run typecheck        # src
npm run typecheck:test   # tests, which tsc otherwise never sees
npm run smoke            # loads the DEPLOYED copy and registers its actions
```

Then install the zip into a real Vortex the way a user will:

1. Vortex → Extensions → the drop zone at the bottom (or the "Install from
   file" control), and pick `release/event-horizon-<version>.zip`.
2. Restart Vortex when prompted.
3. Confirm the sidebar entry appears and the Build and Install pages open.

Installing the zip is not the same code path as `npm run deploy:vortex`, which
copies loose files. Only the zip proves the archive layout is right.

### Step 4 — upload to Nexus

Under **Tools & Extensions** (`nexusmods.com/site`), as a normal mod:

- The uploaded file is `release/event-horizon-<version>.zip`.
- Note the resulting **`modId`** and, for the uploaded file, its **`fileId`** —
  those two numbers are what the extension manifest keys on.

### Step 5 — request the browser listing

Ask Nexus to add the entry to `Vortex-Backend`'s
`out/extensions-manifest.json`, supplying `modId` and `fileId`.

See the NOT VERIFIED note in §2b: confirm the current channel rather than
assuming a PR is accepted.

Until that lands, people can still install by downloading the zip from the mod
page and using Install from file — worth saying plainly in the mod description
rather than letting testers conclude it is broken.

### Step 6 — updating

Upload a new file to the **same** mod page, then give Nexus the new `fileId`.
`modId` does not change. Vortex compares the manifest's `version` against the
installed one to offer updates, so an un-bumped version ships as "no update
available".

---

## 4. Before the first public release

These are open, and none of them is a code change:

- [ ] Confirm the manifest submission channel (§2b).
- [ ] Decide the public name — `info.json` says "Event Horizon"; the folder and
      npm package say `vortex-event-horizon` / `vortex-mod-monitor`. The last
      is a leftover and reads oddly on a mod page.
- [ ] A mod-page description and at least one screenshot; the browser shows
      `description.short` and `image` from the mirrored Nexus data.
- [ ] Decide what a supported game list means publicly — the code accepts
      `skyrimse`, `fallout3`, `falloutnv`, `fallout4`, `starfield`, but only
      Fallout 4 has been exercised on a real 963-mod collection.
- [ ] State the Nexus Premium expectation up front. Installing a large
      collection without it means one manual click per mod.
