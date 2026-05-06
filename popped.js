import {DEBUG} from "./common/vars.js";
import {Util} from "./common/util.js";

const Root = "https://tidal.com";

const Cfgx = {};

const Optx = {
	"quality": {
		vals: ["LOSSLESS", "HIRES", "HIRES_LOSSLESS"]
	},
	"art_size": {
		disp: ["160", "320", "640", "1280"],
		vals: [160, 320, 640, 1280], // 80
		defs: 2
	},
	"segments": {
		desc: "segments",
		disp: ["x1", "x2", "x3"],
		vals: [1, 2, 3],
		defs: 0
	},
	"dolby_atmos": {
		desc: "dolby atmos",
		disp: ["yes", "no"],
		vals: [1, 0],
		defs: 1,
		hide: true
	}
};

const Datx = {
	token: "token",
	country: "country",
	segments: "segments",
	atmos: "dolby_atmos"
};

const Types = {
	VOID: "void",
	COUNTRY: "country",
	USER: "user",
	HOME: "home",
	TRACK: "track",
	ALBUM: "album",
	ARTIST: "artist",
	LABEL: "label",
	PLAYLIST: "playlist",
	MIX: "mix",
	GENRE: "genre",
	FAV_ALBUMS: "fav_albums",
	FAV_TRACKS: "fav_tracks",
	FAV_PLAYLISTS: "fav_playlists",
	ATMOS: "atmos"
};

const Typex = [
	Types.COUNTRY,
	Types.USER,
	Types.ATMOS
];

class Help {

	static getModules(dat) {

		return dat.rows.map(row =>
			row.modules?.[0]);
	
	}

	static findModule(mods, nnm) {

		return mods.find(mod =>
			mod.type === nnm);
	
	}

	static filterModules(mods, nnm) {

		return mods.filter(mod =>
			mod.type === nnm);
	
	}

	static parseAlbum(dat) {

		const mods = Help.getModules(dat);

		return {
			...Help.findModule(
				mods,
				"ALBUM_HEADER"
			)?.album,
			lst: Util.typed(
				Help.findModule(
					mods,
					"ALBUM_ITEMS"
				)?.pagedList?.items
				.filter(item =>
					item.type === "track")
				.map(track =>
					track.item),
				Types.TRACK
			)
		};

	}

	static cover(itm, siz = 160) {

		const imgSrc = itm.extype === Types.PLAYLIST ? itm.squareImage : itm?.cover || itm?.album?.cover;

		return `https://resources.tidal.com/images/${imgSrc.replaceAll(
			"-",
			"/"
		)}/${siz}x${siz}.jpg`;
	
	}

	static copyleft(str = "") {

		return str.split(",")[0].replace(
			/(?:\(c\))?©?\s?\d{4}\s/gi,
			""
		)
		.replace(
			/under.+$/gi,
			""
		)
		.replace(
			/all rights.+$/gi,
			""
		)
		.trim();
	
	}

}

const Jacks = {
	[Types.COUNTRY]: {
		nnm: "country",
		hit: "/v1/country"
	},
	[Types.HOME]: {
		nnm: "home",
		hit: "/v2/home/feed/static"
	},
	[Types.ALBUM]: {
		nnm: "album",
		hit: "/v1/pages/album"
	},
	[Types.ARTIST]: {
		nnm: "artist",
		hit: "/v2/artist/"
	},
	[Types.PLAYLIST]: {
		nnm: "playlist",
		hit: "/v1/playlists/"
	},
	/*
		PLAYLISTS OR LABEL ?
		"/v1/pages/single-module-page"
		"/v1/pages"

		[Types.PLAYLISTS]: {nnm: "playlists", hit: ""},
	*/
	[Types.MIX]: {
		nnm: "mix",
		hit: "/v1/pages/mix"
	},
	[Types.GENRE]: {
		nnm: "genre",
		hit: "/v1/pages/genre_\\w+"
	},
	[Types.USER]: {
		nnm: "user",
		hit: "/v1/users/\\d+/subscription"
	},
	[Types.FAV_TRACKS]: {
		nnm: "fav tracks",
		hit: "/v1/users/\\d+/favorites/tracks"
	},
	[Types.FAV_ALBUMS]: {
		nnm: "fav albums",
		hit: "/v1/users/\\d+/favorites/albums"
	},
	[Types.FAV_PLAYLISTS]: {
		nnm: "fav playlists",
		hit: "/v2/my-collection/playlists/folders\\?folderId=root"
	}
	/*

	NEVER REQUESTED
	/v1/users/\\d+/favorites/playlists

	USER PLAYLISTS FLATTENED
	/v2/my-collection/playlists/folders/flattened

	USER PLAYLISTS FOLDER
	/v2/my-collection/playlists/folders

	USER FAVORITES ALL TYPES IDS ONLY
	/v1/users/\\d+/favorites/ids

	*/
};

