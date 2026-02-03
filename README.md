# TidalExt

Tidal downloader  

Based on [tidal-dl-ng](https://github.com/exislow/tidal-dl-ng)  

Rewritten from scratch in vanilla Javascript and turned into a simple web extension.  

[Infos & Changelog](https://nicopr.fr/goodvibes)  

Looking for [QobuzExt](https://github.com/nicopowa/qobuzext) ?  


## Informations

- Work in progress
- Active subscription required


## How to install

Clone repository, or download & extract archive.  


### Chromium based browsers

- Open Extensions tab
- Enable **Developer mode**
- Click **Load unpacked**
- Select extension directory
- Click toolbar extensions icon
- Pin extension


### Firefox

TidalExt is not published on AMO (addons.mozilla.org).  
Unsigned extensions can not be permanently installed on standard Firefox release.  


#### Build extension

- Delete `manifest.json`
- Rename `manifest.firefox.json` to `manifest.json`
- Open terminal in extension directory
- Run this command :  
	`tar -a -c -f tidalext.zip manifest.json *.html *.js common`


#### Load extension temporarily (standard Firefox)

- Type `about:debugging#/runtime/this-firefox` into the address bar and press Enter
- Click **Load Temporary Add-on**
- Select `tidalext.zip`


#### Use a different Firefox edition

- Install Firefox [Developer](https://firefox.com/download/all/desktop-developer/) or [Nightly](https://firefox.com/download/all/desktop-nightly/)
- Type `about:config` into the address bar and press Enter
- Accept the warning message
- Search for `xpinstall.signatures.required`
- Click the toggle button to set its value to **false**
- Type `about:addons` into the address bar and press Enter
- Click the cog button, then **Install Add-on From File**
- Select `tidalext.zip`


## Notes

- Massive glitch on Edge Windows 11 : extension becomes unresponsive, popup not showing, broken keyboard shortcut, extension takes forever to reload 

- Firefox does not support [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen), extension automatically falls back to [hidden tabs](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/tabs/hide).  

- AI was used for FLAC conversion (M4aProcessor class).  

- Tidal default settings do not provide complete metadata.  
Enable "Audio metadata" in [Settings](https://tidal.com/settings) > Display


## How to use

- Open [Web Player](https://tidal.com)
- Connect account
- Navigate to album or artist page
- Click extension icon


## How it works

- Extension is "passive"
- Inject code into website
- Intercept fetch requests
- Track incoming data
- Parse specific responses
- Wait for download order
- Load files one by one
- Inject metadata & cover


## Work in progress

- Check extensions page for errors
- Press Alt+T to reload extension
- [ToDo](notes.md)
- [ToDo++](common/TODO.md)


## Permissions

- [storage](https://developer.chrome.com/docs/extensions/reference/api/storage) : save settings
- [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads) : download files
- [webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest) : watch network
- [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) : process audio (Chromium)
- [tabHide](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/hide) : offscreen fallback (Firefox)


## Dependencies

¯\\_(ツ)_/¯


## Disclaimer

❌ Not affiliated with Tidal  
⚠️ No liability for any damage or issues  
🚫 No responsibility for how this software is used  
💥 Use at your own risks  
🎶 Good vibes 〜ヽ(⌐￭_￭)ノ♪♬  