const browser = chrome;

class Backstage {

	constructor() {

		this.tracks = new Map();
		this.icon = new Icn();
		this.media = null;
		this.listen();
	
	}

	init() {

	}

	listen() {

		browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {

			this.handleMessage(
				msg,
				sender,
				sendResponse
			);

			return true;
		
		});

		browser.downloads.onChanged.addListener(delta =>
			this.downloadProgress(delta));
		
	}

	track(url, cbk) {

		// console.log("track", url);

		this.tracks.set(
			url,
			cbk
		);
	
	}

	trash(url) {

		if(this.tracks.has(url)) {

			// console.log("trash", url);

			this.tracks.delete(url);

		}

	}

	async handleMessage(msg, sender, callback) {

		// console.log(msg);

		let res;

		try {

			switch(msg.type) {

				case "processStream":
					browser.runtime.sendMessage(msg);
					res = {
						ok: true
					};
					break;

				case "streamComplete":
					this.queue.handleStreamComplete(msg);
					res = {
						ok: true
					};
					break;

				case "loadProgress":
					this.sendProgress(msg.progress);
					res = {
						ok: true
					};
					break;

				case "fetch":
					const {
						url, hit, sts, dat, opt
					} = msg;

					if(this.tracks.has(hit)) {

						this.tracks.get(hit)(
							dat,
							opt
						);
				
					}

					break;

				case "media":
					res = this.media;
					break;
			
				case "setSettings":
					res = await this.setSettings(msg.settings);
					break;

				case "getSettings":
					res = await this.getSettings();
					break;

				case "download":
					res = await this.handleDownload(msg);
					break;

				case "error":
					throw new Error(msg.error);

				default:
					res = {
						ok: false,
						error: "unknown type " + msg.type
					};

			}
		
		}
		catch(err) {

			res = {
				ok: false,
				error: err.message
			};
		
		}

		callback(res);
	
	}

	handleDownload(msg) {
		
	}

	sendProgress(progress) {

		browser.runtime.sendMessage({
			type: "progress",
			progress: progress
		})
		.catch(() => {});
	
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

		browser.runtime.sendMessage({
			type: "queue",
			items: items,
			current: current
		})
		.catch(() => {});
	
	}

	mediaHint() {

		console.log("media hint");
		this.icon.back("#226bc5");
		setTimeout(
			() => {

				this.icon.reset();
			
			},
			2500
		);
	
	}

	async getCover(coverUrl) {

		console.log("get cover");

		const coverDat = await fetch(coverUrl);
		const coverBlob = await coverDat.blob();
		const coverBuff = await coverBlob.arrayBuffer();

		return {
			data: Array.from(new Uint8Array(coverBuff)),
			type: coverBlob.type
		};

	}

	trackDownload(track, album, quality, cover = null) {

		this.queue.add({
			id: `track_${track.id}_${Date.now()}`,
			track: track,
			quality: quality,
			status: "wait",
			progress: 0,
			title: this.trackName(track),
			file: this.filename(
				track,
				this.media
			),
			meta: this.trackMeta(
				track,
				album
			),
			cover: cover,
			error: null
		});

	}

	trackName(track) {

		return `${track.title}${track.version ? ` (${track.version})` : ""}`;
	
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

		if(this.queue.downloadIds.has(delta.id)) {

			if(delta?.state?.current === "complete") {

				console.log(
					"download complete",
					delta.id
				);

				this.queue.downloadIds.delete(delta.id);

			}

		}
	
	}
	
	async setSettings(settings) {

		try {

			// console.log("save", settings);

			await browser.storage.local.set({
				"settings": settings
			});

			return {
				ok: true
			};
		
		}
		catch(err) {

			return {
				ok: false,
				error: err.message
			};
		
		}
	
	}

	async getSettings() {

		try {

			return await browser.storage.local.get("settings");
		
		}
		catch(err) {

			return {
				ok: false,
				error: err.message
			};
		
		}
	
	}

}

class Icn {

