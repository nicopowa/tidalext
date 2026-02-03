import { browse, action, DEBUG } from "./vars.js";
import { Offscreen } from "./out.js";
import { wait } from "./util.js";

class Backstage {

	constructor() {

		console.log(this.manifest.name);

		[
			[browse.runtime.onStartup, this.startup],
			[browse.runtime.onInstalled, this.liftoff],
			[browse.downloads.onChanged, this.downloadProgress],
			[browse.commands.onCommand, this.handleCommand],
			[browse.tabs.onUpdated, this.onTabUpdate],
			[browse.tabs.onRemoved, this.onTabRemove],
			[browse.runtime.onMessage, this.handleMessage]
		].forEach(([api, cbk]) =>
			api.addListener(cbk.bind(this)));

		this.opt = {
			downloadCovers: false
		};

		this.dat = {
			auth: false,
			next: false
		};

		this.medias = new Map();
		this.tracks = new Map();
		this.icon = new Icn();
		this.quality = ""; // default quality

		this.off = new Offscreen();

		this.queue = new Queue(this);

		this.urlBase = ""; // service url
		this.urlHost = this.manifest.host_permissions[0];
	
	}

	startup() {

		if(DEBUG)
			console.log("startup");

		this.update();

	}

	liftoff() {

		if(DEBUG)
			console.log("lift off");
		// browser startup || extension installed
		// this.icon.back("#ff8c00");
	
	}

	get manifest() {

		return browse.runtime.getManifest();

	}

	update() {

		if(DEBUG)
			console.log("update check");

		const manurl = this.manifest.homepage_url.replace(
			"github.com",
			"raw.githubusercontent.com"
		) + "/refs/heads/main/manifest.json"
		+ "?t=" + Date.now(); // useless ?

		fetch(manurl)
		.then(res =>
			res.json())
		.then(man => {

			if(+man.version > +this.manifest.version) {

				if(DEBUG)
					console.log("update");

				this.dat.next = true;
			
			}
		
		})
		.catch(() => {
			
			console.error("update fail"); // silent fail
			// this.handleError({ error: err });
		
		});

	}

	watch(matches) {

		Object.entries(matches)
		.forEach(([url, cbk]) =>
			this.tracks.set(
				url,
				cbk.bind(this)
			));
	
	}

	heads(...matches) {

		browse.webRequest.onBeforeSendHeaders.addListener(
			this.heading.bind(this),
			{
				urls: matches
			},
			["requestHeaders"]
		);
	
	}

	heading(evt) {
		// handle request headers
		// from child classes
	}

	send(type, data) {

		//if(DEBUG) console.log("back >>", type, data);

		return browse.runtime.sendMessage({
			type: type,
			...data
		});
	
	}

	async ready() {

		if(DEBUG)
			console.log("ready");

		// this.syncPopup();
	
	}

	async handleMessage(msg, src) {

		// if(DEBUG) console.log(msg);

		switch(msg.type) {

			case "process":
				browse.runtime.sendMessage(msg);
				break;

			case "complete":
				this.queue.handleStreamComplete(msg);
				break;

			case "progress":
				this.handleProgress(msg);
				break;

			case "popup":
				this.syncPopup();
				break;

			case "link":
				this.handleLink(msg);
				break;

			case "fetch":
				this.handleFetch(
					msg,
					src.tab
				);
				break;

			case "save":
				await this.saveSettings(msg);
				break;

			case "download":
				await this.handleDownload(msg);
				break;

			case "error":
				this.handleError(msg);
				break;
		
		}
	
	}

	handleCommand(cmd) {

		if(cmd === "reload")
			browse.runtime.reload();
	
	}