const Parse = {
	[Types.USER]: (dat, cur, bck) => {

		bck.store.user = {
			yes: dat.premiumAccess,
			typ: dat.subscription.type,
			end: new Date(dat.validUntil)
			.getTime(),
			cnc: dat.status === "STOPPED",
			extype: Types.USER
		};

		return {
			extype: Types.USER
		};

	},
	[Types.COUNTRY]: (dat, cur, bck) => {

		bck.store.country = dat.countryCode;

		return {
			extype: Types.COUNTRY
		};
	
	},
	[Types.HOME]: (dat, cur, bck) => {

		const modules = Object.entries({
			[Types.TRACK]: ["NEW_TRACK_SUGGESTIONS"],
			[Types.ALBUM]: ["NEW_ALBUM_SUGGESTIONS", "ALBUM_RECOMMENDATIONS"]
			//[Types.MIX]: ["DAILY_MIXES"]
			//SUGGESTED_RADIOS_MIXES
		});

		const parsed = dat.items
		.map(
			item => {

				const keep = modules.find(([typ, ids]) =>
					ids.includes(item.moduleId));

				if(keep)
					return Util.typed(
						item.items.map(itm =>
							itm.data),
						keep[0]
					);

				return null;
			
			}
		)
		.filter(Boolean)
		.flat();

		return {
			lst: parsed,
			extype: Types.HOME
		};
	
	},
	
	[Types.TRACK]: dat => {

		return dat;

	},
	[Types.ALBUM]: dat => {

		return {
			...Help.parseAlbum(dat),
			extype: Types.ALBUM
		};

	},
	[Types.ARTIST]: (dat, cur) => {

		if(dat.type === "ARTIST") {

			return {
				...dat.header,
				...dat?.item?.data,
				// 
				lst: Util.typed(
					dat.items.filter(releaseSection =>
						["ARTIST_ALBUMS", "ARTIST_TOP_SINGLES", "ARTIST_LIVE_ALBUMS"]
						.includes(releaseSection.moduleId || releaseSection.type))
					.flatMap(releaseSection =>
						releaseSection.data || releaseSection.items.map(sectionItem =>
							sectionItem.data)),
					Types.ALBUM
				),
				extype: Types.ARTIST
			};
		
		}

		const lst = Util.typed(
			dat.items.map(itm =>
				itm.data),
			Types.ALBUM
		);
		
		if(cur.extype === Types.ARTIST) {

			if(DEBUG)
				console.log("ARTNXT");

			return {
				...cur,
				lst: [
					...cur.lst,
					...lst.filter(releasing =>
						!cur.lst.some(release =>
							release.id === releasing.id))
				]
			};
		
		}
		else {

			if(DEBUG)
				console.log("find artist");

			const {
				who
			} = lst.flatMap(release =>
				release.artists)
			.reduce(
				(acc, art) => {

					const cnt = (acc.cnt[art.id] || 0) + 1;

					acc.cnt[art.id] = cnt;
			
					if(cnt > acc.mxc) {

						acc.mxc = cnt;
						acc.who = art;
				
					}
			
					return acc;
			
				},
				{
					cnt: {}, mxc: 0, who: null
				}
			);

			return {
				...who,
				lst: lst,
				extype: Types.ARTIST
			};
		
		}

	},
	[Types.PLAYLIST]: (dat, cur) => {

		if(dat.items) {

			dat.lst = Util.typed(
				dat.items.map(item =>
					item.item),
				Types.TRACK
			);

			//delete dat.items;
		
		}
		else
			dat.lst = [];

		if(cur.extype === Types.PLAYLIST && ((cur.uuid && !dat.uuid) || (!cur.uuid && dat.uuid))) {

			dat = Util.deep(
				cur,
				dat
			);
			
		}

		return {
			id: dat.uuid || cur.uuid,
			...dat,
			count: dat.numberOfTracks,
			extype: Types.PLAYLIST
		};

	},
	[Types.MIX]: dat => {

		const mods = Help.getModules(dat);

		const list = Help.findModule(
			mods,
			"TRACK_LIST"
		)?.pagedList;

		return {
			// mix infos
			...Help.findModule(
				mods,
				"MIX_HEADER"
			)?.mix,
			// tracks
			lst: Util.typed(
				list?.items,
				Types.TRACK
			),
			count: list.numberOfTracks, // totalNumberOfItems ?
			extype: Types.MIX
		};

	},
	[Types.GENRE]: dat => {

		const modTypes = Object.entries({
			[Types.TRACK]: "TRACK_LIST",
			[Types.ALBUM]: "ALBUM_LIST",
			[Types.PLAYLIST]: "PLAYLIST_LIST"
		});

		const mods = Help.getModules(dat);

		const modKeep = modTypes.flatMap(
			([typ, modType]) =>
				Util.typed(
					Help.filterModules(
						mods,
						modType
					)
					.flatMap(mod =>
						mod.pagedList?.items),
					typ
				)
		);

		return {
			lst: modKeep,
			extype: Types.GENRE
		};

	},
	// same
	[Types.FAV_TRACKS]: (dat, cur) => {

		const doom = cur.extype === Types.FAV_TRACKS;

		return {
			...(doom ? cur : dat),
			lst: Util.typed(
				[...(doom ? cur.lst : []), ...dat.items.map(itm =>
					itm.item)],
				Types.TRACK
			),
			count: dat.totalNumberOfItems,
			extype: Types.FAV_TRACKS
		};

	},
	// same
	[Types.FAV_ALBUMS]: (dat, cur) => {

		const doom = cur.extype === Types.FAV_ALBUMS;

		return {
			...(doom ? cur : dat),
			lst: Util.typed(
				[...(doom ? cur.lst : []), ...dat.items.map(itm =>
					itm.item)],
				Types.ALBUM
			),
			count: dat.totalNumberOfItems,
			extype: Types.FAV_ALBUMS
		};

	},
	// same
	[Types.FAV_PLAYLISTS]: (dat, cur) => {

		const doom = cur.extype === Types.FAV_PLAYLISTS;

		return {
			...(doom ? cur : dat),
			lst: Util.typed(
				[...(doom ? cur.lst : []), ...dat.items.map(itm =>
					itm.data)],
				Types.PLAYLIST
			),
			//count: dat.totalNumberOfItems,
			extype: Types.FAV_PLAYLISTS
		};
	
	}
};

