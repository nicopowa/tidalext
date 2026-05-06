const browse = chrome || browser;
const action = browse.action || browse.browserAction;

/**
 * @define {boolean}
 */
const DEV = true;

/**
 * @define {boolean}
 */
const DEBUG = true;

const Msg = {
	PROCESS: 0,
	COMPLETE: 1,
	PROGRESS: 2,
	POPUP: 3,
	LINK: 4,
	FETCH: 5,
	DOWNLOAD: 6,
	CLEAR: 7,
	SYNC: 8,
	QUEUE: 9,
	SAVE: 10,
	STORE: 11,
	TOGGLE: 12,
	CANCEL: 13,
	CLICKED: 14,
	STATE: 15,
	ERROR: 16
};

const Cfgs = {
	stores: false
};

const Opts = {
	"quality": {
		desc: "max quality",
		disp: ["16/44", "24/<96", "24/96+"],
		defs: 0
	},
	"parallel": {
		desc: "parallel",
		disp: ["no", "x2", "x3"],
		vals: [1, 2, 3],
		defs: 0,
		hide: false
	},
	"delays": {
		desc: "time delay",
		disp: ["short", "default", "long"],
		vals: [345, 1234, 3456],
		defs: 1
	},
	"artwork": {
		desc: "artwork file",
		disp: ["yes", "no"],
		vals: [1, 0],
		defs: 1
	},
	"art_size": {
		desc: "artwork size"
	},
	"pics": {
		desc: "show images",
		disp: ["yes", "no"],
		vals: [1, 0],
		defs: 1
	},
	"icon": {
		desc: "icon progress",
		disp: ["yes", "no"],
		vals: [1, 0],
		defs: 1
	},
	"m3u8": {
		desc: "m3u8 file",
		disp: ["yes", "no"],
		vals: [1, 0],
		defs: 1,
		hide: true
	},
	"brainz": {
		desc: "<a href=\"https://musicbrainz.org/\" target=\"_blank\">MusicBrainz</a>",
		disp: ["yes", "no"],
		vals: [1, 0],
		defs: 1,
		hide: true
	}
};

const Dats = {
	user: "user",
	quality: "quality",
	parallel: "parallel",
	delays: "delays",
	artwork: "artwork",
	art_size: "art_size",
	pics: "pics",
	icon: "icon",
	brainz: "brainz",
	lastup: "lastup"
};

const Stat = {
	WAIT: "wait",
	LOAD: "load",
	DONE: "done",
	FAIL: "fail"
};

export {
	browse,
	action,
	DEV,
	DEBUG,
	Msg,
	Cfgs,
	Opts,
	Dats,
	Stat
};
