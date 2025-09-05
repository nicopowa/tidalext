import { browser, DEBUG } from "./vars.js";

class Backstage {

	constructor(proc) {

		this.downloadCovers = false;

		this.dat = {
			auth: false,
			next: false
		};

		this.medias = new Map();
		this.tracks = new Map();
		this.icon = new Icn();
		this.quality = ""; // default quality

		this.queue = new Queue(
			this,
			proc
		);

		this.urlBase = ""; // service url
		this.urlHost = this.manifest().host_permissions[0];
		
		[
			[browser.runtime.onStartup, this.liftoff],
			[browser.runtime.onInstalled, this.liftoff],
			[browser.downloads.onChanged, this.downloadProgress],
			[browser.commands.onCommand, this.handleCommand],
			// [browser.tabs.onUpdated, this.onTabUpdate],
			[browser.tabs.onRemoved, this.onTabRemove],
			[browser.runtime.onMessage, this.handleMessage]
		].forEach(([api, cbk]) =>
			api.addListener(cbk.bind(this)));
	
	}

	liftoff() {

		// if(DEBUG) console.log("lift off");
		// browser startup || extension installed
		// this.icon.back("#ff8c00");
		this.update();
	
	}

	manifest() {

		return browser.runtime.getManifest();

	}

	update() {

		if(DEBUG)
			console.log("update check");

		fetch(this.manifest().homepage_url.replace(
			"github.com",
			"raw.githubusercontent.com"
		) + "/refs/heads/main/manifest.json")
		.then(res =>
			res.json())
		.then(man => {

			if(parseFloat(man.version) > parseFloat(this.manifest().version)) {

				if(DEBUG)
					console.log("update available");

				this.dat.next = true;
			
			}
		
		})
		.catch(() => {

			// silent fail
			console.log("update fail");
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

		browser.webRequest.onBeforeSendHeaders.addListener(
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

		if(DEBUG)
			console.log(
				"back >>",
				type,
				data
			);

		return browser.runtime.sendMessage({
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
				browser.runtime.sendMessage(msg);
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
			browser.runtime.reload();
	
	}

	onTabUpdate(tabId, info, tab) {

		// blank tab
		if(!tab.url)
			return;

		// console.log("up", tab, info);

		if(info?.status === "loading") {
			
			console.log("loading");
		
		}
		else if(info?.status === "complete") {

			console.log("complete");
		
		}
	
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
			await browser.runtime.getContexts({
				contextTypes: ["POPUP"]
			})
		).length;
	
	}

	async syncPopup() {

		if(!(await this.popped()))
			return;

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

				/*need: this.dat.auth
					? "nope"
					: !tab
						? "open"
						: !tab?.active
							? "swap"
							: "load",*/
							
				settings: await browser.storage.local.get([
					"quality"
					// more settings
				]),

				media: this.medias.get(tab?.id) || null
			}
		);

		await this.sendQueue();
	
	}

	newTab(url) {

		return browser.tabs.create({
			url
		});
	
	}

	async curTab() {

		const [cur] = await browser.tabs.query({
			url: [this.urlHost],
			active: true
		});

		return cur;
	
	}

	async lastTab() {

		const [last] = await browser.tabs.query({
			url: [this.urlHost],
			lastFocusedWindow: true
		});

		return last;
	
	}

	focusTab(tab) {

		return browser.tabs.update(
			tab.id,
			{
				active: true
			}
		);
	
	}

	reloadTab(tab) {

		return browser.tabs.reload(tab.id);
	
	}

	async getSetting(key) {

		return (await browser.storage.local.get(key))[key];
	
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

			if(DEBUG)
				console.log(
					"download",
					mediaType,
					mediaId,
					quality
				);

			if(mediaType === "track") {

				const track = this.trackList(tab.id)
				.find(
					trk =>
						trk.id === +mediaId
				);

				if(track) {

					const coverBlob = await this.getCover(
						this.getCoverUrl(
							tab.id,
							track
						)
					);

					this.trackDownload(
						track,
						this.medias.get(tab.id),
						quality,
						coverBlob
					);
				
				}
			
			}
			else if(mediaType === "album") {

				const coverBlob = await this.getCover(
					this.getCoverUrl(
						tab.id,
						this.medias.get(tab.id)
					)
				);

				this.trackList(tab.id)
				.forEach(track =>
					this.trackDownload(
						track,
						this.medias.get(tab.id),
						quality,
						coverBlob
					));
			
			}
			else if(mediaType === "playlist") {

				/*const coverBlob = await this.getCover(
					this.getCoverUrl(this.media)
				);

				for(const track of this.media.tracks?.items || []) {

					this.trackDownload(
						track,
						this.media,
						quality,
						coverBlob
					);
				
				}*/
			
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

		this.icon.temp("#226bc5");
	
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

	async getCover(coverUrl) {

		const coverDat = await fetch(coverUrl);
		const coverBlob = await coverDat.blob();
		const coverBuff = await coverBlob.arrayBuffer();

		return {
			data: Array.from(new Uint8Array(coverBuff)),
			type: coverBlob.type
		};
	
	}

	getTrackInfos(track, album) {
		// child classes
	}

	getTrackUrl(track, quality) {

		if(DEBUG)
			console.log(
				"track url",
				track,
				quality
			);
	
	}

	getCoverUrl(tabId, media) {
		// child classes
	}

	getFilePath(track, album) {
		// child classes
	}

	getMetaData(track, album) {
		// child classes
	}

	trackDownload(track, album, quality, cover = null) {

		this.queue.add({
			id: `${track.id}_${Date.now()}`,
			track: track,
			quality: quality,
			status: "wait",
			progress: 0,
			infos: this.getTrackInfos(
				track,
				album
			),
			file: this.getFilePath(
				track,
				album
			),
			meta: this.getMetaData(
				track,
				album
			),
			cover: cover,
			error: null
		});
	
	}

	trackList(tabId) {

		// child classes
		return [];
	
	}

	trackTitle(track) {

		return `${track.title}${track.version ? ` (${track.version})` : ""}`;
	
	}

	albumTitle(album) {

		return `${album.title}${album.version ? ` (${album.version})` : ""}`;
	
	}

	sanitize(name) {

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

				await this.send(
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

		await browser.storage.local.set(msg.settings);
	
	}

}

class Icn {

	constructor() {

		this.textColor = "#FFFFFF";
		this.backColor = "#6b7280";

		this.letter = browser.runtime
		.getManifest()
		.name.slice(
			0,
			1
		)
		.toUpperCase();

		this.size = 64;

		this.fade = "ae";

		this.timed = null;

		this.progressPercent = null;
		this.progressHeight = 5;
		this.progressColor = "#62b9ff";

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

		this.ctx.font = Math.round(this.size * 4 / 5) + "px Arial";
		this.ctx.textAlign = "center";
		this.ctx.textBaseline = "alphabetic";

		const metrics = this.ctx.measureText(this.letter);

		this.x = this.size / 2;
		this.y
			= this.size / 2
			+ (metrics.actualBoundingBoxAscent
				- metrics.actualBoundingBoxDescent)
				/ 2;

		this.reset();
	
	}

	reset() {

		this.textColor = "#FFFFFF";
		this.backColor = "#6b7280";
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

		this.ctx.clearRect(
			0,
			0,
			this.size,
			this.size
		);

		this.ctx.fillStyle = this.backColor;

		this.ctx.fillRect(
			0,
			0,
			this.size,
			this.size
		);

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

		browser.action.setIcon({
			imageData: this.ctx.getImageData(
				0,
				0,
				this.size,
				this.size
			)
		});
	
	}

	badge(text, back = "#226bc5") {

		browser.action.setBadgeText({
			text
		});

		browser.action.setBadgeBackgroundColor({
			color: back
		});
	
	}

}

class Queue {

	/**
	 * @param {Backstage} main
	 * @param {string} proc
	 */
	constructor(main, proc) {

		this.main = main;
		this.proc = proc;
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

	runProc() {

		return browser.offscreen.createDocument({
			url: this.proc,
			reasons: ["BLOBS"],
			justification: "processing"
		});
	
	}

	endProc() {

		return browser.offscreen.closeDocument();
	
	}

	async process() {

		if(this.processing || !this.tasks.length)
			return;

		this.processing = true;

		await this.runProc();

		this.processNext();
	
	}

	async processNext() {

		if(!this.tasks.length) {

			await this.endProc();

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

		console.log(
			"task",
			task
		);

		const trackData = await this.main.getTrackUrl(
			task.track,
			task.quality
		);

		this.startDownload(
			trackData,
			task
		);
	
	}

	startDownload(dat, task) {

		this.main.send(
			"process",
			{
				id: task.id,
				dat: dat,
				metadata: task.meta,
				cover: task.cover
			}
		);
	
	}

	async handleStreamComplete(msg) {

		if(!this.current || this.current.id !== msg.id)
			return;

		if(msg.ok) {

			const downloadId = await browser.downloads.download({
				url: msg.url,
				filename: this.current.file,
				conflictAction: "overwrite"
			});

			if(downloadId) {

				this.blobs.set(
					downloadId,
					this.current.id
				);

				if(this.main.downloadCovers) {

					const downloadCoverId = await browser.downloads.download({
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

				if(browser.runtime.lastError) {

					this.current.status = "error";
					this.current.error = browser.runtime.lastError.message;
				
				}
			
			}
		
		}
		else {

			this.current.status = "error";
			this.current.error = msg.error;
		
		}

		this.main.sendQueue();

		setTimeout(
			() => {

				this.tasks.shift();
				
				this.processNext();
			
			},
			345
		);
	
	}

}

export {
	DEBUG, Backstage
};
