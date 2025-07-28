class DashProcessor {

	constructor() {

		this.maxConcurrent = 6;
		this.m4aProcessor = new M4aProcessor();
	
	}

	async process(urls, metadata, messageId) {

		if(!urls.length)
			throw new Error("No URLs provided");

		const stream = new ReadableStream({
			start: controller => {

				this.downloadToStream(
					urls,
					messageId,
					controller
				)
				.then(() =>
					controller.close())
				.catch(err =>
					controller.error(err));
			
			}
		});

		const response = new Response(
			stream,
			{
				headers: {
					"Content-Type": "audio/mp4"
				}
			}
		);
		
		let blob = await response.blob();
		
		if(metadata) {

			try {

				const arrayBuffer = await blob.arrayBuffer();
				const buffer = new Uint8Array(arrayBuffer);
				const processedBuffer = await this.m4aProcessor.injectMetadata(
					buffer,
					metadata
				);
				
				blob = new Blob(
					[processedBuffer],
					{
						type: "audio/mp4"
					}
				);
			
			}
			catch(err) {

				console.warn(
					"M4A metadata injection failed:",
					err
				);
			
			}
		
		}

		const url = URL.createObjectURL(blob);
		
		setTimeout(
			() => {

				// console.log("revoke");
				URL.revokeObjectURL(url);
		
			},
			3456
		);

		return url;
	
	}

	async downloadToStream(urls, messageId, controller) {

		const completed = new Map();
		let activeDownloads = 0;
		let nextToWrite = 0;
		let totalCompleted = 0;
		let lastProgress = 0;

		const writeCompleted = () => {

			while(completed.has(nextToWrite)) {

				const data = completed.get(nextToWrite);

				controller.enqueue(data);
				completed.delete(nextToWrite);
				nextToWrite++;
			
			}
		
		};

		const downloadSegment = async index => {

			activeDownloads++;

			try {

				const response = await fetch(urls[index]);

				if(!response.ok)
					throw new Error(`HTTP ${response.status} for segment ${index}`);

				const data = await response.arrayBuffer();

				completed.set(
					index,
					new Uint8Array(data)
				);
				totalCompleted++;

				const progress = Math.round(totalCompleted / urls.length * 100);

				if(progress !== lastProgress) {

					this.sendProgress(progress);
					lastProgress = progress;
				
				}

				writeCompleted();

			}
			finally {

				activeDownloads--;
			
			}
		
		};

		let downloadIndex = 0;

		while(downloadIndex < urls.length) {

			if(activeDownloads < this.maxConcurrent) {

				downloadSegment(downloadIndex++);
			
			}
			else {

				await new Promise(resolve =>
					setTimeout(
						resolve,
						10
					));
			
			}
		
		}

		while(totalCompleted < urls.length) {

			await new Promise(resolve =>
				setTimeout(
					resolve,
					50
				));
		
		}

		writeCompleted();
	
	}

	sendProgress(progress) {

		browser.runtime.sendMessage({
			type: "loadProgress",
			progress: progress
		})
		.catch(() => {});
	
	}

}

class TidalOffscreenProcessor extends BaseOffscreenProcessor {

	constructor() {

		super();

		this.flacProcessor = new FlacProcessor();
		this.dashProcessor = new DashProcessor();
	
	}

	async process(fetchUrl, metadata, messageId, cover) {

		if(fetchUrl.length === 1) {

			return await this.flacProcessor.process(
				fetchUrl[0],
				metadata,
				messageId,
				cover
			);
		
		}
		else {

			return await this.dashProcessor.process(
				fetchUrl,
				metadata,
				messageId
			);
		
		}
	
	}

}

new TidalOffscreenProcessor();