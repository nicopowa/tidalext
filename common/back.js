import {browse, action, DEV, DEBUG, Msg, Cfgs, Opts, Dats, Stat} from "./vars.js";
import {Core} from "./core.js";
//import {Disk} from "./disk.js";
import {Offscreen} from "./out.js";
import {Util} from "./util.js";
import {Root, Cfgx, Optx, Datx, Types, Typex, Jacks, Parse, Help, Urls} from "../popped.js";

class Backstage extends Core {

	constructor() {

		super();

		this.apiBase = "";

		if(DEBUG)
			console.log(
				Util.manifest.name,
				Util.manifest.version
			);

		[
			//[browse.runtime.onStartup, this.started],
			//[browse.runtime.onInstalled, this.installed],
			//[browse.runtime.onSuspend, this.suspended],
			[browse.runtime.onConnect, this.connected],
			[browse.downloads.onChanged, this.downloaded],
			...(DEBUG ? [[browse.commands.onCommand, this.commanded]] : []),
			//[browse.tabs.onUpdated, this.onTabUpdate],
			[browse.tabs.onRemoved, this.onTabRemove]
		].forEach(([ext, cbk]) =>
			ext.addListener(cbk.bind(this)));

		this.medias = new Map();
		this.icon = new Icn();

		// update available
		this.nxt = false;

		this.off = new Offscreen();

		this.queue = new Queue(this);

		this.urlBase = Util.manifest.content_scripts[0].matches[0].slice(
			0,
			-1
		);

		this.urlHost = Util.manifest.host_permissions[0];
		
	}

	started() {

		if(DEBUG)
			console.log("started");

	}

	installed() {

		if(DEBUG)
			console.log("installed");

	}

	suspended() {

		if(DEBUG)
			console.log("suspended");
	
	}

	commanded(cmd) {

		if(cmd === "reload")
			browse.runtime.reload();
	
	}

	/**
	 * @override
	 */
	async liftoff() {

		await super.liftoff();

		await this.storeCheck();

		this.updateCheck();

		await this.off.ensure((DEV ? "common/" : "") + "off.html");
		
		if(DEBUG)
			console.log("lift off");

		Object.entries(Jacks)
		.forEach(([hi, jack]) =>
			(jack.typ = hi));

		this.preqs(...Object.values(Jacks)
		.map(jack =>
			this.apiBase + jack.hit + "*"));

		// this.icon.back("#ff8c00");
	
	}

	async storeCheck() {

		if(DEBUG)
			console.log("init storage");

		const dats = {
			...Dats,
			...Datx
		};

		const opts = Util.deep(
			Opts,
			Optx
		);

		Object.entries(dats)
		.forEach(([key, val]) => {

			if(typeof this.store[key] === "undefined") {

				if(DEBUG)
					console.log(
						"default",
						val
					);

				if(opts[val]) {

					const cfg = opts[val];

					this.store[key] = cfg.vals[cfg.defs];

				}
				else {

					this.store[key] = "";
				
				}

			}

		});
	
	}

	updateCheck() {

		const now = Date.now();
		const lst = this.store.lastup;

		if(now - lst < 86400 * 1000) {

			if(DEBUG)
				console.log("update later");

			return;

		}

		if(DEBUG)
			console.log("update check");

		const manurl = Util.manifest.homepage_url.replace(
			"github",
			"raw.githubusercontent"
		) + "/refs/heads/main/manifest.json"
		+ "?t=" + now; // useless ?

		fetch(manurl)
		.then(res =>
			res.json())
		.then(man => {

			if(+man.version > +Util.manifest.version) {

				if(DEBUG)
					console.log("update available");

				this.nxt = true;
			
			}
			else if(DEBUG) {

				console.log("up to date");
			
			}

			this.store.lastup = now;
		
		})
		.catch(err => {
			
			/*console.error(
				"update error",
				err
			);*/
			
			this.handleError({
				error: err
			});
		
		});

	}

	preqs(...matches) {

		browse.webRequest.onBeforeRequest.addListener(
			this.preqsup.bind(this),
			{
				urls: matches,
				types: ["xmlhttprequest"]
			},
			[
				"requestBody"
			]
		);
	
	}

