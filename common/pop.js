import {browse, DEBUG, Msg, Stat, Opts, Dats} from "./vars.js";
import {Core} from "./core.js";
import {Util, Dom} from "./util.js";
import {Types, Optx, Datx, Heads, Items, Help} from "../popped.js";

class ExtPop extends Core {

	constructor() {

		super();

		this.media = null;

		this.ui = /** @type {?} */(Dom.uis({
			musicext: "musicext",
			extlink: "extlink",
			extname: "extname",
			extver: "extver",
			stats: "status",
			content: "content",
			optsbtn: "optsbtn",
			optwrap: "optwrap",
			options: "options",
			subs: "subs",
			nolink: "nolink",
			unlink: "unlink",
			linker: "linker",
			nomedia: "nomedia",
			media: "media",
			mediainfo: "mediainfo",
			mediawrap: "mediawrap",
			medialist: "medialist",
			queue: "queue",
			queuebtn: "queuebtn",
			queuelist: "queuelist"
		}));

		const extname = Util.manifest.name;

		this.ui.extlink.href += extname.toLowerCase();
		this.ui.extname.innerText = extname;
		this.ui.extver.innerText = Util.manifest.version;

		//this.showStatus("this is a test");
	
	}

	/**
	 * @override
	 */
	async liftoff() {

		await super.liftoff();

		this.handleOptions();
		this.handleEvents();
		this.send(Msg.POPUP);
	
	}

	handleOptions() {

		const dats = {
			...Dats,
			...Datx
		};

		const opts = Util.deep(
			Opts,
			Optx
		);

		Object.entries(dats)
		.filter(([key, val]) =>
			opts[val] ? !opts[val].hide : true)
		.forEach(([key, val]) => {

			if(!Object.hasOwn(
				opts,
				val
			))
				return;

			const optwrap = Dom.elt(
				"opt",
				this.ui.options
			);

			const optdesc = Dom.gen(
				"span",
				optwrap
			);

			optdesc.innerHTML = opts[val].desc;

			const optform = Dom.elt(
				"choose",
				optwrap
			);

			Dom.on(
				optform,
				"change",
				() => {

					let v = Dom.qry(
						"input:checked",
						optform
					).value;

					try {

						v = JSON.parse(v);

					}
					catch(e) {}

					this.store[key] = v;
				
				}
			);

			optform.id = val;

			const cfg = opts[val];

			cfg.disp.forEach((txt, i) => {

				const lbl = Dom.gen(
					"label",
					optform
				);

				const inp = Dom.gen(
					"input",
					lbl
				);

				inp.type = "radio";
				inp.name = val;

				const v = cfg.vals[i];

				inp.value = v;

				if(v === this.store[key])
					inp.checked = true;

				Dom.gen(
					"span",
					lbl,
					txt
				);
			
			});
		
		});

		Dom.on(
			this.ui.optsbtn,
			"click",
			() =>
				this.toggleOptions()
		);

	}

	toggleOptions() {

		Dom.clt(
			this.ui.optsbtn,
			"disp"
		);
		Dom.clt(
			[this.ui.content, this.ui.optwrap],
			"hide"
		);
	
	}

	handleEvents() {

		Dom.on(
			this.ui.media,
			"click",
			this.mediaClick.bind(this)
		);

		Dom.on(
			this.ui.queuebtn,
			"click",
			() =>
				this.send(Msg.TOGGLE)
		);

		Dom.on(
			this.ui.queuelist,
			"click",
			this.queueClick.bind(this)
		);
	
	}

	/**
	 * @override
	 */
	handleMessage(msg) {

		//console.log(msg);

		switch(msg.type) {

			case Msg.SYNC:
				this.updateState(msg);
				break;
			
			case Msg.QUEUE:
			case Msg.PROGRESS:
				this.syncQueue(msg);
				break;

			case Msg.ERROR:
				this.showError(msg);
				break;

		}

	}