	constructor() {

		this.textColor = "#FFFFFF";
		this.backColor = "#6b7280";

		// this.badgeText = "";

		this.letter = browser.runtime.getManifest().name.slice(
			0,
			1
		)
		.toUpperCase();

		this.size = 64;

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

		this.backColor = color;
		
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
	
		this.ictx.fillStyle = this.textColor;
		
		this.ictx.fillText(
			this.letter,
			this.x,
			this.y
		);

		// badge

		/*if(this.badgeText) {

			const badgeSize = Math.round(this.size / 2);
			const margin = 0;
			const badgeX = this.size - badgeSize - margin;
			const badgeY = this.size - badgeSize - margin;

			// Draw badge background (small square)
			this.ictx.fillStyle = this.badgeColor;
			this.ictx.fillRect(
				badgeX,
				badgeY,
				badgeSize,
				badgeSize
			);

			// Draw badge text
			this.ictx.fillStyle = "#FFFFFF";
			this.ictx.font = Math.round(badgeSize * 3 / 4) + "px Arial";
			this.ictx.textAlign = "center";
			this.ictx.textBaseline = "alphabetic";

			this.ictx.fillText(
				this.badgeText,
				badgeX + badgeSize / 2,
				badgeY + badgeSize / 2
			);

		}*/
	
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

		/*this.badgeText = text;
		this.badgeColor = back;

		this.render();*/

		browser.action.setBadgeText({
			text
		});
		
		browser.action.setBadgeBackgroundColor({
			color: back
		});
	
	}

}

class BaseQueueManager {

	constructor(main) {

		this.main = main;
		this.queue = [];
		this.current = null;
		this.processing = false;
		this.downloads = new Map();
		this.downloadIds = new Set();
	
	}

	async init(offscreenUrl) {

		try {

			await browser.offscreen.createDocument({
				url: offscreenUrl,
				reasons: ["BLOBS"],
				justification: "audio processing"
			});
		
		}
		catch(err) {

			console.log(err);
		
		}
	
	}

	add(task) {

		this.queue.push(task);
		this.main.sendQueue();
		this.process();
	
	}

	process() {

		if(this.processing || !this.queue.length)
			return;

		this.processing = true;
		this.processNext();
	
	}

	processNext() {

		if(!this.queue.length) {

			this.current = null;
			this.processing = false;
			this.main.sendQueue();

			return;
		
		}

		this.current = this.queue.shift();
		this.current.status = "loading";
		this.current.progress = 0;
		this.main.sendQueue();

		this.downloadTask(this.current)
		.then(() => {

			this.current.status = "done";
			this.current.progress = 100;
		
		})
		.catch(err => {

			this.current.status = "error";
			this.current.error = err.message;
		
		})
		.finally(() => {

			this.main.sendQueue();

			setTimeout(
				() =>
					this.processNext(),
				333
			);
		
		});
	
	}

	startDownload(url, task) {

		const id = `${Date.now()}_${Math.random()}`;

		return new Promise((resolve, reject) => {

			this.downloads.set(
				id,
				{
					task,
					filename: task.file,
					resolve,
					reject
				}
			);

			browser.runtime.sendMessage({
				action: "processStream",
				id,
				fetchUrl: url,
				metadata: task.meta,
				cover: task.cover
			});
		
		});

	}

	handleStreamComplete(msg) {

		const download = this.downloads.get(msg.id);

		if(!download)
			return;

		this.downloads.delete(msg.id);

		if(msg.ok) {

			browser.downloads.download(
				{
					url: msg.url,
					filename: download.filename,
					conflictAction: "overwrite"
				},
				downloadId => {

					if(downloadId)
						this.downloadIds.add(downloadId);

					if(browser.runtime.lastError) {

						download.reject(new Error(browser.runtime.lastError.message));
				
					}
					else {

						download.resolve();
				
					}
			
				}
			);
		
		}
		else {

			download.reject(new Error(msg.error));
		
		}
	
	}

}

export {
	Backstage,
	BaseQueueManager
};