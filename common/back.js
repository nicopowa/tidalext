const browser = chrome;

class Backstage {

	constructor(proc) {

		this.dat = {
			auth: false
		};

		this.tracks = new Map();
		this.icon = new Icn();
		this.queue = new Line(
			this,
			proc
		);

		this.urlBase = "";
		this.urlHost = browser.runtime.getManifest().host_permissions[0];
		this.media = null;

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

		console.log("lift off");
		// browser startup
		// extension installed
		this.icon.back("#ff8c00");

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
			[
				"requestHeaders"
			]
		);

	}

	heading(evt) {
		// handle request headers
		// from child classes
	}

	send(type, data) {

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

		// console.log(msg);

		switch(msg.type) {

			case "processStream":
				browser.runtime.sendMessage(msg);
				break;

			case "streamComplete":
				this.queue.handleStreamComplete(msg);
				break;

			case "loadProgress":
				this.sendProgress(msg);
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

		if(cmd === "reload") {

			browser.runtime.reload();
		
		}
	
	}

	async popped() {

		const [popped] = await browser.runtime.getContexts({
			contextTypes: ["POPUP"]
		});

		return popped;

	}

	async syncPopup() {
		
		if(!await this.popped())
			return;

		const [tab] = await this.lastTab();

		this.send(
			"sync",
			{
				auth: this.dat.auth,
				need: this.dat.auth ? "nope" : !tab ? "open" : !tab?.active ? "swap" : "load",
				settings: await browser.storage.local.get([
					"quality"
					// more props
				])
			}
		);

		this.syncMedia();

	}

	async syncMedia() {

		if(!await this.popped())
			return;

		this.send(
			"media",
			{
				media: this.media
			}
		);

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

		return browser.tabs.reload(
			tab.id
		);

	}

	curTab() {

		return browser.tabs.query({
			url: [this.urlHost],
			active: true
		});

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
				mediaType, mediaId, quality
			} = msg;

			console.log(
				"download",
				mediaType,
				mediaId,
				quality
			);

			if(mediaType === "track") {

				const track = this.trackList()
				.find(trk =>
					trk.id === +mediaId);

				if(track) {

					const coverBlob = await this.getCover(this.getCoverUrl(track));

					this.trackDownload(
						track,
						this.media,
						quality,
						coverBlob
					);

				}
			
			}
			else if(mediaType === "album") {

				const coverBlob = await this.getCover(this.getCoverUrl(this.media));

				this.trackList()
				.forEach(
					track =>
						this.trackDownload(
							track,
							this.media,
							quality,
							coverBlob
						)
				);
				
			}
			else if(mediaType === "playlist") {

				const coverBlob = await this.getCover(this.getCoverUrl(this.media));

				/*for(const track of this.media.tracks?.items || []) {

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

			if(!await this.popped())
				return;

			this.send(
				"error",
				{
					error: msg.error
				}
			);
		
		}
		catch(err) {

			throw new Error(msg.error);
		
		}
	
	}

	sendProgress(msg) {

		this.send(
			"progress",
			{
				progress: msg.progress
			}
		);
	
	}

	sendQueue() {

		const items = this.queue.queue.map(t =>
			({
				id: t.id,
				title: t.title,
				progress: t.progress,
				status: t.status,
				error: t.error
			}));

		const current = this.queue.current ? {
			id: this.queue.current.id,
			title: this.queue.current.title,
			progress: this.queue.current.progress,
			status: this.queue.current.status,
			error: this.queue.current.error
		} : null;

		this.send(
			"queue",
			{
				items: items,
				current: current
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

			// console.log("hit", hit);

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

	getTrackUrl(trackId, quality) {
		
	}

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

		// console.log("track", track, album, quality);

		this.queue.add({
			id: `${track.id}_${Date.now()}`,
			track: track,
			quality: quality,
			status: "wait",
			progress: 0,
			title: this.trackTitle(track),
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

		return name.replace(
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

				// console.log("downloaded", delta.id);

				this.send(
					"clearStream",
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

		this.letter = browser.runtime.getManifest().name.slice(
			0,
			1
		)
		.toUpperCase();

		this.size = 48;

		this.fade = "ae";

		this.timed = null;

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

		this.ictx.font = Math.round(this.size * 3 / 4) + "px Arial";
		this.ictx.textAlign = "center";
		this.ictx.textBaseline = "alphabetic";

		const metrics = this.ictx.measureText(this.letter);

		this.x = this.size / 2;
		this.y = this.size / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;

		this.reset();
	
	}

	reset() {

		this.textColor = "#FFFFFF";
		this.backColor = "#6b7280";

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
	
		this.ictx.fillStyle = this.textColor;
		
		this.ictx.fillText(
			this.letter,
			this.x,
			this.y
		);

		const imageData = this.ictx.getImageData(
			0,
			0,
			this.size,
			this.size
		);

		browser.action.setIcon({
			imageData: imageData
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

class Line {

	/**
	 * @param {Backstage} main 
	 * @param {string} proc 
	 */
	constructor(main, proc) {

		this.main = main;
		this.proc = proc;
		this.queue = [];
		this.current = null;
		this.processing = false;
		this.blobs = new Map();
	
	}

	add(task) {

		this.queue.push(task);
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

		if(this.processing || !this.queue.length)
			return;

		this.processing = true;

		await this.runProc();

		this.processNext();
	
	}

	async processNext() {

		if(!this.queue.length) {

			await this.endProc();
			this.current = null;
			this.processing = false;
			this.main.sendQueue();

			return;
		
		}

		this.current = this.queue.shift();
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
			"processStream",
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

			const downloadId = await browser.downloads.download(
				{
					url: msg.url,
					filename: this.current.file,
					conflictAction: "overwrite"
				}
			);

			if(downloadId) {

				this.blobs.set(
					downloadId,
					this.current.id
				);

				this.current.status = "done";
				this.current.progress = 100;

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
			() =>
				this.processNext(),
			321
		);
	
	}

}

export {
	Backstage
};