	preqsup(evt) {

		//console.log(evt);

		const jack = Object.values(Jacks)
		.find(jack =>
			new RegExp(jack.hit)
			.test(evt.url));

		if(jack) {

			if(DEBUG)
				console.log(
					"req",
					jack.nnm
				);

			this.icon.reset();
		
		}

	}

	heads(...matches) {

		browse.webRequest.onBeforeSendHeaders.addListener(
			this.headsup.bind(this),
			{
				urls: matches,
				types: ["xmlhttprequest"]
			},
			["requestHeaders"]
		);
	
	}

	headsup(evt) {

		// from child classes
	
	}

	send(typ, dat) {

		//if(DEBUG) console.log("back >>", type, data);

		browse.runtime.sendMessage({
			type: typ,
			...dat
		});
	
	}

	async ready() {

		if(DEBUG)
			console.log("ready");
	
	}

	connected(port) {

		if(DEBUG)
			console.log(
				"connect",
				port.sender.tab.id
			);

		port.postMessage({
			"confs": {
				...Cfgs,
				...Cfgx
			},
			"jacks": Object.values(Jacks)
			.map(jack =>
				({
					"typ": jack.typ,
					"hit": jack.hit
				}))
		});
	
	}

	/**
	 * @override
	 */
	handleMessage(msg, src) {

		// if(DEBUG) console.log(msg);

		// simple object + binds and whatMessage[msg.type].bind(this)(msg); // ?

		switch(msg.type) {

			case Msg.PROGRESS:
				this.handleProgress(msg);
				break;

			case Msg.COMPLETE:
				this.queue.handleStreamComplete(msg);
				break;

			case Msg.FETCH:
				this.handleFetch(
					msg,
					src.tab
				);
				break;

			case Msg.POPUP:
				this.syncPopup();
				break;

			case Msg.LINK:
				this.handleLink(msg);
				break;

			case Msg.DOWNLOAD:
				this.handleDownload(msg);
				break;

			case Msg.TOGGLE:
				this.queue.paused = !this.queue.paused;

				if(!this.queue.paused)
					this.queue.process();

				this.syncPopup();
				break;

			case Msg.CANCEL:
				this.queue.removeItem(msg.id);
				break;

			case Msg.CLICKED:
				this.handleClick(msg);
				break;

			case Msg.STORE:
				this.handleStore(msg);
				break;

			case Msg.STATE:
				this.handleState(msg);
				break;

			case Msg.ERROR:
				this.handleError(msg);
				break;
		
		}
	
	}

	/*onTabUpdate(tabId, info, tab) {

		if(!tab.url) // blank
			return;

		//console.log("up", tab, info?.status, info);

		if(info?.url)
			this.onTabNavigate(
				tab,
				info
			);
		else if(info?.status === "loading")
			this.onTabLoading(
				tab,
				info
			);
		else if(info?.status === "complete")
			this.onTabComplete(
				tab,
				info
			);
	
	}

	onTabNavigate(tab, info) {

		if(DEBUG)
			console.log(
				tab.id,
				"navigate",
				info.url
			);
	
	}

	onTabLoading(tab, info) {

		if(DEBUG)
			console.log(
				tab.id,
				"loading"
			);

		// injected code parses before tab update event
		//this.icon.reset();
	
	}

	onTabComplete(tab, info) {

		if(DEBUG)
			console.log(
				tab.id,
				"complete"
			);

	}*/

	onTabRemove(tabId, info) {

		if(this.medias.has(tabId)) {

			if(DEBUG)
				console.log(
					tabId,
					"removed"
				);

			this.medias.delete(tabId);
		
		}
	
	}

	async popped() {

		return !!(
			await browse.runtime.getContexts({
				contextTypes: ["POPUP"]
			})
		).length;
	
	}

	/*async showPopup() {

		await action.openPopup();
	
	}*/

	async syncPopup() {

		if(!(await this.popped()))
			return;

		this.icon.reset();

		const cur = await this.curTab();
		const lst = await this.lastTab();
		const tab = cur || lst;

		this.send(
			Msg.SYNC,
			{
				tabid: tab?.id || 0,

				next: this.nxt,

				actv: tab?.active,
				last: !!lst,

				media: this.medias.get(tab?.id) || null,

				queuePaused: this.queue.paused,

				queue: this.queue.tasks
				.filter(t =>
					t.sts !== Stat.DONE)
				.map(t =>
					({
						id: t.id,
						infos: t.infos,
						progress: t.progress,
						sts: t.sts,
						error: t.error
					}))
			}
		);
	
	}

