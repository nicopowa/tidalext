import {browse, DEBUG} from "./vars.js";

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

		this.mode = "offscreen";

	}

	async ensureHiddenTab(url) {

		if(this.tabId) {

			try {

				await browse.tabs.get(this.tabId);
				this.mode = "hiddentab";

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
		this.mode = "hiddentab";
	
	}

	async ensure(url) {

		if(browse.offscreen && browse.runtime.getContexts)
			await this.ensureOffscreen(url);
		else
			await this.ensureHiddenTab(url);

	}

	async post(message) {

		if(this.mode === "offscreen")
			browse.runtime.sendMessage(message);
		else if(this.mode === "hiddentab")
			browse.tabs.sendMessage(
				this.tabId,
				message
			);

	}

	async close() {

		if(this.mode === "offscreen")
			await browse.offscreen.closeDocument();
		else if(this.mode === "hiddentab" && this.tabId)
			await browse.tabs.remove(this.tabId);

		this.mode = "";
		this.tabId = null;

	}

}

export {
	Offscreen
};

