(() => {

	const browser = chrome;

	window.addEventListener(
		"message",
		evt => {

			if(evt.source === window && evt.data.type === "fetch")
				browser.runtime.sendMessage(evt.data);

		}
	);

	const script = document.createElement("script");

	script.src = browser.runtime.getURL("inject.tidal.js");
	// script.type = "text/javascript";
	
	script.onload = () =>
		script.remove();
	
	script.onerror = err =>
		browser.runtime.sendMessage({
			type: "error",
			msg: "inject fail",
			error: err
		});
	
	(document.head || document.documentElement).appendChild(script);

})();