	updateMedia(msg) {

		this.media = msg.media;

		//console.log("up", this.media);

		Dom.cls(
			this.ui.nolink,
			"hide"
		);

		Dom.clt(
			this.ui.media,
			"hide",
			!this.media
		);

		Dom.clt(
			this.ui.nomedia,
			"hide",
			!!this.media
		);

		if(this.media) {

			this.renderHeads();

			this.renderItems();

		}
	
	}

	renderHeads() {

		this.ui.mediainfo.replaceChildren(
			this.renderItem(
				this.media,
				...Heads[this.media.extype](this.media)
			)
		);
	
	}

	renderItems() {

		const def = [
			null, "{item name}", "{item subs}", "{item meta}", false, -1, "items"
		];

		this.ui.medialist.replaceChildren(
			...this.media.lst.map((itm, idx) =>
				Items[itm.extype](
					itm,
					idx,
					this.media
				))
			.map(dat =>
				this.renderItem(
					...dat,
					...def.slice(dat.length)
				))
		);
	
	}

	renderItem(item, main, subs, meta, shop, indx = -1, deep = "media") {

		const typ = item.extype;

		const mediaItem = Dom.elt("media-item media-" + typ);

		mediaItem.dataset.type = typ;
		mediaItem.dataset.id = item.id;

		if(DEBUG)
			Dom.elt(
				"media-id",
				mediaItem,
				"media-id"
			);

		if(indx != -1)
			Dom.elt(
				"media-indx",
				mediaItem,
				indx + 1
			);

		if(this.store.pics && deep === "items" && [Types.ALBUM, Types.PLAYLIST].includes(typ)) {

			const pic = Dom.elt(
				"media-covr",
				mediaItem
			);

			pic.style.backgroundImage = `url(${Help.cover(item)})`;
		
		}

		const mediaInfo = Dom.elt(
			"media-info",
			mediaItem
		);

		Dom.elt(
			"media-main",
			mediaInfo,
			`${Util.sep(main)}`
		);

		Dom.elt(
			"media-subs",
			mediaInfo,
			Util.sep(subs)
		);

		Dom.elt(
			"media-meta",
			mediaInfo,
			Util.sep(meta)
		);

		const btn = Dom.gen(
			"button",
			mediaItem
		);

		btn.className = `dl-${deep} dl-btn${shop ? "" : " nope"}`;

		return mediaItem;
		
	}

	syncQueue(dat) {

		const sts = dat.sts;

		let queueItem = Dom.qry(
			`.queue-item[data-id="${dat.id}"]`,
			this.ui.queue
		);

		if(!queueItem && sts === Stat.WAIT) {

			this.createQueueItem(dat);
			queueItem = Dom.qry(
				`.queue-item[data-id="${dat.id}"]`,
				this.ui.queue
			);
		
		}

		if(queueItem) {

			const stat = Dom.qry(
				".queued",
				queueItem
			);

			stat.className = "queued " + sts;
			stat.textContent = sts;

			if(sts === Stat.LOAD) {

				const prg = dat.progress;

				if(prg) {

					Dom.qry(
						".queued",
						queueItem
					).textContent = `${prg}%`;
					
					Dom.qry(
						".queue-fill",
						queueItem
					).style.width = `${prg}%`;
				
				}

			}
			else if(sts === Stat.DONE) {

				setTimeout(
					() =>
						queueItem.remove(),
					321
				);
			
			}

		}
	
	}

	createQueueItem(item) {

		const queueItem = Dom.elt(
			"queue-item",
			this.ui.queuelist
		);

		queueItem.dataset.id = item.id;

		const queueInfo = Dom.elt(
			"queue-info media-info",
			queueItem
		);

		Dom.elt(
			"media-subs",
			queueInfo,
			item.infos.title
		);

		Dom.elt(
			"media-meta",
			queueInfo,
			item.infos.artist
		);

		Dom.elt(
			"queued " + item.sts,
			queueItem,
			item.status === Stat.LOAD ? `${item.progress}%` : item.sts
		);

		const queueProg = Dom.elt(
			"queue-prog",
			queueItem
		);

		const queueFill = Dom.elt(
			"queue-fill",
			queueProg
		);

		queueFill.style.width = `${item.progress}%`;

		Dom.elt(
			"queue-rm",
			queueItem
		);

	}