	newTab(url) {

		return browse.tabs.create({
			url
		});
	
	}

	async curTab() {

		const [cur] = await browse.tabs.query({
			url: [this.urlHost],
			active: true
		});

		return cur;
	
	}

	async lastTab() {

		const [last] = await browse.tabs.query({
			url: [this.urlHost],
			lastFocusedWindow: true,
			windowType: "normal"
		});

		return last;
	
	}

	focusTab(tab) {

		return browse.tabs.update(
			tab.id,
			{
				active: true
			}
		);
	
	}

	reloadTab(tab) {

		return browse.tabs.reload(tab.id);
	
	}

	mediaTab(tab) {

		return this.medias.get(tab.id) || {
			extype: Types.VOID
		};
	
	}

	async handleLink(msg) {

		let tab = null;

		switch(msg.how) {

			case "open":
				tab = await this.newTab(this.urlBase);

				//if(tab) await this.showPopup(); // firefox says no

				break;

			case "swap":
				tab = await this.lastTab();

				if(tab) {

					await this.focusTab(tab);

					await this.reloadTab(tab);

					//await this.showPopup(); // same

				}

				break;

			case "load":
				tab = await this.curTab();

				if(tab)
					await this.reloadTab(tab);

				break;
		
		}
	
	}

	async handleDownload(msg) {

		try {

			const {
				mediaType, mediaId
			} = msg;

			const tab = await this.lastTab();

			if(!tab || !this.medias.has(tab.id)) {

				// ditch tab checking ? got all the data
				return this.handleError({
					error: "tab lost"
				});
			
			}

			const mediaData = this.medias.get(tab.id);

			if(DEBUG)
				console.log(
					"download",
					mediaType,
					mediaId,
					mediaData
				);

			if(mediaType === Types.TRACK) {

				const track = this.trackList(mediaData)
				.find(
					trk =>
						trk.id === +mediaId
				);

				if(track) {

					this.trackDownload(
						track,
						mediaData.extype === Types.ALBUM ? mediaData : null
					);
				
				}
			
			}
			else if(mediaType === Types.ALBUM) {

				this.handleRelease(mediaId);
			
			}
			else if(mediaType === Types.PLAYLIST || mediaType === Types.FAV_TRACKS || mediaType === Types.MIX) {

				this.trackList(mediaData)
				.forEach((track, indx) =>
					this.trackDownload(
						track,
						null,
						null,
						{
							list: true,
							...this.listRules(mediaData),
							indx: indx + 1,
							...(mediaType === Types.FAV_TRACKS ? {
								title: "_TRACKS",
								indx: 0
							} : {})
						}
					));
			
			}
			else if(mediaType === Types.ARTIST || mediaType === Types.FAV_ALBUMS || mediaType === Types.LABEL) {

				// horrible
				// download queue types, getRelease & getCover later 
				for(const rel of mediaData.lst) {

					await this.handleRelease(rel.id);

					await Util.wait(this.store.delays);

				}

			}
			else {

				this.handleError({
					error: "unhandled : " + mediaType
				});
			
			}
		
		}
		catch(err) {

			this.handleError(err);
		
		}
	
	}

	async handleClick(msg) {

		if(DEBUG)
			console.log(
				"clicked",
				msg.mediaType,
				msg.mediaId
			);

		const whereTo = Urls[msg.mediaType]?.replace(
			"{id}",
			msg.mediaId
		);

		if(whereTo) {

			const thisWay = Root + whereTo;

			const tab = await this.curTab();

			if(tab) {

				await browse.tabs.update(
					tab.id,
					{
						url: thisWay
					}
				);
			
			}
			else {

				await this.newTab(thisWay);
			
			}

		}
	
	}

	async handleRelease(releaseId) {

		const datas = await this.getRelease(releaseId);

		const brain = this.store.brainz ? await this.musicBrainz(datas.upc) : {};

		if(DEBUG)
			console.log(brain);

		const coverBlob = await this.getCover(Help.cover(
			datas,
			this.store.art_size
		));

		this.trackList(datas)
		.forEach((track, indx) =>
			this.trackDownload(
				track,
				datas,
				coverBlob,
				{
					art: this.store.artwork && !indx,
					...this.trackRules(track)
				},
				brain?.media?.tracks?.[indx]
			));

	}