const canStream = media =>
	media.mediaMetadata.tags.length
	&& media.audioQuality === "LOSSLESS"
	//&& media.audioModes.includes("STEREO")
	&& media.allowStreaming
	&& media.streamReady;

const hiVibes = media =>
	media.mediaMetadata.tags.at(-1)
	?.replaceAll(
		"_",
		" "
	)
	.toLowerCase() ?? "mp3"; // "low"

const Heads = {
	[Types.HOME]: dat => {

		return [
			"Homepage",
			"Coming",
			"Soon",
			false
		];
		
	},
	[Types.ALBUM]: dat => {

		return [
			`${dat.title}${dat.version ? ` (${dat.version})` : ""}`,
			[
				dat.artists[0].name,
				new Date(dat.releaseDate)
				.getFullYear(),
				Help.copyleft(dat.copyright)
			],
			[
				dat.type.toLowerCase(),
				Util.counts(
					dat.numberOfTracks,
					"track"
				),
				Util.times(dat.lst),
				hiVibes(dat)
			],
			canStream(dat)
		];
	
	},
	[Types.ARTIST]: dat => {

		return [
			`${dat.name}`,
			[
				Util.counts(
					dat.lst.length,
					"release"
				),
				Util.counting(
					dat.lst,
					"numberOfTracks",
					"track"
				),
				Util.times(dat.lst)
			],
			Util.doom(false),
			true
		];
		
	},
	[Types.LABEL]: dat => {

		return [

		];
		
	},
	[Types.PLAYLIST]: dat => {

		const len = dat.lst.length;
		const cnt = dat.numberOfTracks;

		return [
			`${dat.title}`,
			[
				Util.counts(
					len,
					"track",
					cnt
				),
				...(len ? [Util.times(dat.lst)] : [])
			],
			Util.doom(len < cnt),
			true
		];
		
	},
	[Types.MIX]: dat => {

		const len = dat.lst.length;
		const cnt = dat.count;

		return [
			
			[
				"Mix", dat.title
			],
			[
				Util.counts(
					len,
					"track",
					cnt
				),
				Util.times(dat.lst)
			],
			Util.doom(len < cnt),
			true
		];
		
	},
	[Types.GENRE]: dat => {

		const tracks = dat.lst.filter(itm =>
			itm.extype === Types.TRACK);
		const albums = dat.lst.filter(itm =>
			itm.extype === Types.ALBUM);
		const playlists = dat.lst.filter(itm =>
			itm.extype === Types.PLAYLIST);

		return [
			"Genre",
			[
				Util.counts(
					tracks.length,
					"track"
				),
				Util.counts(
					albums.length,
					"album"
				),
				Util.counts(
					playlists.length,
					"playlist"
				)
			],
			[
				Util.counts(
					tracks.length
						+ Util.sumup(
							albums,
							"numberOfTracks"
						)
						+ Util.sumup(
							playlists,
							"numberOfTracks"
						),
					"track"
				),
				Util.times(dat.lst)
			],
			false
		];
		
	},
	// same
	[Types.FAV_ALBUMS]: dat => {

		const len = dat.lst.length;
		const cnt = dat.count;

		return [
			
			[
				"Collection • Albums"
			],
			[
				Util.counts(
					len,
					"album",
					cnt
				),
				Util.counting(
					dat.lst,
					"numberOfTracks",
					"track"
				),
				Util.times(dat.lst)
			],
			Util.doom(len < cnt),
			true
		];
		
	},
	// same
	[Types.FAV_TRACKS]: dat => {

		const len = dat.lst.length;
		const cnt = dat.count;

		return [
			
			[
				"Collection • Tracks"
			],
			[
				Util.counts(
					len,
					"track",
					cnt
				),
				Util.times(dat.lst)
			],
			Util.doom(len < cnt),
			true
		];
		
	},
	// same
	[Types.FAV_PLAYLISTS]: dat =>
		[
			
			[
				"Collection • Playlists"
			],
			[
				Util.counts(
					dat.lst.length,
					"playlist"
				),
				Util.times(dat.lst)
			],
			Util.doom(false),
			false
		]

};

