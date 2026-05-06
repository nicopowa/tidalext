import { browse, Dats } from "./vars.js";
import { Datx } from "../popped.js";

class Core {

	constructor() {

		/** @type {?} */
		this.store = new Stor({
			...Dats,
			...Datx
		});

		browse.runtime.onMessage.addListener(this.handleMessage.bind(this));

	}

	async liftoff() {

		await this.store.init(this.storeUpdated.bind(this));

	}

	handleMessage(msg, src) {
		
	}

	storeUpdated() {
		
	}

}

class Stor {

	constructor(mapping) {

		this._map = mapping;
		this._cache = {};
		this._syncd = null;

		Object.entries(this._map)
		.forEach(([key, val]) => {

			Object.defineProperty(
				this,
				key,
				{
					get: () => {

						return this._cache[key];
					
					},
					set: v => {

						this._cache[key] = v;

						browse.storage.local.set({
							[val]: v
						});
					
					}
				}
			);

		});
	
	}

	async init(syncd) {

		this._syncd = syncd || (() => {});

		await this.sync();

		browse.storage.onChanged.addListener(this.sync.bind(this));

		return this;
	
	}

	sync(evt = {}) {

		return browse.storage.local
		.get(Object.values(this._map))
		.then(vals =>
			Object.entries(this._map)
			.forEach(([key, val]) =>
				(this._cache[key] = vals[val])))
		.then(() =>
			this._syncd());
	
	}

	get data() {

		return this._cache;
	
	}

}

export {
	Core,
	Stor
};