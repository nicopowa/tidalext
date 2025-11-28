(() => {

	const urls = [
		"/v1/country",
		"/pages/album",
		"/v2/artist/"
	];

	const fetched = window.fetch;

	window.fetch = async (resource, options = {}) => {

		const fetchRes = await fetched(
			resource,
			options
		);

		const fetchUrl = typeof resource === "string"
			? resource : resource.url;

		const matchUrl = urls.find(filter =>
			fetchUrl.includes(filter));
	
		if(matchUrl) {

			window.postMessage({
				type: "fetch",
				url: fetchUrl,
				hit: matchUrl,
				sts: fetchRes.status,
				dat: await fetchRes.clone()
				.json()
			});
		
		}
		
		return fetchRes;

	};

})();