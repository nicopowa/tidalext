import {browser, DEBUG} from "./vars.js";

class BasePopup {

	constructor() {

		this.auth = false;
		this.media = null;
		this.queue = [];

		this.elements = {};
		
		["musicext", "content", "nolink", "nomedia", "quality", "media", "mediainfo", "mediawrap", "medialist", "queue", "queuelist", "status"].forEach(id =>
			(this.elements[id] = document.getElementById(id)));

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

		const queueItem = document.querySelector(`.queue-item[data-task="${msg.task}"]`);

		if(queueItem) {

			queueItem.querySelector(".queued").textContent
			= queueItem.querySelector(".progress-fill").style.width
			= `${msg.progress}%`;

		}
	
	}

	updateQueue(data) {

		this.queue = data.items;

		this.elements.queue.classList.toggle(
			"hide",
			!this.queue.length
		);
		
		this.elements.queuelist.innerHTML = this.queue
		.map(item =>
			this.createQueueItemHTML(item))
		.join("");
	
	}

	createQueueItemHTML(item) {

		return `
			<div class="queue-item" data-task="${item.id}">
				<div class="queue-info">
					<div class="track-title">${item.infos.title}</div>
					<div class="track-artist">${item.infos.artist}</div>
				</div>
				<div class="queued ${item.status}">${item.status === "load" ? `${item.progress}%` : item.status}</div>
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

			this.elements.nolink.innerHTML = `<div id="unlinked">not linked</div>
				<div id="linker">${msgs[msg.need]}</div>`;

			document.querySelector("#linker")
			.addEventListener(
				"click",
				() => {

					this.elements.nolink.innerHTML = "<div id=\"unlinked\">linking ...</div>";

					this.send(
						"link",
						{
							how: msg.need
						}
					);
				
				},
				{
					once: true
				}
			);

		}

		if(msg.next)
			this.elements.musicext.classList.add("next");
	
	}

	downloadMedia(media) {

		this.send(
			"download",
			{
				mediaType: media.dataset.type,
				mediaId: media.dataset.id
			}
		);

	}

	send(type, data) {

		if(DEBUG)
			console.log(
				"pop send",
				type
			);

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

		setTimeout(
			() => {

				if(elt.parentNode)
					elt.remove();

				elt = null;
			
			},
			7500
		);
	
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

export {
	BasePopup
};