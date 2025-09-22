(() => {

	const browse = chrome || browser;

	window.addEventListener(
		"message",
		evt => {

			if(evt.source === window && evt.data.type === "fetch")
				browse.runtime.sendMessage(evt.data);

		}
	);

	const script = document.createElement("script");

	script.src = browse.runtime.getURL("inject.js");
	
	script.onload = () =>
		script.remove();
	
	(document.head || document.documentElement).appendChild(script);

})();