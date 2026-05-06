# TidalExt

Tidal downloader [Web Extension](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions)  

Based on [Tidal-dl-ng](https://github.com/exislow/tidal-dl-ng) (404)  

Looking for [QobuzExt](https://github.com/nicopowa/qobuzext) ?  


## Informations

**Active subscription required** (trial or paid)  
  
[Changelogs](https://nicopr.fr/goodvibes)  


## Privacy

This extension does not need credentials. It operates by reading active session (cookies and localStorage) and intercepting fetch requests and responses to parse useful data.  

There is no data collection or analytics tracking. The only network request made outside of tidal.com is to retrieve [manifest.json](https://github.com/nicopowa/tidalext/blob/main/manifest.json) from this repository to check for updates.


## Installation

### Chromium based browsers

- Download [tidal_vX.X_chromium.zip](https://github.com/nicopowa/tidalext/releases)
- Extract archive
- Open [Extensions tab](https://support.google.com/chrome_webstore/answer/2664769#cke_bm_1361S)
- Enable **Developer mode**
- Click **Load unpacked**
- Select extracted **tidalext** directory
- Click toolbar extensions icon
- Pin extension


### Firefox

- TidalExt is **not published** on [AMO](https://addons.mozilla.org)
- Unsigned extensions **can not** be permanently installed on standard Firefox

<br/>

><details>
><summary>Load extension temporarily (standard Firefox)</summary>
><br/>
>
>- Download [tidalext_vX.X.xpi](https://github.com/nicopowa/tidalext/releases)
>- Paste this URL into the address bar and press Enter  
>	`about:debugging#/runtime/this-firefox` 
>- Click **Load Temporary Add-on**
>- Select **tidalext_vX.X.xpi**
>
></details>

<br/>

><details>
><summary>Load extension permanently (different Firefox edition)</summary>
><br/>
>
>- Install Firefox [Developer](https://firefox.com/download/all/desktop-developer/) or [Nightly](https://firefox.com/download/all/desktop-nightly/)
>- Paste this URL into the address bar and press Enter  
>	`about:config`
>- Accept the warning message
>- Paste this text into the search field  
>	`xpinstall.signatures.required`
>- Click the toggle button to set its value to **false**
>- Download [tidalext_vX.X.xpi](https://github.com/nicopowa/tidalext/releases)
>- Paste this URL into the address bar and press Enter  
>	`about:addons`
>- Click the cog button, then **Install Add-on From File**
>- Select **tidalext_vX.X.xpi**
>
></details>

<br/>

><details>
><summary>Self-distribution (not tested)</summary>
><br/>
>
>- Generate [API key](https://addons.mozilla.org/en-US/developers/addon/api/key)
>- [Sign extension](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/#sign-for-self-distribution) for self-distribution
>
></details>

<br/>

### Android

**Not stable, testing only**
  
- Install [Edge Canary](https://play.google.com/store/apps/details?id=com.microsoft.emmx.canary)
- Download [tidalext_vX.X.crx](https://github.com/nicopowa/tidalext/releases)
- Go to Settings, open **About Microsoft Edge**
- Click **5 times** on **version number** at the bottom
- Back to Settings, open **Developper options**
- Click **Extension install by crx**
- Select **tidalext_vX.X.crx**


### iOs

**Not supported**  
Work in progress  
[Edge Beta](https://testflight.apple.com/join/JkU2rh21) & [Orion](https://apps.apple.com/app/orion-browser-by-kagi/id1484498200)


## Usage

- Open [web player](https://tidal.com)
- Go to album or artist page
- Click extension icon
- Download


## Notes

- AI helped for FlacProcessor class code. Triple checked and rewritten to export clean FLAC files.
- Tidal default settings do not provide complete metadata, enable "Audio metadata" in [Settings](https://tidal.com/settings) > Display
- Huge download queue with parallel option enabled can trigger rate limiter, account logout, or temporary ban. Use with caution.
- Firefox does not support [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen), extension automatically falls back to [hidden tabs](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/tabs/hide).
- Edge silently fails to load extension on Windows 11. Clicking extension reload button [a few times](https://www.reddit.com/r/ProgrammerHumor/comments/7qippi/a_great_easter_egg/) solves the issue.

## Permissions

- [storage](https://developer.chrome.com/docs/extensions/reference/api/storage) : save settings
- [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads) : download files
- [webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest) : watch network
- [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) : process audio (Chromium)
- [tabHide](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/hide) : process audio (Firefox)


## Dependencies

¯\\_(ツ)_/¯


## Code

Vanilla JavaScript + Web Extensions API ([Mozilla](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions) / [Google](https://developer.chrome.com/docs/extensions/reference/))  
Compiled with [Closure Compiler](https://developers.google.com/closure/compiler/)  

### Load uncompiled development version

- Clone or download repository
- Rename **manifest.chromium.json** or **manifest.firefox.json** to **manifest.json**
- Load extension as described above


## Roadmap

### v1.9

- FileSystem : write files directly to disk, reduced memory usage, custom download directory, library management (Chromium based browsers only)
- [MusicBrainz](https://musicbrainz.org/) metadata
- Custom directories & files names


### v2.0

- Download relay : link mobile devices with extension, share with friends and family


## Disclaimer

❌ Not affiliated with Tidal  
⚠️ No liability for any damage or issues  
🚫 No responsibility for how this software is used  
💥 Use at your own risks  
🎶 Good vibes 〜ヽ(⌐￭_￭)ノ♪♬  
