Use it, break it, fix it, trash it, change it, mail – upgrade it.

# From scratch

## Data parsing

- Ditch Qobuz & Tidal hardcoded parsing methods
- Register url hijacking with options, sync with injected script  
	```
	[
		{
			typ: "data type label", 
			url: "intercept/exact/url/or/regex, 
			cbk: res => {handler},
		}, 
		{
			...
		}
	]
	```

## Popup

### Media display

- Ditch overcomplex CSS
- No extype check, array<string> only => render lines H1 H2 H3

### Download queue

- QueueItem base class
- Media types child classes : track / album / artist / label / playlist 
- Fetch & flatten tracklist only when starting download

## Background

- Message relay between content / inject / popup / extpage / offscreen scripts

## Offscreen

- Expose base audio processing class
- Extended from Qobuz & Tidal downloaders

## New features

- Extension page tab with all features & options ?
- File system access permission
	- Better library management
	- Clean cover images download
	- Extension auto-update ? ⋆✴︎˚｡⋆
- WebRTC mobile remote download
	- Private downloader : secured link via QR code or one-time invite link via email
	- Public downloader : allow external download orders
		- Custom limits : global or IP, per hour, day
		- Download speed throttle, rate limiter, ...
		- Use Qobuz & Tidal / iOs & Android [Flaque](https://nicopr.fr/flaque#flaque-to-go) shortcuts