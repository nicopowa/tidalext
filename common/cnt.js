/**
 * @define {boolean}
 */
const DEV = true;

/**
 * @define {boolean}
 */
const DEBUG = true;

(() => {

	const browse = globalThis.chrome || globalThis.browser;

	let ext = null;

	try {
		
		ext = browse.runtime;
	
	}
	catch(err) {
		
	}

	if(ext) { // content

		const send = (typ, dat) => {

			try {

				ext.sendMessage({
					...dat,
					type: typ
				});
			
			}
			catch(err) {
				// extension context invalidated
				// orphaned content script
				// silent fail
			}
		
		};

		window.addEventListener(
			"popstate",
			evt =>
				send(
					15, // Msg.STATE
					/** @type {!PopStateEvent} */ (evt).state
				)
		);

		const inj = /** @type {!HTMLScriptElement}*/(document.createElement("script"));

		inj.src = ext.getURL(DEV ? "common/cnt.js" : "inject.min.js");
	
		inj.onload = () => {

			inj.remove();

			const port = ext.connect();

			window.addEventListener(
				"message",
				evt => {

					if(evt.source === window) {

						const dat = /** @type {!MessageEvent} */ (evt).data;

						if([5, 11].includes(dat.type)) { // useless ?

							send(
								dat.type,
								dat
							);
						
						}
						
					}

				}
			);

			port.onMessage.addListener(msg => {

				// inject url hijacks
				window.postMessage(msg);

				const confs = msg["confs"];

				if(confs["stores"]) {

					// send full localStorage on init
					send(
						11, // Msg.STORE
						{
							...window.localStorage
						}
					);
				
				}

				port.disconnect();
		
			});
	
		};
	
		(document.head || document.documentElement).prepend(inj);
	
	}
	else { // inject

		window.addEventListener(
			"message",
			evt => {

				const datas = /** @type {!MessageEvent} */ (evt).data;
				const jacks = datas["jacks"];
				const confs = datas["confs"];

				if(!jacks)
					return;

				const fetchd = window.fetch;

				window.fetch = async (resource, options = {}) => {

					const fetchRes = await fetchd(
						resource,
						options
					);

					const fetchUrl = resource instanceof Request
						? resource.url : String(resource);
	
					const matchUrl = jacks.find(jack =>
						new RegExp(jack["hit"])
						.test(fetchUrl));
	
					if(matchUrl) {

						postMessage({
							type: 5,
							typ: matchUrl.typ,
							url: fetchUrl,
							sts: fetchRes.status,
							dat: await fetchRes.clone()
							.json()
						});
		
					}
		
					return fetchRes;

				};

				if(confs["stores"]) {

					const stored = Storage.prototype.setItem;

					//Storage.prototype.setItem // happy closure compiler
					Storage.prototype["setItem"] = function(key, value) {

						postMessage(
							{
								type: 11,
								[key]: value
							}
						);
			
						stored.apply(
							this,
							arguments
						);

					};
				
				}
		
			}
		);
	
	}

})();
