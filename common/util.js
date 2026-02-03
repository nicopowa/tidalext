const deep = (obj1, obj2) =>
	({
		...obj1,
		...Object.keys(obj2)
		.reduce(
			(acc, key) => {

				const val1 = obj1[key];
				const val2 = obj2[key];

				// 1. If both are Arrays, concatenate them
				if(Array.isArray(val1) && Array.isArray(val2)) {

					acc[key] = [...val1, ...val2];
				
				}
				// 2. If both are Objects (and not arrays), go deeper
				else if(
					val1
            && typeof val2 === "object"
            && val2 !== null // Added safety check for null
            && !Array.isArray(val2)
				) {

					acc[key] = deep(
						val1,
						val2
					);
				
				}
				// 3. Otherwise, overwrite with the new value
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
	deep, wait
};