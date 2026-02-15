import {browse, DEBUG} from "./vars.js";
import {Core} from "./core.js";

class OffscreenBase extends Core {

	constructor() {

		super();

		this.blobs = new Map();
		this.covrs = new Map();
	
	}

	handleMessage(msg) {

		switch(msg.type) {

			case "process":
				this.procs(msg);
				break;

			case "clear":
				this.clear(msg);
				break;

		}

	}
	
	procs(msg) {

		if(DEBUG)
			console.log(
				"process",
				msg
			);

		this.process(
			msg.dat,
			msg.metadata,
			msg.id,
			msg.cover
		)
		.then(url => {

			this.blobs.set(
				msg.id,
				url
			);

			const cvr = new Blob(
				[new Uint8Array(msg.cover.data).buffer],
				{
					type: msg.cover.type
				}
			);

			this.covrs.set(
				msg.id,
				cvr
						
			);

			browse.runtime.sendMessage({
				type: "complete",
				ok: true,
				id: msg.id,
				url: url,
				cvr: URL.createObjectURL(cvr)
			});
		
		})
		.catch(err => {

			console.error(
				"process error",
				err
			);

			// sendMessage "error"
		
			browse.runtime.sendMessage({
				type: "complete",
				ok: false,
				id: msg.id,
				error: err.message
			});
		
		});

	}

	async process(dat, metadata, messageId, cover) {

		// from child classes
		return Promise.resolve("");
	
	}

	clear(msg) {

		// single blobs Map for tracks & covers ?
		
		const taskId = msg.id;

		if(this.blobs.has(taskId)) {

			URL.revokeObjectURL(this.blobs.get(taskId));

			this.blobs.delete(taskId);

		}

		if(this.covrs.has(taskId)) {

			URL.revokeObjectURL(this.covrs.get(taskId));

			this.covrs.delete(taskId);

		}

	}

}

export {
	OffscreenBase
};
