import { OffscreenBase } from "./common/off.js";
import { DashProcessor } from "./proc.dash.js";

class TidalOffscreen extends OffscreenBase {

	constructor() {

		super();

		this.dashProcessor = new DashProcessor();
	
	}

	async process(dat, metadata, messageId, cover) {

		return await this.dashProcessor.process(
			dat,
			metadata,
			messageId,
			cover
		);

	}

}

export {
	TidalOffscreen
};