	handleStore(msg) {
		//console.log("STORE", msg.data);
	}

	handleState(msg) {

		// popstate

		if(DEBUG)
			console.log(
				"state",
				msg.data
			);

		// invalidate link
		// clear current media
	
	}

	async handleError(msg) {

		const err = msg?.error || msg || "error";

		console.error(err);

		this.icon.text("#ef4444");

		if(!(await this.popped()))
			return;

		this.send(
			Msg.ERROR,
			{
				error: err
			}
		);
	
	}

	handleProgress(msg) {

		const queueItem = this.queue.tasks.find(itm =>
			itm.id === msg.id);

		if(queueItem) {

			const prg = msg.progress;

			queueItem.progress = prg;

			if(this.store.icon) {

				this.icon.prog(
					msg.id,
					prg
				);
			
			}
		
		}
	
	}

	musicBrainz(upc) {

		if(DEBUG)
			console.log(
				"MusicBrainz",
				upc
			);

		if(!upc) {

			return null;
		
		}

		const brainzEndpoint = "https://musicbrainz.org/ws/2/release/";

		return fetch(`${brainzEndpoint}?query=barcode:${upc}&fmt=json`)
		.then(res =>
			res.json())
		.then(res => {

			const ults = res["releases"];

			if(ults.length)
				return fetch(`${brainzEndpoint}${ults.id}?inc=recordings&fmt=json`)
				.then(res =>
					res.json());

			return null;
		
		})
		/*.then(res => {

			return res;
		
		})*/
		.catch(err => {
			
			/*console.error(
				"update error",
				err
			);*/
			
			/*this.handleError({
				error: err
			});*/

			return null;
		
		});
	
	}

	syncQueue(t) {

		this.send(
			Msg.QUEUE,
			{
				id: t.id,
				infos: t.infos,
				progress: t.progress,
				sts: t.sts,
				error: t.error
			}
		);

	}

	mediaHint() {

		//this.icon.temp("#8EAAEF");
		this.icon.back("#557ad9");
	
	}

	/**
	 * @param {Fetched} msg : 
	 */
	handleFetch(msg, tab) {

		//console.log(msg);

		const {
			typ, url, hit, sts, dat
		} = msg;

		try {

			const jack = Jacks[typ];

			if(DEBUG)
				console.log(
					"hit",
					//typ,
					jack.nnm,
					//sts,
					//url, 
					//hit,
					dat
				);

			const jacked = Parse[typ](
				dat,
				this.mediaTab(tab),
				this
			);

			if(!Typex.includes(typ) && jacked) {

				this.medias.set(
					tab.id,
					jacked
				);

				if(DEBUG)
					console.log(
						//tab.url,
						jacked.extype,
						jacked
					);

				this.syncPopup();

				this.mediaHint();

			}
		
		}
		catch(err) {

			console.log("jack error");
			console.log(
				typ,
				url,
				sts,
				hit,
				dat
			);
			throw err;
		
		}
	
	}

	async getRelease(releaseId) {

		// child classes
		return {};
	
	}

	async getCover(coverUrl) {

		//if(DEBUG) console.log("get cover");

		const coverDat = await fetch(coverUrl);
		const coverBlob = await coverDat.blob();
		const coverBuff = await coverBlob.arrayBuffer();

		return {
			data: Array.from(new Uint8Array(coverBuff)),
			type: coverBlob.type
		};
	
	}

	getTrackUrl(task) {

		// child classes
		return Promise.resolve();
	
	}

	getFilePath(track, album, rules) {

		// child classes
		return "";
	
	}

	getMetaData(track, album, brain = {}) {

		// child classes
		return {};
	
	}

	trackDownload(track, album = null, cover = null, rules = {}, brain = {}) {

		this.queue.add({
			id: track.id,
			track: track,
			infos: this.getTrackInfos(track),
			quality: this.store.quality,
			sts: Stat.WAIT,
			progress: 0,
			album: album,
			file: null,
			meta: null,
			cover: cover,
			rules: {
				...rules,
				...this.trackRules(track)
			},
			brain: brain,
			error: null
		});
	
	}

	trackList(media) {

		// child classes
		return [];
	
	}

	trackRules(track) {

		// child classes
		return {};
	
	}

	listRules(media) {

		// child classes
		return {};
	
	}

