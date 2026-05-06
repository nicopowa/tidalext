import {browse, DEBUG, Msg} from "./vars.js";
import {AudioProcessor} from "../proc.audio.js";

class ExtOff {

	constructor() {

		if(DEBUG)
			console.log("off we go");

		browse.runtime.onMessage.addListener(this.handleMessage.bind(this));

		this.blobs = new Map();
		this.covrs = new Map();

	}

	handleMessage(msg) {

		switch(msg.type) {

			case Msg.PROCESS:
				this.procs(msg);
				break;

			case Msg.CLEAR:
				this.clear(msg);
				break;

		}

	}

	send(typ, dat = {}) {

		browse.runtime.sendMessage({
			type: typ,
			...dat
		});
	
	}

	procs(msg) {

		if(DEBUG)
			console.log(
				"process",
				msg
			);

		const proc = new AudioProcessor();

		proc.process(
			msg.dat,
			msg.meta,
			msg.id,
			msg.cover,
			msg.rules,
			msg.opts
		)
		.then(url => {

			this.blobs.set(
				msg.id,
				url
			);

			let cvr = null;

			if(msg.rules.art) {

				cvr = URL.createObjectURL(new Blob(
					[new Uint8Array(msg.cover.data)],
					{
						type: msg.cover.type
					}
				));

				this.covrs.set(
					msg.id,
					cvr
				);
			
			}

			this.send(
				Msg.COMPLETE,
				{
					ok: true,
					id: msg.id,
					url,
					cvr
				}
			);

		})
		.catch(err => {

			//console.error("process error",err);

			this.send(
				Msg.COMPLETE,
				{
					ok: false,
					id: msg.id,
					error: "offscreen error " + err
				}
			);

		});

	}

	clear(msg) {

		const taskId = msg.id;

		if(this.blobs.has(taskId)) {

			if(DEBUG)
				console.log(
					"revoke audio",
					taskId
				);

			URL.revokeObjectURL(this.blobs.get(taskId));
			this.blobs.delete(taskId);

		}

		if(this.covrs.has(taskId)) {

			if(DEBUG)
				console.log(
					"revoke cover",
					taskId
				);

			URL.revokeObjectURL(this.covrs.get(taskId));
			this.covrs.delete(taskId);

		}

	}

}

export {
	ExtOff
};