	onTabUpdate(tabId, info, tab) {

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
				"navigate",
				tab.id,
				info.url
			);
	
	}

	onTabLoading(tab, info) {

		if(DEBUG)
			console.log(
				"loading",
				tab.id
			);

		// injected code parses before tab update event
		//this.icon.reset();
	
	}

	onTabComplete(tab, info) {

		if(DEBUG)
			console.log(
				"complete",
				tab.id
			);

	}

	onTabRemove(tabId, info) {

		if(this.medias.has(tabId)) {

			if(DEBUG)
				console.log(
					"rm",
					tabId
					// info
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

	async syncPopup() {

		// no need check ?
		if(!(await this.popped()))
			return;

		this.icon.reset();

		const cur = await this.curTab();
		const lst = await this.lastTab();
		const tab = cur || lst;

		await this.send(
			"sync",
			{
				auth: this.dat.auth,
				next: this.dat.next,

				actv: tab?.active,
				last: !!lst,
							
				settings: await browse.storage.local.get([
					"quality"
					// ... more settings
				]),

				media: this.medias.get(tab?.id) || null
			}
		);

		await this.sendQueue();
	
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
			lastFocusedWindow: true
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

	sameTab(tab, dat) {

		// from child classes
	
	}

	async getSetting(key) {

		return (await browse.storage.local.get(key))[key];
	
	}

	async handleLink(msg) {

		let tab = null;

		switch(msg.how) {

			case "open":
				tab = await this.newTab(this.urlBase);

				break;

			case "swap":
				tab = await this.lastTab();

				if(tab) {

					await this.focusTab(tab);

					await this.reloadTab(tab);
				
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

			const quality = (await this.getSetting("quality")) || this.quality;

			const tab = await this.curTab();

			if(!this.medias.has(tab.id)) {

				console.log("nope");

				return;
			
			}

			const mediaData = this.medias.get(tab.id);

			if(DEBUG)
				console.log(
					"download",
					mediaType,
					mediaId,
					mediaData,
					quality
				);

			if(mediaType === "track") {

				const track = this.trackList(mediaData)
				.find(
					trk =>
						trk.id === +mediaId
				);

				if(track) {

					this.trackDownload(
						track,
						quality,
						mediaData.extype === "album" ? mediaData : null
					);
				
				}
			
			}
			else if(mediaType === "album") {

				const album = await this.getRelease(mediaId);

				const coverBlob = await this.getCover(this.getCoverUrl(album));

				this.trackList(mediaData)
				.forEach(track =>
					this.trackDownload(
						track,
						quality,
						album,
						coverBlob
					));
			
			}
			// duplicated, same as album, merge both
			else if(mediaType === "release") {

				const releaseData = await this.getRelease(mediaId);

				const coverBlob = await this.getCover(this.getCoverUrl(releaseData));

				const trackList = this.trackList(releaseData);

				trackList.forEach(track =>
					this.trackDownload(
						track,
						quality,
						releaseData,
						coverBlob
					));

			}
			else if(mediaType === "playlist") {

				const trackList = this.trackList(mediaData);
				
				trackList.forEach((track, index) =>
					this.trackDownload(
						track,
						quality,
						null,
						null,
						{
							list: true,
							...this.playlistInfos(mediaData),
							indx: index + 1
						}
					));
			
			}
			else if(mediaType === "artist") {

				const releases = this.getArtist(mediaData);

				console.log(releases);

				for(const rel of releases) {

					const release = await this.getRelease(rel.id);

					const coverBlob = await this.getCover(this.getCoverUrl(release));

					this.trackList(release)
					.forEach(track =>
						this.trackDownload(
							track,
							quality,
							release,
							coverBlob
						));

					await wait();

				}

			}
			else if(mediaType === "label") {

				console.log("batch label");
				console.log(mediaData);

			}
			else {

				this.handleError({
					error: "invalid media type"
				});
			
			}
		
		}
		catch(err) {

			this.handleError({
				error: err
			});
		
		}
	
	}

	async handleError(msg) {

		console.error(msg?.error || msg || "error");

		this.icon.text("#ef4444");

		try {

			if(await this.popped()) {

				await this.send(
					"error",
					{
						error: msg.error
					}
				);
			
			}
		
		}
		catch(err) {

			throw new Error(msg.error);
		
		}
	
	}

	handleProgress(msg) {

		this.icon.progress(msg.progress);
	
	}

	async sendQueue() {

		if(await this.popped())
			await this.send(
				"queue",
				{
					items: this.queue.tasks.map(t =>
						({
							// ...t // x)
							id: t.id,
							infos: t.infos,
							progress: t.progress,
							status: t.status,
							error: t.error
						}))
				}
			);
	
	}

	mediaHint() {

		//this.icon.temp("#3b89f6");
		this.icon.back("#3b89f6");
	
	}

	handleFetch(msg, tab) {

		const {
			url, hit, sts, dat, opt
		} = msg;

		if(this.tracks.has(hit)) {

			// if(DEBUG) console.log("hit", hit);

			this.tracks.get(hit)(
				tab,
				dat,
				opt
			);
		
		}
	
	}

	getArtist(artist) {
		// from child classes
	}

	async getRelease(releaseId) {
		// api calls from child classes
	}

	async getCover(coverUrl) {

		const coverDat = await fetch(coverUrl);
		const coverBlob = await coverDat.blob();
		const coverBuff = await coverBlob.arrayBuffer();

		return {
			data: Array.from(new Uint8Array(coverBuff)),
			type: coverBlob.type
		};
	
	}

	getTrackUrl(track, quality) {

		//if(DEBUG) console.log("track url", track, quality);
	
	}

	getCoverUrl(media) {
		// child classes
	}

	getFilePath(track, album, rules) {
		// child classes
	}

	getMetaData(track, album) {
		// child classes
	}

	trackDownload(track, quality, album = null, cover = null, rules = null) {

		this.queue.add({
			id: `${track.id}_${Date.now()}`,
			track: track,
			infos: this.getTrackInfos(track),
			quality: quality,
			status: "wait",
			progress: 0,
			album: album,
			file: null,
			meta: null,
			cover: cover,
			rules: rules,
			error: null
		});
	
	}

	trackList(media) {

		// child classes
		return [];
	
	}

	playlistInfos(list) {

		// child classes
		return {};
	
	}

	getTrackInfos(track) {

		// child classes
		return {};
	
	}

	trackTitle(track) {

		return `${track.title}${track.version ? ` (${track.version})` : ""}`
		.replaceAll(
			"/",
			"-"
		);
	
	}

	albumTitle(album) {

		return `${album.title}${album.version ? ` (${album.version})` : ""}`;
	
	}

	sanitize(name) {

		return name
		// win backslash to forward
		.replace(
			/\\/g,
			"/"
		)
		// remove illegal chars          
		.replace(
			/[<>:"|?*\x00-\x1F]/g,
			""
		)
		// remove dots/spaces at end of folder/file names
		.replace(
			/[. ]+([\/]|$)/g,
			"$1"
		)
		// remove leading slash (fixes "drive root" error)
		.replace(
			/^\//,
			""
		)
		// replace multiple spaces by single space
		.replace(
			/\s+/g,
			" "
		)
		.trim();

		return name
		.replace(
			/[<>:"/\\|?*]/g,
			"_"
		)
		.replace(
			/\s+/g,
			" "
		)
		.trim();
	
	}

	async downloadProgress(delta) {

		if(this.queue.blobs.has(delta.id)) {

			if(delta?.state?.current === "complete") {

				// if(DEBUG) console.log("downloaded", delta.id);

				this.icon.reset();

				//await
				this.send(
					"clear",
					{
						id: this.queue.blobs.get(delta.id)
					}
				);

				this.queue.blobs.delete(delta.id);
			
			}
		
		}
	
	}

	async saveSettings(msg) {

		await browse.storage.local.set(msg.settings);
	
	}

}

class Icn {

	constructor() {

		this.textColor = "#FFFFFF";
		this.backColor = "#6B7280";

		this.letter = browse.runtime
		.getManifest()
		.name.slice(
			0,
			1
		)
		.toUpperCase();

		this.size = 64;

		this.fade = "AE";

		this.timed = null;

		this.progressPercent = null;
		this.progressHeight = 5;
		this.progressColor = "#62B9FF";

		this.rect = [0, 0, this.size, this.size];

		this.icon = new OffscreenCanvas(
			this.size,
			this.size
		);

		this.ctx = this.icon.getContext(
			"2d",
			{
				alpha: true,
				willReadFrequently: true
			}
		);

		this.ctx.font = Math.round(this.size * 4 / 5) + "px Segoe UI";
		this.ctx.textAlign = "center";
		this.ctx.textBaseline = "alphabetic";

		const metrics = this.ctx.measureText(this.letter);

		this.x = this.size / 2;
		this.y = this.size / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;

		this.reset();
	
	}

	reset() {

		this.textColor = "#FFFFFF";
		this.backColor = "#6B7280";
		this.progressPercent = null;

		this.render();
	
	}

	text(color) {

		this.textColor = color;

		this.render();
	
	}

	back(color) {

		this.backColor = color + this.fade;

		this.render();
	
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

	progress(percent) {

		this.progressPercent = Math.max(
			0,
			Math.min(
				100,
				percent
			)
		);

		this.render();
	
	}

	render() {

		this.ctx.clearRect(...this.rect);

		this.ctx.fillStyle = this.backColor;

		this.ctx.fillRect(...this.rect);

		if(this.progressPercent !== null) {

			const progressWidth = (this.progressPercent / 100) * this.size;
			const progressY = this.size - this.progressHeight;

			this.ctx.fillStyle = this.progressColor;

			this.ctx.fillRect(
				0,
				progressY,
				progressWidth,
				this.progressHeight
			);
		
		}

		this.ctx.fillStyle = this.textColor;

		this.ctx.fillText(
			this.letter,
			this.x,
			this.y
		);

		action.setIcon({
			imageData: this.ctx.getImageData(...this.rect)
		});
	
	}

	badge(text, back = "#3b89f6") {

		action.setBadgeText({
			text
		});

		action.setBadgeBackgroundColor({
			color: back
		});
	
	}

}

class Queue {

	/**
	 * @param {Backstage} main
	 */
	constructor(main) {

		this.main = main;
		this.proc = "offscreen.html";
		this.tasks = [];
		this.current = null;
		this.processing = false;
		this.blobs = new Map();
	
	}

	add(task) {

		this.tasks.push(task);
		this.main.sendQueue();
		this.process();
	
	}

	async process() {

		if(this.processing || !this.tasks.length)
			return;

		this.processing = true;

		await this.main.off.ensure(this.proc);

		this.processNext();
	
	}

	async processNext() {

		if(!this.tasks.length) {

			await this.main.off.close();

			this.current = null;
			this.processing = false;
			this.main.sendQueue();

			return;
		
		}

		this.current = this.tasks[0];
		this.current.status = "load";
		this.main.sendQueue();

		this.downloadTask(this.current);
	
	}

	async downloadTask(task) {

		if(DEBUG)
			console.log(
				"task",
				task
			);

		if(!task.album)
			task.album = await this.main.getRelease(task.track.album.id);

		task.file = this.main.getFilePath(
			task.track,
			task.album,
			task.rules
		);
		task.meta = this.main.getMetaData(
			task.track,
			task.album
		);

		if(!task.cover)
			task.cover = await this.main.getCover(this.main.getCoverUrl(task.album));

		this.startDownload(
			await this.main.getTrackUrl(
				task.track,
				task.quality
			),
			task
		);
	
	}

	startDownload(dat, task) {

		console.log(
			"start download",
			dat,
			task
		);

		this.main.off.post({
			type: "process",
			id: task.id,
			dat: dat,
			metadata: task.meta,
			cover: task.cover
		});

	}

	async handleStreamComplete(msg) {

		if(!this.current || this.current.id !== msg.id)
			return;

		if(msg.ok) {

			const downloadId = await browse.downloads.download({
				url: msg.url,
				filename: this.current.file,
				conflictAction: "overwrite"
			});

			if(downloadId) {

				this.blobs.set(
					downloadId,
					this.current.id
				);

				if(this.main.opt.downloadCovers) {

					const downloadCoverId = await browse.downloads.download({
						url: msg.cvr,
						filename: [...this.current.file.split("/")
						.slice(
							0,
							-1
						), "cover"].join("/") + "." + this.current.cover.type.split("/")[1].replace(
							"jpeg",
							"jpg"
						),
						conflictAction: "overwrite"
					});
				
				}

				this.current.status = "ok";
			
			}
			else {

				if(browse.runtime.lastError) {

					this.current.status = "error";
					this.current.error = browse.runtime.lastError.message;
				
				}
			
			}
		
		}
		else {

			this.current.status = "error";
			this.current.error = msg.error;
		
		}

		this.main.sendQueue();

		await wait();

		this.tasks.shift();
				
		this.processNext();
	
	}

}

export {
	Backstage
};