	updateState(msg) {

		if(msg.media)
			this.updateMedia(msg);
		else
			this.linkPlease(msg.actv ? "load" : msg.last ? "swap" : "open");

		if(msg.queuePaused !== undefined) {

			this.ui.queuebtn.innerText = msg.queuePaused ? "resume" : "pause";
		
		}

		this.ui.queuelist.replaceChildren();

		msg.queue.forEach(item =>
			this.createQueueItem(item));

		this.updateSubs(this.store.user);

		if(msg.next)
			Dom.cls(
				this.ui.musicext,
				"next"
			);
	
	}

	/**
	 * @param {Subscription} subs
	 */
	updateSubs(subs) {

		let subd = "";

		if(subs.yes) {

			subd = `${subs.typ.toLowerCase()}${subs.cnc ? " • cancelled" : ""} • ${subs.cnc ? "ends" : "renews"} ${new Date(subs.end)
			.toLocaleDateString()}`;
		
		}
		else {
			// active subscription required
		}

		this.ui.subs.innerText = subd;
	
	}

	linkPlease(what) {

		if(DEBUG)
			console.log(
				"link",
				what
			);

		Dom.clx(
			[this.ui.nolink, this.ui.linker],
			"hide"
		);

		const msgs = {
			"open": "open player",
			"swap": "jump to tab",
			"load": "refresh page"
		};

		this.ui.unlink.innerText = "not linked";
		this.ui.linker.innerText = msgs[what];

		Dom.once(
			this.ui.linker,
			"click",
			() => {

				this.ui.unlink.innerText = "linking ...";
				
				Dom.cls(
					this.ui.linker,
					"hide"
				);

				this.send(
					Msg.LINK,
					{
						how: what
					}
				);
				
			}
		);

	}

	mediaClick(evt) {

		const tgt = evt.target;

		const mediaItem = tgt.closest(".media-item");

		if(mediaItem) {

			const dat = {
				mediaType: mediaItem.dataset.type,
				mediaId: mediaItem.dataset.id
			};

			if(Dom.clh(
				tgt,
				"dl-btn"
			)) {

				this.send(
					Msg.DOWNLOAD,
					dat
				);

			}
			else if(Dom.clh(
				tgt,
				"media-main"
			)) {

				this.send(
					Msg.CLICKED,
					dat
				);

			}

		}
	
	}

	queueClick(evt) {

		const tgt = evt.target;

		const queueItem = tgt.closest(".queue-item");

		if(queueItem) {

			if(Dom.clh(
				tgt,
				"queue-rm"
			)) {

				const itemId = +queueItem.dataset.id;

				queueItem.remove();

				this.send(
					Msg.CANCEL,
					{
						id: itemId
					}
				);

			}

		}
	
	}

	send(type, data = {}) {

		browse.runtime.sendMessage({
			type: type,
			...data
		});
	
	}

	showError(msg) {

		this.showStatus(
			msg.error,
			"error"
		);
	
	}

	showStatus(msg, typ = "info") {

		let wrp = Dom.elt(
			`msg ${typ}`,
			this.ui.stats
		);

		Dom.elt(
			"cnt",
			wrp,
			msg
		);

		const dis = Dom.elt(
			"dis",
			wrp
		);

		Dom.once(
			dis,
			"click",
			() =>
				wrp.remove()
		);

		if(typ !== "error")
			setTimeout(
				() => {

					if(wrp.parentNode)
						wrp.remove();

					wrp = null;
			
				},
				5678
			);
	
	}

}

export {
	ExtPop
};