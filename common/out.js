import {browse} from "./vars.js";

const Mode = {
	OFFSCREEN: 0,
	HIDDENTAB: 1
};

class Offscreen {

	constructor() {
		
		this.mode = "";
		this.tabId = null;

	}

	async ensureOffscreen(url) {

		const contexts = await browse.runtime.getContexts({
			contextTypes: ["OFFSCREEN_DOCUMENT"]
		});

		if(!contexts.length) {

			await browse.offscreen.createDocument({
				url: browse.runtime.getURL(url),
				reasons: ["BLOBS"],
				justification: "no more"
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

	async ensure(url) {

		if(browse.offscreen && browse.runtime.getContexts)
			await this.ensureOffscreen(url);
		else
			await this.ensureHiddenTab(url);

	}

	async post(message) {

		if(this.mode === Mode.OFFSCREEN)
			browse.runtime.sendMessage(message);
		else if(this.mode === Mode.HIDDENTAB)
			browse.tabs.sendMessage(
				this.tabId,
				message
			);

	}

	async close() {

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
