const browser = chrome;

class BasePopup {

	constructor() {

		this.currentMedia = null;

		this.state = {
			loading: null,
			mediaInfo: null,
			queueItems: [],
			currentTask: null,
			currentProgress: 0
		};

		this.elements = {};
		this.statusTimeouts = new Map();
		
		this.cacheElements();
		this.bindEvents();
		this.initialize();
	
	}

	cacheElements() {

		[
			"content", "nomedia", "media", "mediainfo", "mediawrap", "medialist",
			"queue", "queueList", "mainStatus"
		].forEach(id => {

			this.elements[id] = document.getElementById(id);
		
		});
	
	}

	bindEvents() {
		
		document.querySelector(".quality-group")
		.addEventListener(
			"change",
			() =>
				this.setSettings()
		);

		browser.runtime.onMessage.addListener(this.handleMessage.bind(this));
	
	}

	handleMessage(msg) {

		switch(msg.type) {

			case "progress":
				this.updateProgress(msg.progress);
				break;
			
			case "queue":
				this.updateQueue(msg);
				break;

		}

	}

	initialize() {

		this.sendMessage({
			type: "media"
		})
		.then(media => {

			this.currentMedia = media;
			this.updateMedia();
		
		})
		.catch(err => {

			console.error(err);
		
		});

		this.getSettings();
	
	}

	updateMedia() {

		this.elements.media.classList.toggle(
			"hidden",
			!this.currentMedia
		);
		this.elements.nomedia.classList.toggle(
			"hidden",
			!!this.currentMedia
		);

		if(this.currentMedia) {

			this.updateQualityOptions();

			switch(this.currentMedia.extype) {

				case "album":
					this.renderAlbum();
					break;
				case "artist":
					this.renderArtist();
					break;
				case "releases":
					this.renderReleases();
					break;
			
			}

		}
	
	}

	updateQualityOptions() {

	}

	renderAlbum() {

	}

	renderArtist() {

	}

	renderReleases() {

	}

	updateProgress(progress) {

		this.state.currentProgress = progress;

		const currentProgressEl = document.querySelector(".queue-item .queue-status.loading");
		const currentProgressBar = document.querySelector(".queue-item .progress-fill");

		if(currentProgressEl && progress > 0) {

			currentProgressEl.textContent = `${progress}%`;
		
		}

		if(currentProgressBar) {

			currentProgressBar.style.width = `${progress}%`;
		
		}
	
	}

	updateQueue(data) {

		this.state.queueItems = data.items;
		this.state.currentTask = data.current;
		
		this.updateQueueDisplay();
		
		if(data.current?.status === "error") {

			this.showStatus(
				"mainStatus",
				`download failed: ${data.current.error}`,
				"error"
			);
		
		}
	
	}

	updateQueueDisplay() {

		const {
			queueItems, currentTask
		} = this.state;
		const allItems = currentTask ? [currentTask, ...queueItems] : queueItems;
		
		this.elements.queue.classList.toggle(
			"hidden",
			!allItems.length
		);
		
		if(allItems.length) {

			this.elements.queueList.innerHTML = allItems
			.map(item =>
				this.createQueueItemHTML(item))
			.join("");
		
		}
	
	}

	createQueueItemHTML(item) {

		const isDownloading = item.status === "loading";

		return `
			<div class="queue-item">
				<div class="queue-header">
					<div class="queue-info">
						<div class="queue-title">${item.title}</div>
					</div>
					<div class="queue-status ${item.status}">${isDownloading ? `${item.progress}%` : item.status}</div>
				</div>
				<div class="queue-progress">
					<div class="progress-fill" style="width: ${item.progress}%"></div>
				</div>
			</div>
		`;
	
	}

	setSettings() {

		this.sendMessage({
			type: "setSettings",
			settings: {
				quality: this.getQuality()
			}
		})
		.catch(err =>
			console.error(
				"set settings error",
				err
			));
	
	}

	getSettings() {

		return this.sendMessage({
			type: "getSettings"
		})
		.then(response => {

			const quality = response?.["settings"]?.quality;

			if(quality)
				this.setQuality(quality);
		
		})
		.catch(err =>
			console.error(
				"get settings error",
				err
			));
	
	}
	
	downloadAlbum() {

		this.sendMessage({
			type: "download",
			mediaType: "album",
			mediaId: this.currentMedia.id,
			quality: this.getQuality()
		})
		.then(res => {

			if(!res.ok) {

				this.showStatus(
					"mainStatus",
					res.error,
					"error"
				);
			
			}
		
		})
		.catch(err => {

			this.showStatus(
				"mainStatus",
				err,
				"error"
			);
		
		})
		.finally(() => {

			this.state.loading = null;
		
		});

	}

	downloadTrack(trackId) {

		this.sendMessage({
			type: "download",
			mediaType: "track",
			mediaId: +trackId,
			quality: this.getQuality()
		})
		.then(res => {

			if(!res.ok) {

				this.showStatus(
					"mainStatus",
					"download failed :" + res.error,
					"error"
				);
			
			}
		
		})
		.catch(err => {

			this.showStatus(
				"mainStatus",
				"download failed :" + err,
				"error"
			);
		
		});
	
	}

	sendMessage(message) {

		return new Promise((resolve, reject) => {

			browser.runtime.sendMessage(
				message,
				response => {

					if(browser.runtime.lastError) {

						reject(new Error(browser.runtime.lastError.message));
				
					}
					else {

						resolve(response);
				
					}
			
				}
			);
		
		});
	
	}

	showStatus(elementId, message, type) {

		const element = this.elements[elementId];

		if(!element)
			return;

		if(this.statusTimeouts.has(elementId)) {

			clearTimeout(this.statusTimeouts.get(elementId));
		
		}

		element.textContent = message;
		element.className = `status ${type}`;
		element.style.display = "block";
		
		if(type === "success") {

			const timeout = setTimeout(
				() => {

					element.style.display = "none";
					this.statusTimeouts.delete(elementId);
			
				},
				3000
			);

			this.statusTimeouts.set(
				elementId,
				timeout
			);
		
		}
	
	}

	clearStatus(elementId) {

		const element = this.elements[elementId];

		if(!element)
			return;

		if(this.statusTimeouts.has(elementId)) {

			clearTimeout(this.statusTimeouts.get(elementId));
			this.statusTimeouts.delete(elementId);
		
		}

		element.style.display = "none";
		element.textContent = "";
	
	}

	clearAllStatus() {

		this.statusTimeouts.forEach(timeout =>
			clearTimeout(timeout));
		this.statusTimeouts.clear();
		
		document.querySelectorAll(".status")
		.forEach(el => {

			el.style.display = "none";
			el.textContent = "";
		
		});
	
	}

	setQuality(quality) {

		const radio = document.querySelector(`input[value='${quality}']`);

		if(radio)
			radio.checked = true;
	
	}

	getQuality() {

		return document.querySelector("input[name='quality']:checked").value;
	
	}

}