import {DEBUG} from "./common/vars.js";
import {Backstage} from "./common/back.js";
import {Util} from "./common/util.js";
import {Help} from "./popped.js";
//import {AtmosSession} from "./atmos.session.js";

class ExtBck extends Backstage {

	constructor() {

		super();

		this.apiBase = this.urlBase.slice(
			0,
			-1
		);

		this.dat = {};

		//this.atmos = new AtmosSession();
		this.atmos = null;

		this.heads("https://login.tidal.com/oauth2/*");
	
	}

	/**
	 * @override
	 */
	preqsup(evt) {

		super.preqsup(evt);

	}

	/**
	 * @override
	 */
	headsup(evt) {

		const userToken = Util.headerValue(
			evt.requestHeaders,
			"authorization"
		);

		if(userToken) {

			if(userToken !== this.store.token) {

				if(DEBUG)
					console.log("auth data");

				this.store.token = userToken;

				this.ready();
			
			}

		}

	}

	async request(endpoint, params = {}, headsup = {}, tokened = false) {

		params = {
			...params,
			"countryCode": this.store.country,
			"locale": navigator.language,
			"deviceType": "BROWSER" // "BROWSER", "TV"
		};

		const query = Object.keys(params).length ? "?" + new URLSearchParams(params) : "";
		
		const res = await fetch(
			`${this.apiBase}${endpoint}${query}`,
			{
				headers: {
					"Content-Type": "application/json",
					...(tokened ? {
						"X-Tidal-Token": "zU4XHVVkc2tDPo4t"
					} : {}),
					"Authorization": this.store.token,
					...headsup
				}
			}
		);

		if(!res.ok)
			throw `http ${res.status}: ${await res.text()
			.catch(() =>
				res.statusText)}`;
		
		const dat = await res.json();

		return dat;
	
	}

	/**
	 * @override
	 */
	async getRelease(releaseId) {

		const releaseData = Help.parseAlbum(await this.request(
			"/v1/pages/album",
			{
				"albumId": releaseId
			}
		));

		const releaseInfo = await this.request(`/v1/albums/${releaseId}`);

		const releaseFull = {
			...releaseData,
			...releaseInfo
		};

		return releaseFull;

	}
	
	/**
	 * @override
	 * @return {Array<TidalTrack>}
	 */
	trackList(media) {

		return (media?.lst || [])
		.filter(track =>
			track.allowStreaming);
	
	}

	/**
	 * @override
	 */
	trackRules(track) {

		return {
			atmos: this.store.atmos && track.mediaMetadata?.tags?.includes("DOLBY_ATMOS")
		};
	
	}

	/**
	 * @override
	 */
	listRules(media) {

		return {
			title: media.title,
			count: media.count
		};
		
	}
	
	/**
	 * @override
	 */
	getTrackInfos(track) {

		return {
			title: this.trackTitle(track),
			//album: this.albumTitle(album),
			artist: track.artists[0].name
		};
	
	}

	/**
	 * @override
	 */
	async getTrackUrl(task) {
		
		const trid = task.track.id;
		
		const qual = task.quality
		.replace( // o_0 ?
			"HIRES",
			"HI_RES"
		);

		const heads = this.atmos ? task.rules.atmos ? await this.atmos.ensure() : {} : {};

		const trackManifest = await this.request(
			`/v1/tracks/${trid}/playbackinfopostpaywall`,
			{
				"playbackmode": "STREAM",
				"assetpresentation": "FULL",
				"audioquality": qual
			},
			heads,
			true
		);

		const manifestText = atob(trackManifest.manifest);

		// if(DEBUG) console.log(manifestText);

		return {
			man: manifestText
		};
	
	}

	/**
	 * @override
	 */
	getFilePath(track, album, rules) {

		const theArtist = track.artists || album.artists;
		const variousArtists = theArtist.length === 1
		&& theArtist[0].name.toLowerCase() === "various artists";

		const artistName = this.sanitize(variousArtists ? "Various Artists" : theArtist[0]?.name);

		const albumTitle = this.sanitize(this.albumTitle(album));

		const albumYear = new Date(album.releaseDate || 0)
		.getFullYear();

		const albumPart = album.numberOfVolumes > 1 && track.volumeNumber || 0; // media_count

		const trackNum = String(track.trackNumber || 1)
		.padStart(
			2,
			"0"
		);

		const trackTitle = this.sanitize(`${variousArtists ? track.artists[0]?.name + " - " : ""}${this.trackTitle(track)}`);

		let filePath = `${artistName}/${albumTitle} (${albumYear})/${albumPart ? `CD${albumPart}/` : ""}${trackNum}. ${trackTitle}`;
		
		if(rules.list) {

			const listName = this.sanitize(rules.title);

			const trackIndex = rules.indx ? rules.indx.toString()
			.padStart(
				rules.count.toString().length,
				"0"
			) + ". ": "";

			filePath = `${listName}/${trackIndex}${artistName} - ${trackTitle}`;

		}

		return `Tidal/${filePath}.flac`;

	}

	/**
	 * @override
	 */
	getMetaData(track, album, brain = {}) {

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
		
			// enable Settings > Display > Audio metadata
			...(track.isrc ? {
				"ISRC": track.isrc
			} : {}),

			...(album.upc ? {
				"UPC": album.upc
			} : {}),

			...(track.url ? {
				"URL": track.url
			} : {}),

			...(track.replayGain && {
				"REPLAYGAIN_TRACK_GAIN": track.replayGain + " dB"
			})

		};
	
	}

}

export {
	ExtBck
};