	getTrackInfos(track) {

		// child classes
		return {};
	
	}

	// same
	trackTitle(track) {

		return `${track.title}${track.version ? ` (${track.version})` : ""}`;
	
	}

	// same
	albumTitle(album) {

		return `${album.title}${album.version ? ` (${album.version})` : ""}`;
	
	}

	sanitize(str) {

		return str
		.replace( // Hells Bells
			/[<>:"/\\|?*]/g,
			"_"
		)
		.replaceAll(
			"...",
			""
		)
		.replace( // Notorious dot
			/\.$/g,
			""
		)
		.replace(
			/\s+/g,
			" "
		)
		.trim();

	}

	async downloaded(delta) {

		if(this.queue.blobs.has(delta.id)) {

			//console.log(delta);

			if(delta?.state?.current === "complete") {

				// if(DEBUG) console.log("downloaded", delta.id);

				const taskId = this.queue.blobs.get(delta.id);

				this.icon.clearProg(taskId);

				this.send(
					Msg.CLEAR,
					{
						id: taskId
					}
				);

				this.queue.blobs.delete(delta.id);
			
			}
		
		}
	
	}

}

class Queue {
 
	/**
	 * @param {!Backstage} main
	 */
	constructor(main) {
 
		this.main = main;
		this.tasks = [];
		this.blobs = new Map();
		this.paused = false;
	
	}
 
	get parallel() {
 
		return Math.max(
			1,
			+this.main.store.parallel || 1
		);
	
	}
 
	get active() {
 
		return this.tasks.filter(t =>
			t.sts === Stat.LOAD).length;
	
	}
 
	add(task) {
 
		if(this.tasks.some(tsk =>
			tsk.id === task.id)) {
 
			// send warning to popup ?
			if(DEBUG)
				console.log("already in queue");
 
			return;
		
		}
 
		this.tasks.push(task);
		this.main.syncQueue(task);
		this.process();
	
	}
 
	process() {
 
		for(let i = this.tasks.length - 1; i >= 0; i--) {
 
			if(this.tasks[i].sts === Stat.DONE)
				this.tasks.splice(
					i,
					1
				);
		
		}

		if(this.paused)
			return;
 
		while(this.active < this.parallel) {
 
			const next = this.tasks.find(t =>
				t.sts === Stat.WAIT);
 
			if(!next)
				break;
 
			next.sts = Stat.LOAD;
			this.main.syncQueue(next);
			this.downloadTask(next);
		
		}
	
	}

	removeItem(id) {

		const idx = this.tasks.findIndex(t =>
			t.id === id);

		if(idx > -1) {

			if(DEBUG)
				console.log(
					"cancel",
					id
				);

			this.tasks.splice(
				idx,
				1
			);

			this.main.icon.clearProg(id);

			this.process();

		}

	}
 
	async downloadTask(task) {
		
		//console.log("task", task);
 
		// no album data from playlist
		if(!task.album) {
 
			try {
 
				task.album = await this.main.getRelease(task.track.album.id);
				// task.brain
			
			}
			catch(err) {
 
				task.sts = Stat.FAIL;
				task.error = err;
 
				this.main.handleError(err);
 
				this.process();
 
				return;
				
			}
		
		}
 
		task.file = this.main.getFilePath(
			task.track,
			task.album,
			task.rules
		);
 
		task.meta = this.main.getMetaData(
			task.track,
			task.album,
			task.brain
		);
 
		if(!task.cover)
			task.cover = await this.main.getCover(Help.cover(
				task.album,
				this.main.store.art_size
			));
 
		const dat = await this.main.getTrackUrl(task);
 
		if(DEBUG)
			console.log(
				"download",
				task,
				dat
			);
 
		this.main.off.post({
			type: Msg.PROCESS,
			id: task.id,
			dat: dat,
			meta: task.meta,
			cover: task.cover,
			rules: task.rules,
			opts: this.main.store.data
		});
	
	}
 
