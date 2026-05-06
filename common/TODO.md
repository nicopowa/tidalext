# Tout doux

## Global

- [x] replace browser storage calls by Stor util class
- [x] import const DEBUG all scripts
- [x] common entry point
- [ ] extension context invalidated (ノಠ益ಠ)ノ彡┻━┻

## Watch

- [x] urls regex test
- [x] hijack urls conf objects with options
- [ ] hijack flags : clear popup media display, ... ?
- [ ] icon hint when media request starts loading ?

## Parsing

- [ ] history state prev next detection, keep parser history array ?
- [ ] handle mixed media types (home page, artist page, search results)
- [x] user collection
- [ ] search results
- [ ] single track page ?

## Downloads

- [ ] show warning when downloading too many tracks, hello rate limiter
- [x] download queue pause / resume button
- [x] items cancel download button
- [ ] rewrite artwork handling : background script temp keep blob if store.artwork === true, send arraybuffer to offscreen, don't send blob back
- [ ] show popup warning if already in queue
- [x] parallel downloads
- [x] on the fly metadata injection
- [ ] direct write to disk (chromium only)
- [ ] user library download & sync
- [ ] android edge canary not creating artist/album directories
- [ ] browser downloads api error handling (overwrite, access, ...)
- [ ] send clear blobs msg to offscreen if download error
- [ ] popup download item not updating status on fail
- [ ] keep downloaded tracks ids in storage && skip ?
- [ ] label batch download create {LabelName} parent directory ?
- [ ] download filename sanitize catch error & brutal normalize ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
- [x] single artwork file download if album
- [ ] show current download size or segments progress text ?

## Audio process

- [x] parallel downloads -> per track new processor instance
- [x] streams ! not melting RAM anymore :)
- [ ] CUE sheet ?
- [ ] m3u8 option for albums and playlists

## Metadata

- [ ] remove "Unknown" fallback
- [ ] MusicBrainz UPC lookup option
- [ ] Lyrics ?

## Background

- [ ] simplify listRules & trackRules
- [x] move this.hijack to popped > export HiJack > import in background
- [ ] rewrite handleDownload, no need type check, loop albums || releases || tracks
- [ ] move albumTitle trackTitle methods to popped
- [ ] ditch this.dat, use this.store instead, shared with other scripts
- [ ] store this.medias to storage or offscreen when background script becomes inactive (lost tab)
- [ ] simplify background media parsers methods like popped
- [x] move getcoverurl to popped

## Offscreen

- [x] <strike>memory leak, pop new offscreen for each track and kill to auto revoke blobs</stroke>
- [ ] rewrite out.js, maybe merge into back
- [x] Qobuz & Tidal offscreen.js now identical, delete and send processor class from qobuzext & tidalext
- [x] base audio processor class & extend

## Content script

- [x] merge content & inject + self inject
- [x] <strike>common content script, separate inject.js</strike>
- [x] localstorage change tracker

## Injected code

- [x] fetch urls regex test
- [x] inject to content use <strike>customEvent</strike> or postMessage ?
- [x] Firefox bug not dispatching CustomEvent from content to inject ?
- [x] Chromium CustomEvent breaks all Tidal requests
- [x] postMessage it is.

## Popup

- [ ] queue sticky releases info + sub items tracks
- [ ] keep downloaded items list, autoscroll if user manually hits bottom
- [ ] queue head show current / total
- [x] handle mixed media types
- [ ] text input items instant search filter ?
- [ ] btns sort items by title, year, artist, type, quality, ...?
- [ ] make items info (album, artist, ...) clickable & open tabs ?
- [ ] show nomedia if unhandled page data 
- [ ] linking state sync when opening popup after tab create or swap
- [ ] extension linking state timeout & message if failed
- [ ] simplify link : on click icon if not downloading & tab not open or focus auto tab without click click
- [x] popup html & extends now useless, export quality values from popped & work from common/pops
- [x] popup infos header track count & total time
- [ ] download queue header infos, counts, ...
- [ ] queue items display same as track items
- [x] cancel download button queue items
- [ ] failed download replace cancel button by retry button
- [ ] artists & labels "please scroll down" -> auto scroll button
- [x] top left settings btn & full size settings pane
- [x] messy progress & queue refresh
- [x] popup ditch downloadAlbum or types, use data-type and data-id
- [x] popup sync single message with infos & queue
- [x] rewrite simple CSS streamlined media list templates

## Icon

- [x] show progress option
- [x] render parallel downloads
- [ ] double progress current downloads & overall percent ? 

## Settings

- [ ] btn download current media json (debug)
- [ ] btn toggle sidebar feature on/off
- [ ] btn extract session & tokens + output clone code

## Release

- [x] package script
- [x] closure compiler JS
- [x] min CSS
- [x] min HTML
- [x] zip chromium & firefox
- [x] pack chromium CRX
- [x] pack firefox XPI

## Bugs

- [ ] chromium network utility service memory leak
- [ ] firefox extension icon flicker
- [ ] edge extension breaks after some time, popup not opening, reload service worker inactive glitch / fix fail : extension listeners init first / edge://serviceworker-internals/

## Android

- [x] Edge Canary

## iOs

- [ ] Edge TestFlight beta

## Mess

- [ ] choose between side bar or popup ?
- [x] send watch urls from background to injected code ? <strike>page load race condition ?</strike>
- [ ] fix playlist indexes++ skip unavailable tracks
- [ ] file system permission directory ref better downloads management (duplicates, artwork, ...)
- [ ] multiple tabs handling unstable
- [ ] track handled tabs load complete & clear media if unhandled content
- [ ] track all handled tabs load / focus and keep per tab id ==> media data
- [ ] settings : quality, show images in popup, download artwork files, custom file naming template
- [ ] custom dirs & files naming %artist%/%album%/%trackno%. %tracktitle% etc
- [x] fetch repo manifest compare versions show update hint
- [x] last downloaded queue item not removed from popup dom ?
- [x] hide quality radio if no auth or link
- [x] background this.url base website global filter
- [ ] history prev & next not refreshing detected content
- [x] set download dir (artist, album, playlist) on order and build def download path on browser download
- [x] cleanup download handling resolve and revoke blob
- [x] ask tab reload on requests if no auth data
- [x] keep offscreen alive when downloading, kill when empty queue
- [x] pool scrolling pages content merge loading medias
- [x] unify background generic handleDownload method >> subclasses trackList find by id
- [ ] icon badge status tiny sub icon or queue size ?
- [ ] icon hint on error and popup error messages / unstable
- [x] album download if various artists set directory album name only instead of splitting artists dirs
- [x] if various artists set file name {num}. {artist} - {title}
- [x] detect artist playlist label ... pages and batch download tracks
- [x] improve queue items infos
- [x] on open popup ask force sync queue
- [ ] connected account state icon hint
- [x] inject content download button in website ⋮ menus ⋯ / tested, useless
- [x] download album artwork file
- [x] check subscription status
- [x] massive downloads spam tests
- [x] ditch async messages
- [x] closure compiler advanced optimizations