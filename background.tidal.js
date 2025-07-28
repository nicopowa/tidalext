const browser = chrome;

import {Backstage, BaseQueueManager} from "./common/back.js";

class TidalQueueManager extends BaseQueueManager {

	async downloadTask(task) {

		// console.log("task", task);

		const trackData = await this.main.trackUrl(
			task.track.id,
			task.quality
		);
		
		console.log(trackData);

		if(!trackData.urls.length) {

			throw new Error("no download urls");
		
		}

		await this.startDownload(
			trackData.urls,
			task
		);
	
	}

}

class TidalBackground extends Backstage {

	constructor() {

		super();

		this.dat = {
			auth: false,
			clientId: "zU4XHVVkc2tDPo4t",
			accessToken: ""
		};

		this.queue = new TidalQueueManager(this);

		this.heading = this.heads.bind(this);

		this.init();
	
	}
	
	async init() {

		browser.webRequest.onBeforeSendHeaders.addListener(
			this.heading,
			{
				urls: ["https://login.tidal.com/oauth2/*"]
			},
			[
				"requestHeaders"
			]
		);

		const dataUrls = {
			"/pages/album": this.handleAlbum,
			"/v2/artist/": this.handleArtist
		};

		Object.entries(dataUrls)
		.forEach(([url, cbk]) =>
			this.track(
				url,
				cbk.bind(this)
			));

		await this.queue.init("offscreen.tidal.html");
	
	}

	heads(evt) {

		const authHeader = evt.requestHeaders.find(reqHeader =>
			reqHeader.name === "authorization");

		if(authHeader) {

			console.log("auth header");

			this.dat.accessToken = authHeader.value;
			this.dat.auth = true;

		}

		return {
			requestHeaders: evt.requestHeaders
		};

	}

	async request(endpoint, params = {}) {

		// console.log("req", endpoint, params);

		const query = Object.keys(params).length ? "?" + new URLSearchParams(params) : "";
		
		const res = await fetch(
			`https://listen.tidal.com/v1/${endpoint}${query}`,
			{
				headers: {
					"Content-Type": "application/json",
					"X-Tidal-Token": this.dat.clientId,
					...(this.dat.auth ? {
						"Authorization": this.dat.accessToken
					} : {})
				}
			}
		);

		if(!res.ok)
			throw new Error(`http ${res.status}: ${res.statusText}`);
		
		const dat = await res.json();

		if(dat.status && dat.status !== "success")
			throw new Error(dat.message || "api request failed");

		return dat;
	
	}

	handleAlbum(dat) {

		const modules = dat.rows.map(row =>
			row.modules?.[0]);

		const albumInfos = modules.find(module =>
			module.type === "ALBUM_HEADER")?.album;

		const albumTracks = modules.find(module =>
			module.type === "ALBUM_ITEMS")?.pagedList?.items.filter(item =>
			item.type === "track")
		.map(item =>
			item.item);

		this.media = {
			...albumInfos,
			tracks: albumTracks,
			extype: "album"
		};

		console.log(
			"album",
			this.media
		);

		this.mediaHint();

	}

	handleReleases(dat) {

		this.media = {
			...dat,
			extype: "releases"
		};

		console.log(
			"releases",
			this.media
		);
	
	}

	handleArtist(dat) {

		this.media = {
			...dat,
			extype: "artist"
		};

		console.log(
			"artist",
			this.media
		);

	}

	async trackUrl(trackId, quality) {

		if(quality === "HIRES_LOSSLESS")
			quality = "HI_RES_LOSSLESS";

		const trackManifest = await this.request(
			`tracks/${trackId}/playbackinfopostpaywall`,
			{
				playbackmode: "STREAM",
				assetpresentation: "FULL",
				audioquality: quality,
				countryCode: "US"
			}
		);

		if(!trackManifest.manifest) {

			throw new Error("no manifest");
		
		}

		const manifestText = atob(trackManifest.manifest);

		try {

			// JSON manifest = FLAC
			const json = JSON.parse(manifestText);

			return {
				urls: json.urls || [],
				format: "flac"
			};
		
		}
		catch(err) {

			// XML manifest = DASH = M4A
			const urls = [];
			const init = manifestText.match(/initialization="([^"]+)"/)?.[1];
			const media = manifestText.match(/media="([^"]+)"/)?.[1];
			const timeline = manifestText.match(/<SegmentTimeline>(.*?)<\/SegmentTimeline>/s)?.[1];
			
			if(init)
				urls.push(init);

			if(media && timeline) {

				let segNum = 1;

				for(const match of timeline.matchAll(/<S d="\d+"(?: r="(\d+)")?/g)) {

					const repeat = parseInt(match[1] || 0);

					for(let i = 0; i <= repeat; i++) {

						urls.push(media.replace(
							"$Number$",
							segNum++
						));
					
					}
				
				}
			
			}

			return {
				urls: urls,
				format: "m4a"
			};
		
		}
	
	}

	filename(track, album) {

		const trackNum = String(track.trackNumber || 1)
		.padStart(
			2,
			"0"
		);

		const ext = ".flac";
		const title = this.sanitize(this.trackName(track));
		const artist = this.sanitize(track.artists[0]?.name || album?.artists[0]?.name || "Unknown");
		const albumTitle = this.sanitize(album?.title || "Unknown");
		const year = new Date(album.releaseDate || 0)
		.getFullYear();

		return `Tidal/${artist}/${albumTitle} (${year})/${trackNum}. ${title}${ext}`;
	
	}
	
	async handleDownload(msg) {

		try {

			// console.log("download", msg);

			const {
				mediaType, mediaId, quality
			} = msg;

			const coverBlob = await this.getCover(`https://resources.tidal.com/images/${this.media.cover.replaceAll(
				"-",
				"/"
			)}/640x640.jpg`);

			if(mediaType === "track") {

				const track = this.media?.tracks.find(track =>
					track.id === mediaId);

				if(track) {

					this.trackDownload(
						track,
						this.media,
						quality,
						coverBlob
					);

				}
			
			}
			else if(mediaType === "album") {

				for(const track of this.media.tracks || []) {

					this.trackDownload(
						track,
						this.media,
						quality,
						coverBlob
					);
				
				}
			
			}
			else {

				return {
					ok: false,
					error: "invalid media type"
				};
			
			}

			return {
				ok: true
			};
		
		}
		catch(err) {

			return {
				ok: false,
				error: err.message
			};
		
		}
	
	}

	trackMeta(track, album) {

		return {
			"TITLE": track.title || "Unknown",
			"ARTIST": track.artists[0]?.name || album?.artists[0]?.name || "Unknown",
			"ALBUM": album?.title || "Unknown",
			"TRACKNUMBER": String(track.trackNumber || 1),
			"ALBUMARTIST": album?.artists[0]?.name || "Unknown",
			"DATE": new Date(album?.releaseDate || 0)
			.getFullYear(),
			"TOTALTRACKS": String(album?.numberOfTracks || "")
		};
	
	}

}

new TidalBackground();