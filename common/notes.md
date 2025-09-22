# Notes

## Tout doux

- [ ] keep todo list up to date
- [ ] multiple tabs handling not stable
- [ ] track all handled tabs load / focus and keep per tab id ==> media data
- [ ] single track pages
- [x] fetch repo manifest compare versions show update hint
- [ ] single cover file download if album
- [x] last downloaded queue item not removed from popup dom ?
- [ ] private channel between mobile web page and extension ? p2p ?
- [ ] popup messy progress & queue refresh
- [x] popup ditch downloadAlbum or types, use data-type and data-id
- [x] hide quality radio if no auth or link
- [ ] track handled tabs load complete & clear media if unhandled content
- [x] backgrdound this.url base website global filter
- [x] import const DEBUG all scripts
- [ ] history prev & next not refreshing detected content
- [ ] set download dir (artist, album, playlist) on order and build def download path on browser download
- [x] cleanup download handling resolve and revoke blob
- [x] ask tab reload on requests if no auth data
- [x] keep offscreen alive when downloading, kill when empty queue
- [ ] pool scrolling pages content merge loading medias
- [x] unify background generic handleDownload method >> subclasses trackList find by id
- [ ] icon badge status mini icon or queue size
- [ ] icon feedback on error and show messages top popup
- [x] album download if various artists set directory album name only instead of splitting artists dirs
- [ ] if various artists set file name {num}. {artist} - {title}
- [ ] detect artist playlist label ... pages and batch download tracks
- [ ] improve queue items infos
- [ ] show current download size or segments progress text ?
- [x] on open popup ask force sync queue
- [ ] connected account icon hint
- [ ] inject content download button in ⋮ menus ⋯
- [x] download album cover file
- [ ] download artists, labels, playlists
- [ ] check subscription status
- [x] massive downloads spam tests
- [ ] comments
- [ ] clean up the mess
- [ ] fix async behavior
- [ ] closure compiler advanced optimizations


## Docs

[WebExts](https://developer.chrome.com/docs/extensions/reference/api/extension)  
[Manifest](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)  
[Cross](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension)  
[Runtime](https://developer.chrome.com/docs/extensions/reference/api/runtime)  
[Tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs)  
[Scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting#type-ScriptInjection)  
[Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)  
[Offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen)  
[Downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads)  

# Requests

[DeclarativeContent](https://developer.chrome.com/docs/extensions/reference/api/declarativeContent#type-RequestContentScript)  
[WebRequest](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/webRequest)  
[StreamFilter](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/StreamFilter) (not available in chrome)  

# Firefox

[BrowserSpecificSettings](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)  
[WebExt](https://extensionworkshop.com/documentation/develop/web-ext-command-reference)  


# Ideas

- spotify is now lossless !