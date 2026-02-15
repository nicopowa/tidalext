import { browse, DEBUG } from "./vars.js";

class Core {

	constructor() {

		browse.runtime.onMessage.addListener(this.handleMessage.bind(this));
	
	}

	handleMessage(msg) {
		
	}

}

class Stor {

	constructor(mapping) {

		this._map = mapping;
		this._cache = {};

		for(const prop in mapping) {

			const key = mapping[prop];

			Object.defineProperty(
				this,
				prop,
				{
					get: () =>
						this._cache[key],

					set: val => {

						this._cache[key] = val;
						browse.storage.local.set({
							[key]: val
						});
					
					}
				}
			);
		
		}
	
	}

	async init() {

		const keys = Object.values(this._map);
		const itms = await browse.storage.local.get(keys);

		this._cache = itms;

		return this;
	
	}

}

export {
	Core,
	Stor
};