import {BasePopup} from "./common/pops.js";

class TidalPopup extends BasePopup {

	constructor() {

		super();

		this.showCovers = false;
	
	}

	updateQualityOptions() {

		if(this.media.extype !== "album") {

			return;
		
		}

		const currentQuality = this.media.mediaMetadata.tags;

		document.querySelectorAll("input[name='quality']")
		.forEach(qualityRadio => {

			const hasQuality = currentQuality.includes(qualityRadio.value);

			qualityRadio.disabled = !hasQuality;

		});
	
	}

	renderAlbum() {

		const cover = this.media.cover.replaceAll(
			"-",
			"/"
		);

		this.elements.mediainfo.innerHTML = `
				${this.showCovers ? `<div class="album-cover">
					<img src="https://resources.tidal.com/images/${cover}/640x640.jpg"/>
				</div>` : ""}
				<div class="album-info">
					<div class="album-title">${this.media.title}</div>
					<div class="album-artist">${this.media.artists[0].name}</div>
					<div class="album-year">${new Date(this.media.releaseDate)
	.getFullYear()}</div>
				</div>
				<button class="album-download download-btn" data-type="album" data-id="${this.media.id}"></button>
			`;

		const showList = this.media?.numberOfTracks > 0;
		
		this.elements.mediawrap.classList.toggle(
			"hide",
			!showList
		);
		
		if(showList) {

			this.elements.medialist.innerHTML = this.media.tracks
			.map(track =>
				this.createTrackItemHTML(track))
			.join("");
		
		}

		this.elements.media.querySelectorAll(".download-btn")
		.forEach(btn =>
			btn.addEventListener(
				"click",
				evt =>
					this.downloadMedia(evt.target)
			));

	}

	renderArtist() {

		const cover = (this.media.item.data?.picture || "").replaceAll(
			"-",
			"/"
		);
		
		this.elements.mediainfo.innerHTML = `
				${this.showCovers ? `<div class="artist-cover">
					<img src="https://resources.tidal.com/images/${cover}/750x750.jpg"/>
				</div>` : ""}
				<div class="artist-info">
					<div class="artist-name">${this.media.item.data.name}</div>
				</div>
			`;

		this.elements.mediawrap.classList.remove(
			"hide"
		);

		const releases = this.media.items.filter(item =>
			["ARTIST_ALBUMS", "ARTIST_TOP_SINGLES"].includes(item.moduleId))
		.map(item =>
			item.items.map(idem =>
				idem.data))
		.flat();

		this.elements.medialist.innerHTML = releases
		.map(release =>
			this.createReleaseItemHTML(release))
		.join("");

		this.elements.media.querySelectorAll(".download-btn")
		.forEach(btn =>
			btn.addEventListener(
				"click",
				evt =>
					this.downloadMedia(evt.target)
			));

	}

	renderReleases() {

	}

	createTrackItemHTML(track) {

		return `
			<div class="mediaitem">
				<div class="track-number">${track.trackNumber || "—"}</div>
				<div class="track-info">
					<div class="track-title">${track.title}${track.version ? ` (${track.version})` : ""}</div>
					<div class="track-artist">${track.artists[0].name}</div>
				</div>
				<button class="track-download download-btn" data-type="track" data-id="${track.id}"${track.allowStreaming ? "" : " disabled"}></button>
			</div>
		`;
	
	}

	createReleaseItemHTML(release) {

		return `
			<div class="mediaitem">
				${this.showCovers ? `<div class="release-cover">
					<img src="https://resources.tidal.com/images/${release.cover}/640x640.jpg"/>
				</div>` : ""}
				<div class="release-info">
					<div class="release-title">${release.title}${release.version ? ` (${release.version})` : ""}</div>
					<div class="release-data">
						<div class="release-year">${new Date(release.releaseDate).getFullYear()}</div>
						<div class="release-label" data-id="${0}">${release.copyright.replace(/\(c\)\s\d{4}\s/gi, "")}</div>
					</div>
					<div class="release-about">${release.type.toLowerCase()} - ${release.numberOfTracks} track${release.numberOfTracks !== 1 ? "s" : ""}</div>
				</div>
				<button class="release-download download-btn" data-type="release" data-id="${release.id}" ${release.allowStreaming ? "" : " disabled"}></button>
			</div>
		`;
	
	}

}

window.addEventListener(
	"load",
	() =>
		new TidalPopup()
);