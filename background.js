import {browse, DEBUG} from "./common/vars.js";
import {Backstage} from "./common/back.js";

class TidalBackground extends Backstage {

	constructor() {

		super();

		this.urlBase = "https://tidal.com/";
		this.quality = "LOSSLESS";

		this.dat = {
			...this.dat,
			clientId: "zU4XHVVkc2tDPo4t",
			accessToken: ""
		};

		this.heads("https://login.tidal.com/oauth2/*");

		this.watch({
			"/pages/album": this.handleAlbum,
			"/v2/artist/": this.handleArtist
		});
	
	}

	heading(evt) {

		const authHeader = evt.requestHeaders.find(reqHeader =>
			reqHeader.name === "authorization");

		if(authHeader) {

			if(DEBUG)
				console.log("auth data");

			if(authHeader.value !== this.dat.accessToken) {

				this.dat.accessToken = authHeader.value;
				this.dat.auth = true;
				this.ready();
			
			}

		}

		return {
			requestHeaders: evt.requestHeaders
		};

	}

	async request(endpoint, params = {}) {

		const query = Object.keys(params).length ? "?" + new URLSearchParams(params) : "";
		
		const res = await fetch(
			`${this.urlBase}v1/${endpoint}${query}`,
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

		return dat;
	
	}

	handleAlbum(tab, dat) {

		const modules = dat.rows.map(row =>
			row.modules?.[0]);

		const albumInfos = modules.find(module =>
			module.type === "ALBUM_HEADER")?.album;

		const albumTracks = modules.find(module =>
			module.type === "ALBUM_ITEMS")?.pagedList?.items.filter(item =>
			item.type === "track")
		.map(track =>
			track.item);

		dat = {
			...albumInfos,
			tracks: albumTracks,
			extype: "album"
		};

		this.medias.set(
			tab.id,
			dat
		);

		if(DEBUG)
			console.log(
				tab.id,
				dat.extype,
				dat
			);

		this.mediaHint();

		this.syncPopup();

	}

	handleReleases(tab, dat) {

		dat = {
			...dat,
			extype: "releases"
		};

		this.medias.set(
			tab.id,
			dat
		);

		if(DEBUG)
			console.log(
				tab.id,
				dat.extype,
				dat
			);

		this.syncPopup();
	
	}

	handleArtist(tab, dat) {

		dat = {
			...dat,
			extype: "artist"
		};

		this.medias.set(
			tab.id,
			dat
		);

		if(DEBUG)
			console.log(
				tab.id,
				dat.extype,
				dat
			);

		this.syncPopup();

	}

	handleLabel(tab, dat) {

	}

	handlePlaylist(tab, dat) {

		dat = {
			...dat,
			extype: "playlist"
		};

		this.medias.set(
			tab.id,
			dat
		);

		if(DEBUG)
			console.log(
				tab.id,
				dat.extype,
				dat
			);

	}

	trackList(tabId) {

		return this.medias.get(tabId)?.tracks || [];
	
	}

	getTrackInfos(track, album) {

		return {
			title: this.trackTitle(track),
			album: this.albumTitle(album),
			artist: track.artists[0].name
		};
	
	}

	async getTrackUrl(track, quality) {

		super.getTrackUrl(
			track.id,
			quality
		);
		
		// what ?
		quality = quality.replace(
			"HIRES",
			"HI_RES"
		);

		const trackManifest = await this.request(
			`tracks/${track.id}/playbackinfopostpaywall`,
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

		// if(DEBUG) console.log(manifestText);

		return {
			man: manifestText,
			format: "m4a"
		};
	
	}

	getCoverUrl(tabId, media) {

		// 80 160 320 640 1280
		const coverSize = 640;

		return `https://resources.tidal.com/images/${(media?.album?.cover || media.cover).replaceAll(
			"-",
			"/"
		)}/${coverSize}x${coverSize}.jpg`;

	}

	getFilePath(track, album) {

		const variousArtists = album?.artists.length === 1
		&& album.artists[0].name.toLowerCase() === "various artists";

		const artistName = this.sanitize(variousArtists ? "Various Artists" : album?.artists[0]?.name);

		const albumTitle = this.sanitize(this.albumTitle(album));

		const albumYear = new Date(album.releaseDate || 0)
		.getFullYear();

		const trackNum = String(track.trackNumber || 1)
		.padStart(
			2,
			"0"
		);

		const fileName = this.sanitize(`${trackNum}. ${variousArtists ? track.artists[0]?.name + " -" : ""} ${this.trackTitle(track)}`);
		
		const fileExt = ".m4a";

		return `Tidal/${artistName}/${albumTitle} (${albumYear})/${fileName}${fileExt}`;

	}

	getMetaData(track, album) {

		return {

			"TITLE": this.trackTitle(track),
			...(track.version && {
				"VERSION": track.version
			}),
			"ARTIST": track.artists[0]?.name || album?.artists[0]?.name || "Unknown",
			
			"ALBUM": this.albumTitle(album),
			"ALBUMARTIST": album?.artists[0]?.name || "Unknown",

			...(album.copyright && {
				"COPYRIGHT": album.copyright
			}),

			"DATE": new Date(album?.releaseDate || 0)
			.getFullYear(),

			"TRACKNUMBER": String(track.trackNumber || 1),
			"TOTALTRACKS": String(album?.numberOfTracks || ""),
		
			// ISRC

			// UPC

			// URL

			...(track.replayGain && {
				"REPLAYGAIN_TRACK_GAIN": track.replayGain + " dB"
			})

		};
	
	}

}

new TidalBackground();