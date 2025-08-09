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
	
	script.onload = () =>
		script.remove();
	
	(document.head || document.documentElement).appendChild(script);

})();