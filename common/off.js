const browser = chrome;

class BaseOffscreenProcessor {

	constructor() {

		this.blobs = new Map();
		
		browser.runtime.onMessage.addListener(this.handleMessage.bind(this));
	
	}

	handleMessage(msg) {

		switch(msg.type) {

			case "processStream":
				this.handleProcessing(msg);
				break;

			case "clearStream":
				this.clearStream(msg);
				break;

		}

	}
	
	handleProcessing(msg) {

		this.process(
			msg.dat,
			msg.metadata,
			msg.id,
			msg.cover
		)
		.then(url => {

			this.blobs.set(msg.id, url);

			browser.runtime.sendMessage({
				type: "streamComplete",
				ok: true,
				id: msg.id,
				url: url
			});
		
		})
		.catch(err => {

			console.error(
				"processing error:",
				err
			);
		
			browser.runtime.sendMessage({
				type: "streamComplete",
				ok: false,
				id: msg.id,
				error: err.message
			});
		
		});

	}

	clearStream(msg) {

		const taskId = msg.id;

		if(this.blobs.has(taskId)) {

			console.log("clear", taskId);

			URL.revokeObjectURL(this.blobs.get(taskId));

			this.blobs.delete(taskId);

		}

	}

}