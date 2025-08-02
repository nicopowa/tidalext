const browser = chrome;

class BasePopup {

	constructor() {

		this.auth = false;
		this.media = null;
		this.queue = [];
		this.current = [];

		this.elements = {};
		
		[
			"content", "nolink", "nomedia", "quality", "media", "mediainfo", "mediawrap", "medialist",
			"queue", "queuelist", "status"
		].forEach(id => {

			this.elements[id] = document.getElementById(id);
		
		});

		this.elements.quality
		.addEventListener(
			"change",
			() =>
				this.save()
		);

		browser.runtime.onMessage.addListener(this.handleMessage.bind(this));

		this.send("popup");

		// this.showStatus("this is a test");
	
	}

	handleMessage(msg) {

		switch(msg.type) {

			case "media":
				this.updateMedia(msg);
				break;

			case "sync":
				this.updateState(msg);
				break;

			case "progress":
				this.updateProgress(msg);
				break;
			
			case "queue":
				this.updateQueue(msg);
				break;

			case "error":
				this.showError(msg);
				break;

		}

	}

	updateMedia(msg) {

		this.media = msg.media;

		this.elements.media.classList.toggle(
			"hide",
			!this.media || !this.auth
		);

		this.elements.quality.classList.toggle(
			"hide",
			!this.media || !this.auth
		);

		this.elements.nomedia.classList.toggle(
			"hide",
			!!this.media || !this.auth
		);

		if(this.auth && this.media) {

			this.updateQualityOptions();

			switch(this.media.extype) {

				case "album":
					this.renderAlbum();
					break;
				case "artist":
					this.renderArtist();
					break;
				case "releases":
					this.renderReleases();
					break;
				// case "label":
				case "playlist":
					this.renderPlaylist();
					break;
				// search results
			
			}

		}
		else {

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

	renderPlaylist() {

	}

	updateProgress(msg) {

		const prg = msg.progress;

		const currentProgressEl = document.querySelector(".queue-item .queued.load");
		const currentProgressBar = document.querySelector(".queue-item .progress-fill");

		if(currentProgressEl && prg > 0) {

			currentProgressEl.textContent = `${prg}%`;
		
		}

		if(currentProgressBar) {

			currentProgressBar.style.width = `${prg}%`;
		
		}
	
	}

	updateQueue(data) {

		this.queue = data.items;
		this.current = data.current;
		
		this.updateQueueDisplay();
		
		if(data.current?.status === "error") {

			this.showStatus(
				`download failed: ${data.current.error}`,
				"error"
			);
		
		}
	
	}

	updateQueueDisplay() {

		const allItems = this.current ? [this.current, ...this.queue] : this.queue;
		
		this.elements.queue.classList.toggle(
			"hide",
			!allItems.length
		);
		
		if(allItems.length) {

			this.elements.queuelist.innerHTML = allItems
			.map(item =>
				this.createQueueItemHTML(item))
			.join("");
		
		}
	
	}

	createQueueItemHTML(item) {

		const isDownloading = item.status === "load";

		return `
			<div class="queue-item">
				<div class="queue-info">
					<div class="queue-title">${item.title}</div>
				</div>
				<div class="queued ${item.status}">${isDownloading ? `${item.progress}%` : item.status}</div>
				<div class="queue-progress">
					<div class="progress-fill" style="width: ${item.progress}%"></div>
				</div>
			</div>
		`;
	
	}

	save() {

		this.send(
			"save",
			{
				settings: {
					quality: this.getQuality()
				}
			}
		);
	
	}

	updateState(msg) {

		this.auth = msg.auth || false;

		this.setQuality(msg.settings.quality);

		this.elements.nolink.classList.toggle(
			"hide",
			!!this.auth
		);

		if(!this.auth) {

			const msgs = {
				"open": "open player",
				"swap": "jump to tab",
				"load": "refresh page"
			};

			this.elements.nolink.innerHTML = `<div id="unlinked">extension not linked</div>
				<div id="linker">${msgs[msg.need]}</div>`;

			document.querySelector("#linker")
			.addEventListener(
				"click",
				() =>
					this.send(
						"link",
						{
							how: msg.need
						}
					),
				{
					once: true
				}
			);

		}
	
	}

	downloadMedia(media) {

		this.send(
			"download",
			{
				mediaType: media.dataset.type,
				mediaId: media.dataset.id,
				quality: this.getQuality()
			}
		);

	}

	send(type, data) {

		browser.runtime.sendMessage({
			type: type,
			...data
		});
	
	}

	showError(msg) {

		this.showStatus(
			msg.error,
			"error"
		);
	
	}

	showStatus(msg, type = "info") {

		let elt = document.createElement("div");

		elt.className = `msg ${type}`;

		const cnt = document.createElement("div");

		cnt.className = "cnt";

		cnt.textContent = msg;
		elt.append(cnt);

		const dis = document.createElement("div");

		dis.className = "dis";

		dis.addEventListener(
			"click",
			() =>
				elt.remove(),
			{
				once: true
			}
		);

		elt.append(dis);

		this.elements.status.append(elt);

		/*setTimeout(
			() => {

				if(elt.parentNode)
					elt.remove();

				elt = null;
			
			},
			8000
		);*/
	
	}

	setQuality(quality) {

		if(!quality)
			return;

		const radio = document.querySelector(`input[value='${quality}']`);

		if(radio)
			radio.checked = true;
	
	}

	getQuality() {

		return document.querySelector("input[name='quality']:checked").value;
	
	}

}