const Items = {
	[Types.TRACK]: (dat, idx, par) =>
		[
			dat,
			`${dat.title}${dat.version ? ` (${dat.version})` : ""}`,
			dat.artists.map(artist =>
				artist.name),
			Util.timed(dat.duration),
			canStream(dat),
			[Types.ALBUM, Types.PLAYLIST].includes(par.extype) ? idx : -1
		],
	[Types.ALBUM]: dat =>
		[
			dat,
			`${dat.title}${dat.version ? ` (${dat.version})` : ""}`,
			[
				dat.artists[0].name,
				new Date(dat.releaseDate)
				.getFullYear(),
				Help.copyleft(dat.copyright)
			],
			[
				(dat.type || dat.extype).toLowerCase(),
				Util.counts(
					dat.numberOfTracks,
					"track"
				),
				Util.timed(dat.duration),
				hiVibes(dat)
				// genre ?
			],
			canStream(dat),
			-1
		],
	[Types.PLAYLIST]: dat =>
		[
			dat,
			dat.title,
			dat.promotedArtists.map(artist =>
				artist.name),
			[
				Util.counts(
					dat.numberOfTracks,
					"track"
				),
				Util.timed(dat.duration)
			],
			false,
			-1
		],
	[Types.MIX]: dat =>
		[
			dat,
			dat.title,
			dat.artists.map(artist =>
				artist.artistName),
			[
				Util.counts(
					dat.numberOfTracks,
					"track"
				),
				Util.timed(dat.duration)
			],
			false,
			-1
		]
};

const Urls = {
	[Types.ALBUM]: "/album/{id}",
	[Types.PLAYLIST]: "/playlist/{id}"
};

export {
	Root,
	Cfgx,
	Optx,
	Datx,
	Types,
	Typex,
	Help,
	Jacks,
	Parse,
	Heads,
	Items,
	Urls
};