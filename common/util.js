import { browse } from "./vars.js";

class Util {

	static get where() {

		if(typeof ServiceWorkerGlobalScope !== "undefined")
			return "bck";

		try {

			if(browse.extension.getBackgroundPage() === window)
				return "bck";
		
		}
		catch(e) {}

		if(typeof location !== "undefined" && !/^(chr|moz)/.test(location.protocol))
			return "cnt";

		return location.pathname.match(/\/(\w+).html/)[1];

	}

	/**
	 * @return {chrome.runtime.ManifestV3}
	 */
	static get manifest() {

		return browse.runtime.getManifest();

	}

	static wait(ms = 1) {

		ms = Math.round(ms + Math.sign(Math.random() - .5) * Math.random() * ms * .3);

		return new Promise(thenWhat =>
			setTimeout(
				thenWhat,
				ms
			));

	}

	static deep(obj1, obj2) {

		return {
			...obj1,
			...Object.keys(obj2)
			.reduce(
				(acc, key) => {

					const val1 = obj1[key];
					const val2 = obj2[key];

					if(Array.isArray(val1) && Array.isArray(val2))
						acc[key] = [...val1, ...val2];
					else if(
						val1
						&& typeof val2 === "object"
						&& val2 !== null // safety check
						&& !Array.isArray(val2)
					)
						acc[key] = Util.deep(
							val1,
							val2
						);
					else
						acc[key] = val2;

					return acc;
			
				},
				{}
			)
		};

	}

	static save(dat, nnm) {

		return browse.downloads.download({
			url: dat,
			filename: nnm,
			saveAs: false, // Edge Chromium 146 dialog bug
			conflictAction: "overwrite"
		});
	
	}

	static clamp(val, min = 0, max = 100) {

		return Math
		.max(
			Math
			.min(
				max,
				val
			),
			min
		);

	}

	static uniqid(arr) {

		const see = new Set();

		return arr.filter(itm =>
			!see.has(itm.id) && see.add(itm.id));

	}

	static headerValue(headerList, headerName) {

		return headerList.find(reqHeader =>
			reqHeader.name === headerName)?.value;
	
	}

	static sep(strs) {

		return [strs].flat()
		.filter(Boolean)
		.join(" • ");
	
	}

	static timed(seconds, short = true, sep = " ", locale = "en"/*navigator.language*/) {

		const s = Math.abs(seconds);

		return [
			{
				unit: "day", val: Math.floor(s / 86400)
			},
			{
				unit: "hour", val: Math.floor((s / 3600) % 24)
			},
			{
				unit: "minute", val: Math.floor((s / 60) % 60)
			},
			{
				unit: "second", val: Math.floor(s % 60)
			}
		]
		.filter(x =>
			x.val > 0)
		.map(({
			unit, val
		}, i) =>
			new Intl.NumberFormat(
				locale,
				{
					style: "unit",
					unit,
					unitDisplay: short ? "narrow" : "long",
					minimumIntegerDigits: i === 0 ? 1 : 2
				}
			)
			.format(val))
		.join(sep);

	}

	static typed(wut, typ) {

		return wut.map(w =>
			({
				...w, extype: typ
			}));
	
	}

	static times(itms) {

		return Util.timed(itms.reduce(
			(sec, cur) =>
				sec + cur.duration,
			0
		));
	
	}

	static sumup(itms, key) {

		return itms.reduce(
			(sec, cur) =>
				sec + cur[key],
			0
		);
	
	}

	static counts(len, str, cnt = -1) {

		return `${len} ${cnt !== -1 && len < cnt ? `/ ${cnt}` : ""} ${str}${len != 1 ? "s" : ""}`;
	
	}

	static counting(lst, key, str, cnt = -1) {

		return Util.counts(
			Util.sumup(
				lst,
				key
			),
			str,
			cnt
		);
	
	}

	static doom(doomed) {

		return `${doomed ? "scroll down for more" : "parsing complete"}`;
	
	}

}

class Dom {

	static uis(obj) {

		return Object.entries(obj)
		.reduce(
			(ui, [elt, uid]) =>
				({
					...ui,
					[elt]: Dom.bid(uid)
				}),
			{}
		);
	
	}

	static bid(sel) {

		return /** @type {!HTMLElement} */(document.getElementById(sel));
	
	}

	static qry(sel, par = document) {

		return par.querySelector(sel);
	
	}

	static all(sel, par = document) {

		return Array.from(par.querySelectorAll(sel));
	
	}

	/**
	 * @param {string} sel
	 * @param {!Function=} cbk 
	 */
	static sel(sel, cbk) {

		const elt = /** @type {!Element} */(Dom.qry(
			document,
			"#" + sel
		));

		if(cbk)
			elt.addEventListener(
				"click",
				cbk
			);

		return elt;

	}

	static gen(elt, par = null, cnt = "") {

		const el = document.createElement(elt);

		if(cnt)
			el.textContent = cnt;

		if(par)
			par.append(el);

		return el;
	
	}

	static elt(cls = "", par = null, cnt = "", clk = null) {

		const elt = Dom.gen(
			"div",
			par,
			cnt
		);

		if(cls)
			elt.className = cls;

		if(clk)
			elt.addEventListener(
				"click",
				clk
			);

		return elt;
	
	}

	static cls(el, cl) {

		[el].flat()
		.forEach(e =>
			e.classList.add(cl));
	
	}

	static clx(el, cl) {

		[el].flat()
		.forEach(e =>
			e.classList.remove(cl));
	
	}

	/**
	 * @param {*} el
	 * @param {*} cl 
	 * @param {boolean=} fr  
	 */
	static clt(el, cl, fr) {

		[el].flat()
		.forEach(e =>
			e.classList.toggle(
				cl,
				fr
			));
	
	}

	static clh(el, cl) {

		return el.classList.contains(cl);
	
	}

	static on(elt, typ, cbk, and = false) {

		[elt].flat()
		.forEach(el =>
			typ.split(" ")
			.forEach(ev =>
				el.addEventListener(
					ev,
					cbk,
					and
				)));

	}

	static once(elt, typ, cbk) {

		Dom.on(
			elt,
			typ,
			cbk,
			{
				once: true
			}
		);

	}

}

export {
	Util,
	Dom
};
