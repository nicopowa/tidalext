import { browse } from "./vars.js";

class Util {

	static get where() {

		if(typeof ServiceWorkerGlobalScope !== "undefined" && self instanceof ServiceWorkerGlobalScope)
			return "bck";

		if(typeof window !== "undefined" && window.location.protocol !== "chrome-extension:")
			return "cnt";

		if(typeof browse.tabs === "undefined" && typeof browse.action === "undefined")
			return "off";

		if(window.opener || (window.outerWidth <= 600 && window.outerHeight <= 600))
			return "pop";
	
		return "ext";

	}

	static get manifest() {

		return browse.runtime.getManifest();

	}

}

const deep = (obj1, obj2) =>
	({
		...obj1,
		...Object.keys(obj2)
		.reduce(
			(acc, key) => {

				const val1 = obj1[key];
				const val2 = obj2[key];

				// contat arrays
				if(Array.isArray(val1) && Array.isArray(val2)) {

					acc[key] = [...val1, ...val2];
				
				}
				// merge objects & recurse
				else if(
					val1
            && typeof val2 === "object"
            && val2 !== null // safety check
            && !Array.isArray(val2)
				) {

					acc[key] = deep(
						val1,
						val2
					);
				
				}
				// overwrite with new value
				else {

					acc[key] = val2;
				
				}

				return acc;
			
			},
			{}
		)
	});

const wait = (ms = 0) => {

	if(!ms)
		ms = Math.round(234 + Math.sign(Math.random() - .5) * Math.random() * 123);

	return new Promise(thenWhat =>
		setTimeout(
			thenWhat,
			ms
		));

};

export {
	Util, deep, wait
};
