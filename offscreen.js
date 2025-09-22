import {browse, DEBUG} from "./common/vars.js";
import { BaseOffscreenProcessor } from "./common/off.js";
import { M4aProcessor } from "./proc.m4a.js";

class DashProcessor {

	constructor() {

		this.taskId = "";
		this.progress = 0;
		this.totalsize = 0;

		this.m4aProcessor = new M4aProcessor();
	
	}

	async process(dat, metadata, taskId, coverData = null) {

		// if(DEBUG) console.log("process", taskId);

		try {

			this.taskId = taskId;
			this.progress = 0;
			this.totalsize = 0;

			const manifest = this.parseManifest(dat.man);
			const audioData = await this.downloadAndCombine(manifest);

			const processed = await this.m4aProcessor.injectMetadata(
				audioData,
				metadata,
				coverData
			);

			return URL.createObjectURL(
				new Blob(
					[processed],
					{
						type: "audio/mp4"
					}
				)
			);
		
		}
		catch(err) {

			console.error(
				"metadata inject fail",
				err
			);

			return null;
		
		}
	
	}

	parseManifest(manifestXml) {

		if(DEBUG)
			console.log(manifestXml);

		const parser = new DOMParser();
		const doc = parser.parseFromString(
			manifestXml,
			"text/xml"
		);

		const segmentTemplate = doc.querySelector("SegmentTemplate");
		const initialization = segmentTemplate.getAttribute("initialization");
		const mediaTemplate = segmentTemplate.getAttribute("media");
		const startNumber
			= parseInt(segmentTemplate.getAttribute("startNumber")) || 1;

		const timeline = doc.querySelector("SegmentTimeline");
		const segments = timeline.querySelectorAll("S");

		let segmentCount = 0;

		for(const segment of segments) {

			const repeat = +(segment.getAttribute("r") || 0);

			segmentCount += 1 + repeat;
		
		}

		return {
			initialization,
			mediaTemplate,
			startNumber,
			segmentCount
		};
	
	}

	async downloadAndCombine(manifest) {

		const totalSegments = 1 + manifest.segmentCount;
		let segments = [];

		// initialization segment
		segments.push(
			await this.downloadSegment(
				manifest.initialization,
				0,
				totalSegments
			)
		);

		// media segments
		for(let i = 0; i < manifest.segmentCount; i++) {

			const segmentUrl = manifest.mediaTemplate.replace(
				"$Number$",
				manifest.startNumber + i
			);

			segments.push(
				await this.downloadSegment(
					segmentUrl,
					i + 1,
					totalSegments
				)
			);
		
		}

		const combined = this.combineSegments(segments);

		segments = null;

		return combined;
	
	}

	async downloadSegment(url, segmentIndex, totalSegments) {

		const response = await fetch(url);

		if(!response.ok)
			throw new Error(
				`segment ${segmentIndex} failed: ${response.status}`
			);

		const contentLength = +(response.headers.get("content-length") || 0);

		if(!contentLength)
			throw new Error("no content length");

		let data = new Uint8Array(contentLength);
		let position = 0;

		const reader = response.body.getReader();

		// dirty
		// should be a simple await recursion
		while(true) {

			const {
				done, value
			} = await reader.read();

			if(done)
				break;

			data.set(
				value,
				position
			);

			position += value.length;

			const segmentProgress = position / contentLength;
			const overallProgress = Math.ceil(
				((segmentIndex + segmentProgress) / totalSegments) * 100
			);

			if(overallProgress !== this.progress) {

				this.sendProgress(overallProgress);
			
			}

			this.progress = overallProgress;
		
		}

		reader.releaseLock();

		this.totalsize += position;

		return data;
	
	}

	combineSegments(segments) {

		const combined = new Uint8Array(this.totalsize);

		let position = 0;

		for(const segment of segments) {

			combined.set(
				segment,
				position
			);

			position += segment.length;
		
		}

		return combined;
	
	}

	sendProgress(progress) {

		browse.runtime
		.sendMessage({
			type: "progress",
			task: this.taskId, 
			progress: progress
		})
		.catch(() => {});
	
	}

}

class TidalOffscreenProcessor extends BaseOffscreenProcessor {

	constructor() {

		super();

		this.dashProcessor = new DashProcessor();
	
	}

	async process(dat, metadata, messageId, cover) {

		return await this.dashProcessor.process(
			dat,
			metadata,
			messageId,
			cover
		);

	}

}

new TidalOffscreenProcessor();
