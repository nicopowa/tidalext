const browser = chrome;

class BaseOffscreenProcessor {

	constructor() {

		this.setupMessageHandlers();
	
	}
	
	setupMessageHandlers() {

		browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

			if(message.action === "processStream") {

				this.handleProcessing(message);
			
			}
		
		});
	
	}
	
	handleProcessing(message) {

		this.process(
			message.fetchUrl,
			message.metadata,
			message.id,
			message.cover
		)
		.then(url => {

			browser.runtime.sendMessage({
				type: "streamComplete",
				ok: true,
				id: message.id,
				url: url
			});

			setTimeout(
				() => {

					URL.revokeObjectURL(url);
				
				},
				3456
			);
		
		})
		.catch(err => {

			console.error(
				"processing error:",
				err
			);
		
			browser.runtime.sendMessage({
				type: "streamComplete",
				ok: false,
				id: message.id,
				error: err.message
			});
		
		});

	}

}