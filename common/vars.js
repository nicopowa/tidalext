const browse = chrome || browser;
const action = browse.browserAction || browse.action;
const DEBUG = true;

const Type = {
	VOID: "void",
	ALBUM: "album",
	RELEASE: "release",
	ARTIST: "artist",
	LABEL: "label",
	LIST: "playlist"
};

export {
	browse,
	action,
	DEBUG,
	Type
};