	async handleStreamComplete(msg) {
 
		const task = this.tasks.find(t =>
			t.id === msg.id);
 
		if(!task)
			return;
 
		if(msg.ok) {
 
			//console.log("save", task.file);
 
			if(task.rules.art && this.main.store.artwork && msg.cvr) {
 
				if(DEBUG)
					console.log("artwork jpg");
 
				const pth = task.file;
 
				const nnm = pth.slice(
					0,
					pth.lastIndexOf("/")
				) + "/cover." + task.cover.type.split("/")[1].replace(
					"jpeg",
					"jpg"
				);
 
				await Util.save(
					msg.cvr,
					nnm
				)
				.then(dlId => {
 
					if(DEBUG)
						console.log("artwork saved");
 
				})
				.catch(err => {
			
					this.main.handleError("artwork error : " + err);
 
				});
				
			}
 
			await Util.save(
				msg.url,
				task.file
			)
			.then(downloadId => {
 
				this.blobs.set(
					downloadId,
					task.id
				);
 
				task.sts = Stat.DONE;

				this.main.icon.clearProg(task.id);
 
				this.main.syncQueue(task);
 
			})
			.catch(err => {
 
				task.sts = Stat.FAIL;
				task.error = task.file + "\n" + err;
				this.main.icon.clearProg(task.id);
				this.main.handleError(task.error);
 
			});
		
		}
		else {
 
			// useless ?
			task.sts = Stat.FAIL;
			task.error = msg.error;
			this.main.icon.clearProg(task.id);
			this.main.handleError(task.error);

			// update popup queue item status
			this.main.send(
				Msg.PROGRESS,
				{
					id: task.id,
					sts: Stat.FAIL,
					progress: 0
				}
			);
		
		}
 
		await Util.wait(this.main.store.delays);
				
		this.process();
	
	}
 
}

class Icn {

	constructor() {

		this.textColor = "#FFFFFF";
		this.backColor = "#555555";

		this.letter = Util.manifest.name.slice(
			0,
			1
		)
		.toUpperCase();

		this.siz = 64;

		this.timed = null;

		this.progresses = new Map();
		this.progressHeight = 6;
		this.progressColor = "#62B9FF";

		this.rec = [0, 0, this.siz, this.siz];

		this.icon = new OffscreenCanvas(
			this.siz,
			this.siz
		);

		this.ctx = /** @type {!OffscreenCanvasRenderingContext2D} */(this.icon.getContext(
			"2d",
			{
				alpha: false,
				willReadFrequently: true
			}
		));

		this.ctx.font = Math.round(this.siz * 4 / 5) + "px Segoe UI";
		this.ctx.textAlign = "center";
		this.ctx.textBaseline = "alphabetic";

		const metrics = /** @type {!TextMetrics} */(this.ctx.measureText(this.letter));

		this.x = this.siz / 2;
		this.y = this.siz / 2 + ((metrics.actualBoundingBoxAscent || 0) - (metrics.actualBoundingBoxDescent || 0)) / 2;

		this.queued = false;

		this.reset();
	
	}

	reset() {

		this.textColor = "#FFFFFF";
		this.backColor = "#555555";
		this.draw();
	
	}

	text(color) {

		this.textColor = color;
		this.draw();
	
	}

	back(color) {

		clearTimeout(this.timed);
		this.backColor = color;
		this.draw();
	
	}

	temp(color) {

		clearTimeout(this.timed);
		this.back(color);
		this.timed = setTimeout(
			() =>
				this.reset(),
			3456
		);
	
	}

	prog(id, pc) {

		if(pc === null)
			this.progresses.delete(id);
		else
			this.progresses.set(
				id,
				Util.clamp(pc)
			);

		this.draw();
	
	}

	clearProg(id) {

		this.progresses.delete(id);
		this.draw();
	
	}

	draw() {

		if(this.queued)
			return;

		this.queued = true;
		
		setTimeout(
			() => {

				this.queued = false;
				this.render();
		
			},
			66
		);
	
	}

	render() {

		this.ctx.clearRect(...this.rec);

		this.ctx.fillStyle = this.backColor;
		this.ctx.fillRect(...this.rec);

		if(this.progresses.size > 0) {

			this.ctx.fillStyle = this.progressColor;

			Array.from(this.progresses.values())
			.forEach((pct, idx) => {

				this.ctx.fillRect(
					0,
					this.siz - (idx + 1) * this.progressHeight,
					(pct / 100) * this.siz,
					this.progressHeight
				);
			
			});
		
		}

		this.ctx.fillStyle = this.textColor;
		this.ctx.fillText(
			this.letter,
			this.x,
			this.y
		);

		action.setIcon({
			imageData: this.ctx.getImageData(...this.rec)
		});
	
	}

}

export {
	Backstage
};