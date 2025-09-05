# TidalExt

Tidal downloader  

Based on [tidal-dl-ng](https://github.com/exislow/tidal-dl-ng)  

Rewritten from scratch in vanilla Javascript and turned into a simple web extension.  

[More info](https://nicopr.fr/goodvibes)  

Looking for [QobuzExt](https://github.com/nicopowa/qobuzext) ?  

## Informations

- First testing version
- Chromium based browsers only
- Active subscription required

## How to install

- Download or clone repository
- Open Extensions tab
- Enable "Developer mode"
- Click "Load unpacked"
- Select extension directory
- Click toolbar extensions icon
- Pin extension

## How to use

- Open [Web Player](https://tidal.com)
- Connect account
- Navigate to album or release page
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

- [ToDo](notes.tidal.md)
- [ToDo++](common/notes.md)
- Check extensions page for errors
- Press Alt+T to reload extension

## Permissions

- [storage](https://developer.chrome.com/docs/extensions/reference/api/storage) : save settings
- [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads) : download files
- [webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest) : watch network
- [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) : process audio

## Disclaimer

❌ Not affiliated with Tidal  
⚠️ No liability for any damage or issues  
🚫 No responsibility for how this software is used  
💥 Use at your own risks  
🎶 Good vibes 〜ヽ(⌐￭_￭)ノ♪♬  