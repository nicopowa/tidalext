import { browser, DEBUG } from "./vars.js";

class Backstage {

	constructor(proc) {

		this.dat = {
			auth: false,
			next: false
		};

		this.tracks = new Map();
		this.icon = new Icn();
		this.queue = new Queue(
			this,
			proc
		);

		this.urlBase = ""; // service url
		this.urlHost = browser.runtime.getManifest().host_permissions[0];
		this.media = null; // current media
		this.quality = ""; // default quality

		[
			[browser.runtime.onStartup, this.liftoff],
			[browser.runtime.onInstalled, this.liftoff],
			[browser.downloads.onChanged, this.downloadProgress],
			[browser.commands.onCommand, this.handleCommand],
			[browser.runtime.onMessage, this.handleMessage]
		].forEach(([api, cbk]) =>
			api.addListener(cbk.bind(this)));
	
	}

	liftoff() {

		// if(DEBUG) console.log("lift off");
		// browser startup || extension installed
		this.icon.back("#ff8c00");
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
				"bak send",
				type
			);

		browser.runtime.sendMessage({
			type: type,
			...data
		});
	
	}

	async ready() {

		this.loginHint();

		this.syncPopup();
	
	}

	async handleMessage(msg) {

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
				this.handleFetch(msg);
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

		const [tab] = await this.lastTab();

		this.send(
			"sync",
			{
				auth: this.dat.auth,
				next: this.dat.next,
				need: this.dat.auth
					? "nope"
					: !tab
						? "open"
						: !tab?.active
							? "swap"
							: "load",
				settings: await browser.storage.local.get([
					"quality"
					// more props
				])
			}
		);

		this.syncMedia();
		this.sendQueue();
	
	}

	async syncMedia() {

		if(await this.popped()) {

			this.send(
				"media",
				{
					media: this.media
				}
			);
		
		}
	
	}

	newTab(url) {

		return browser.tabs.create({
			url
		});
	
	}

	lastTab() {

		return browser.tabs.query({
			url: [this.urlHost],
			lastFocusedWindow: true
		});
	
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

	curTab() {

		return browser.tabs.query({
			url: [this.urlHost],
			active: true
		});
	
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
				[tab] = await this.lastTab();

				if(tab) {

					await this.focusTab(tab);

					await this.reloadTab(tab);
				
				}

				break;

			case "load":
				[tab] = await this.curTab();

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

			if(DEBUG)
				console.log(
					"download",
					mediaType,
					mediaId,
					quality
				);

			if(mediaType === "track") {

				const track = this.trackList()
				.find(
					trk =>
						trk.id === +mediaId
				);

				if(track) {

					const coverBlob = await this.getCover(
						this.getCoverUrl(track)
					);

					this.trackDownload(
						track,
						this.media,
						quality,
						coverBlob
					);
				
				}
			
			}
			else if(mediaType === "album") {

				const coverBlob = await this.getCover(
					this.getCoverUrl(this.media)
				);

				this.trackList()
				.forEach(track =>
					this.trackDownload(
						track,
						this.media,
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

				this.send(
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
			this.send(
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

	loginHint() {

		this.icon.temp("#22c566");
	
	}

	mediaHint() {

		this.icon.temp("#226bc5");
	
	}

	handleFetch(msg) {

		const {
			url, hit, sts, dat, opt
		} = msg;

		if(this.tracks.has(hit)) {

			// if(DEBUG) console.log("hit", hit);

			this.tracks.get(hit)(
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

	getTrackUrl(trackId, quality) {}

	getCoverUrl(media) {
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
				this.media
			),
			meta: this.getMetaData(
				track,
				album
			),
			cover: cover,
			error: null
		});
	
	}

	trackList() {

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

	downloadProgress(delta) {

		if(this.queue.blobs.has(delta.id)) {

			if(delta?.state?.current === "complete") {

				// if(DEBUG) console.log("downloaded", delta.id);

				this.icon.reset();

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

		this.size = 48;

		this.fade = "ae";

		this.timed = null;

		this.progressPercent = null;
		this.progressHeight = 5;
		this.progressColor = "#62b9ff";

		this.icon = new OffscreenCanvas(
			this.size,
			this.size
		);

		this.ictx = this.icon.getContext(
			"2d",
			{
				alpha: false,
				willReadFrequently: true
			}
		);

		this.ictx.font = Math.round((this.size * 3) / 4) + "px Arial";
		this.ictx.textAlign = "center";
		this.ictx.textBaseline = "alphabetic";

		const metrics = this.ictx.measureText(this.letter);

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

		this.back(color);

		clearTimeout(this.timed);

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

		this.ictx.clearRect(
			0,
			0,
			this.size,
			this.size
		);

		this.ictx.fillStyle = this.backColor;

		this.ictx.fillRect(
			0,
			0,
			this.size,
			this.size
		);

		if(this.progressPercent !== null) {

			const progressWidth = (this.progressPercent / 100) * this.size;
			const progressY = this.size - this.progressHeight;

			this.ictx.fillStyle = this.progressColor;

			this.ictx.fillRect(
				0,
				progressY,
				progressWidth,
				this.progressHeight
			);
		
		}

		this.ictx.fillStyle = this.textColor;

		this.ictx.fillText(
			this.letter,
			this.x,
			this.y
		);

		browser.action.setIcon({
			imageData: this.ictx.getImageData(
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
		this.current.progress = 0;
		this.main.sendQueue();

		this.downloadTask(this.current);
	
	}

	async downloadTask(task) {

		const trackData = await this.main.getTrackUrl(
			task.track.id,
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

				this.current.status = "done";
			
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
