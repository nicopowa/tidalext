import {browse, DEBUG} from "./common/vars.js";
import {Backstage} from "./common/back.js";
import {deep} from "./common/util.js";

class TidalBackground extends Backstage {

	constructor() {

		super();

		this.opt = {
			...this.opt,
			// 80 160 320 640 1280
			coverSize: 640
		};

		this.urlBase = "https://tidal.com/";
		this.quality = "LOSSLESS";

		this.dat = {
			...this.dat,
			clientId: "zU4XHVVkc2tDPo4t",
			accessToken: "",
			countryCode: "US"
		};

		this.heads("https://login.tidal.com/oauth2/*");

		this.watch({
			"/v1/country": this.handleCountry,
			"/pages/album": this.handleAlbum,
			"/v2/artist/": this.handleArtist,
			"/v1/playlists/": this.handlePlaylist
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

	handleCountry(tab, dat) {

		//if(DEBUG) console.log("COUNTRY", dat);

		this.dat.countryCode = dat.countryCode || "US";

	}

	handleAlbum(tab, dat) {

		dat = this.parseAlbum(dat);

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

		this.mediaHint();

		this.syncPopup();

	}

	handleLabel(tab, dat) {

	}

	handlePlaylist(tab, dat) {

		const cur = this.medias.get(tab.id) || {};

		dat = deep(
			(cur.extype === "playlist" ? cur : {
				items: [],
				tracks: []
			}),
			{
				...dat,
				extype: "playlist"
			}
		);

		const newTracks = (dat.items || []).map(item =>
			item.item);

		for(const newTrack of newTracks)
			if(!dat.tracks.find(hasTrack =>
				hasTrack.id === newTrack.id))
				dat.tracks.push(newTrack);

		delete dat.items;

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

	parseAlbum(dat) {

		console.log(dat);

		const modules = dat.rows.map(row =>
			row.modules?.[0]);

		const albumInfos = modules.find(module =>
			module.type === "ALBUM_HEADER")?.album;

		const albumTracks = modules.find(module =>
			module.type === "ALBUM_ITEMS")?.pagedList?.items.filter(item =>
			item.type === "track")
		.map(track =>
			track.item);

		return {
			...albumInfos,
			tracks: albumTracks,
			extype: "album"
		};

	}

	async getRelease(releaseId) {

		if(DEBUG)
			console.log(
				"get release data",
				releaseId
			);

		const releaseData = this.parseAlbum(await this.request(
			"pages/album",
			{
				albumId: releaseId,
				countryCode: this.dat.countryCode,
				locale: navigator.language,
				deviceType: "BROWSER"
			}
		));

		//console.log(releaseData);

		return releaseData;

	}
	
	trackList(media) {

		return (media?.tracks || [])
		.filter(track =>
			track.allowStreaming);
	
	}

	playlistInfos(list) {

		return {
			listName: list.title,
			tracks: list.numberOfTracks
		};
		
	}

	getTrackInfos(track) {

		return {
			title: this.trackTitle(track),
			//album: this.albumTitle(album),
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
				countryCode: this.dat.countryCode // was "US"
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

	getCoverUrl(media) {
		
		const coverSize = this.opt.coverSize;

		return `https://resources.tidal.com/images/${(media?.album?.cover || media?.cover).replaceAll(
			"-",
			"/"
		)}/${coverSize}x${coverSize}.jpg`;

	}

	getFilePath(track, album, rules) {

		const theArtist = track.artists || album.artists;
		const variousArtists = theArtist.length === 1
		&& theArtist[0].name.toLowerCase() === "various artists";

		const artistName = (variousArtists ? "Various Artists" : theArtist[0]?.name).replaceAll(
			"/",
			"-"
		); // Hells Bells

		const albumTitle = this.albumTitle(album);

		const albumYear = new Date(album.releaseDate || 0)
		.getFullYear();

		const trackNum = String(track.trackNumber || 1)
		.padStart(
			2,
			"0"
		);

		let filePath = this.sanitize(`${artistName}/${albumTitle} (${albumYear})/${trackNum}. ${variousArtists ? track.artists[0]?.name + " - " : ""}${this.trackTitle(track)}`);
		
		if(rules && rules.list) {

			const trackIndex = rules.indx.toString()
			.padStart(
				rules.tracks.toString().length,
				"0"
			);

			filePath = this.sanitize(`${rules.listName}/${trackIndex}. ${artistName} - ${this.trackTitle(track)}`);

		}

		//const fileExt = ".m4a";
		const fileExt = ".flac";

		return `Tidal/${filePath}${fileExt}`;

	}

	getMetaData(track, album) {

		const theArtist = track.artists || album.artists;

		return {

			"TITLE": this.trackTitle(track),
			...(track.version ? {
				"VERSION": track.version
			} : {}),

			"ARTIST": theArtist[0]?.name || "Unknown",
			
			"ALBUM": this.albumTitle(album),
			"ALBUMARTIST": theArtist[0]?.name || "Unknown",

			...(album.copyright ? {
				"COPYRIGHT": album.copyright
			} : {}),

			...(album?.releaseDate ? {
				"DATE": new Date(album.releaseDate)
				.getFullYear(),
				"ORIGINALDATE": album.releaseDate
			} : {}),

			"TRACKNUMBER": String(track.trackNumber || 1),
			"TOTALTRACKS": String(album?.numberOfTracks || 1),
		
			// ISRC (enable Settings > Display > Audio metadata)
			...(track.isrc ? {
				"ISRC": track.isrc
			} : {}),

			// UPC

			...(track.url ? {
				"URL": track.url
			} : {}),

			...(track.replayGain && {
				"REPLAYGAIN_TRACK_GAIN": track.replayGain + " dB"
			})

		};
	
	}

}

new TidalBackground();