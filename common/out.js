import {browse, DEBUG} from "./vars.js";

const Mode = {
	OFFSCREEN: 0,
	HIDDENTAB: 1
};

class Offscreen {

	constructor() {
		
		this.mode = "";
		this.tabId = null;

	}

	async ensure(url) {

		if(DEBUG)
			console.log("off open");

		if(browse.offscreen)
			await this.ensureOffscreen(url);
		else
			await this.ensureHiddenTab(url);

	}

	async ensureOffscreen(url) {

		const contexts = await browse.runtime.getContexts({
			contextTypes: ["OFFSCREEN_DOCUMENT"]
		});

		if(!contexts.length) {

			await browse.offscreen.createDocument({
				url: browse.runtime.getURL(url),
				reasons: ["BLOBS"],
				justification: "NONE"
			});
		
		}

		this.mode = Mode.OFFSCREEN;

	}

	async ensureHiddenTab(url) {

		if(this.tabId) {

			try {

				await browse.tabs.get(this.tabId);
				this.mode = Mode.HIDDENTAB;

				return;
			
			}
			catch{

				this.tabId = null;
			
			}
		
		}

		const tab = await browse.tabs.create({
			url: browse.runtime.getURL(url),
			active: false
		});

		await browse.tabs.hide(tab.id);

		this.tabId = tab.id;
		this.mode = Mode.HIDDENTAB;
	
	}

	async post(msg) {

		if(this.mode === Mode.OFFSCREEN)
			browse.runtime.sendMessage(msg);
		else if(this.mode === Mode.HIDDENTAB)
			browse.tabs.sendMessage(
				this.tabId,
				msg
			);

	}

	async close() {

		if(DEBUG)
			console.log("off kill");

		if(this.mode === Mode.OFFSCREEN)
			await browse.offscreen.closeDocument();
		else if(this.mode === Mode.HIDDENTAB && this.tabId)
			await browse.tabs.remove(this.tabId);

		this.mode = "";
		this.tabId = null;

	}

}

export {
	Offscreen
};
