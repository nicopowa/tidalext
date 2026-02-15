# TidalExt

Tidal downloader  

Based on [tidal-dl-ng](https://github.com/exislow/tidal-dl-ng) (404)  

Rewritten from scratch in vanilla Javascript and turned into a simple web extension.  

[Infos & Changelogs](https://nicopr.fr/goodvibes)  

Looking for [QobuzExt](https://github.com/nicopowa/qobuzext) ?  


## Informations

- Work in progress
- Active subscription required


## How to install


### Choose one

- Download latest release
- Download code zip archive
- Clone repository


### Chromium based browsers

- Extract extension zip
- Open Extensions tab
- Enable **Developer mode**
- Click **Load unpacked**
- Select extension directory
- Click toolbar extensions icon
- Pin extension


### Firefox

TidalExt is not published on AMO (addons.mozilla.org).  
Unsigned extensions can not be permanently installed on standard Firefox release.  


#### Replace manifest

- Delete `manifest.json`
- Rename `manifest.firefox.json` to `manifest.json`


#### Load extension temporarily (standard Firefox)

- Paste `about:debugging#/runtime/this-firefox` into the address bar and press Enter
- Click **Load Temporary Add-on**
- Browse extension directory
- Select `manifest.json`


#### Or use a different Firefox edition

- Install Firefox [Developer](https://firefox.com/download/all/desktop-developer/) or [Nightly](https://firefox.com/download/all/desktop-nightly/)
- Paste `about:config` into the address bar and press Enter
- Accept the warning message
- Search for `xpinstall.signatures.required`
- Click the toggle button to set its value to **false**
- Open terminal in extension directory
- Create extension zip package
	- Windows  
		```
		tar -a -c -f tidalext.zip manifest.json *.html *.js common/*.js common/*.css
		```
	- Linux  
		```
		apt install zip
		zip -r tidalext.zip manifest.json *.html *.js common -i "*.js" "*.css" "*.json" "*.html"
		```
- Paste `about:addons` into the address bar and press Enter
- Click the cog button, then **Install Add-on From File**
- Select `tidalext.zip`


#### Notes

- Increase this.parallel integer value in proc.dash.js (line 21) to speed up downloads, use at your own risks

- Error 401 token expired when downloading many tracks

- Edge Windows 11 bug : popup not showing, broken keyboard shortcut, extension is unresponsive and takes forever to reload  

- Edge error S6001 if DRM disabled in settings, non-blocking for TidalExt downloads  
	`edge://settings/privacy/sitePermissions/allPermissions/protectedContent`

- Firefox does not support [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen), extension automatically falls back to [hidden tabs](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/tabs/hide)  

- AI was used for FLAC conversion (M4aProcessor class)  

- Tidal default settings do not provide complete metadata, enable "Audio metadata" in [Settings](https://tidal.com/settings) > Display

- Tidal throws error S6001 


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
- [ToDo](TODO.md)
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