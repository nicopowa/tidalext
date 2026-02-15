import {browse} from "./common/vars.js";
import {BaseProcessor} from "./common/proc.js";

// mp4 atoms
const MOOV = 0x6D6F6F76;
const MDAT = 0x6D646174;
const MOOF = 0x6D6F6F66;
const STYP = 0x73747970;
const FTYP = 0x66747970;
const DFLA = 0x64664C61;

class DashProcessor extends BaseProcessor {

	constructor() {

		super();
		
		// no time to wait ?
		// set this value to 3 or 4
		// use at your own risks
		this.parallel = 1;

		this.taskId = "";
		this.progress = 0;
		this.totalsize = 0;
	
	}

	async process(dat, metadata, taskId, coverData = null) {

		// if(DEBUG) console.log("process", taskId);

		try {

			this.taskId = taskId;
			this.progress = 0;
			this.totalsize = 0;

			const manifest = this.parseManifest(dat.man);
			const audioData = await this.downloadAndCombine(manifest);

			const processed = this.injectMetadata(
				audioData,
				metadata,
				coverData
			);

			return URL.createObjectURL(
				new Blob(
					[processed],
					{
						type: "audio/flac"
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

		//if(DEBUG) console.log(manifestXml);

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
		let segments = new Array(totalSegments);
		this.segmentProgress = new Float32Array(totalSegments);

		// init segment always first
		segments[0] = await this.downloadSegment(
			manifest.initialization,
			0,
			totalSegments
		);

		// media segments with concurrency pool
		let active = 0;
		let next = 0;
		const count = manifest.segmentCount;

		if(count > 0) {

			await new Promise((resolve, reject) => {

				const launch = () => {

					while(active < this.parallel && next < count) {

						const idx = next++;
						const segmentUrl = manifest.mediaTemplate.replace(
							"$Number$",
							manifest.startNumber + idx
						);

						active++;

						this.downloadSegment(
							segmentUrl,
							idx + 1,
							totalSegments
						)
						.then(data => {

							segments[idx + 1] = data;
							active--;

							if(next >= count && active === 0)
								resolve();
							else
								launch();

						})
						.catch(reject);
					
					}
				
				};

				launch();
			
			});
		
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

		// dirty, rewrite to simple await recursion
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

			this.segmentProgress[segmentIndex] = position / contentLength;

			const overallProgress = Math.ceil(
				this.segmentProgress.reduce((a, b) => a + b, 0) / totalSegments * 100
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

	/**
	 * @param {Uint8Array} buffer : dash segments init + media
	 * @param {Object} metadata : tags
	 * @param {Object} coverData : cover
	 */
	injectMetadata(buffer, metadata, coverData) {

		const {
			streamInfo, audioChunks, totalAudioLength
		} = this.parseMp4Container(buffer);

		// useless ?
		if(!streamInfo) {

			// fallback to raw flac
			return super.injectMetadata(
				buffer,
				metadata,
				coverData
			);
		
		}

		return this.buildFlac(
			streamInfo,
			audioChunks,
			totalAudioLength,
			metadata,
			coverData
		);
	
	}

	parseMp4Container(buffer) {

		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);
		const len = buffer.length;
        
		let streamInfo = null;
		let audioChunks = [];
		let totalAudioLength = 0;

		let i = 0;
        
		while(i < len - 8) {

			// filter MOOV and MDAT, start with 0x6D
			if(buffer[i] !== 0x6D) {

				i++;
				continue;
			
			}

			const type = view.getUint32(
				i,
				false
			);
            
			if(type !== MOOV && type !== MDAT) {

				i++;
				continue;
			
			}

			// atom header starts 4 bytes before type (size field)
			const atomStart = i - 4;
            
			// check start of file
			if(atomStart < 0) {
 
				i++;
				continue;
			
			}

			let size = view.getUint32(
				atomStart,
				false
			);
			let headerSize = 8;
            
			// handle extended size 64-bit
			if(size === 1) {

				if(atomStart + 16 > len)
					break;

				size = Number(view.getBigUint64(
					atomStart + 8,
					false
				));
				headerSize = 16;
			
			}
			else if(size === 0) { // chunks until the end

				let chunkEnd = len;
                
				for(let j = atomStart + headerSize; j < len - 4; j++) {

					const b = buffer[j];

					// look for "m" (moov/moof/mdat), "s" (styp), "f" (ftyp) signatures
					if(b === 0x6D || b === 0x73 || b === 0x66) {

						const nextSig = view.getUint32(
							j,
							false
						);

						if(nextSig === MOOF || nextSig === STYP || nextSig === FTYP || nextSig === MOOV || nextSig === MDAT) {

							chunkEnd = j - 4;
							break;
						
						}
					
					}
				
				}
				size = chunkEnd - atomStart;
			
			}

			// atom sanity check
			if(size >= headerSize && atomStart + size <= len + 1024) {
                
				if(type === MOOV) {

					if(!streamInfo) {

						streamInfo = this.extractStreamInfoFromMoov(
							buffer,
							atomStart + headerSize,
							atomStart + size
						);
					
					}
				
				}
				else { // MDAT

					// clamp buffer length
					const readSize = Math.min(
						size,
						len - atomStart
					);
					const data = buffer.subarray(
						atomStart + headerSize,
						atomStart + readSize
					);
                    
					if(data.length > 0) {

						audioChunks.push(data);
						totalAudioLength += data.length;
					
					}
				
				}

				// jump end of the atom.
				i = atomStart + size;
			
			}
			else {

				// invalid size or bounds, scan next byte
				i++;
			
			}
		
		}

		return {
			streamInfo, audioChunks, totalAudioLength
		};
	
	}

	/**
	 * find MOOV atom dfLa box
	 */
	extractStreamInfoFromMoov(buffer, start, end) {

		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);
        
		// find dfLa signature within MOOV range
		for(let p = start; p < end - 4; p++) {

			if(view.getUint32(
				p,
				false
			) === DFLA) {

				// maybe dfLa box found at p (p = type, p-4 = size)
				const boxStart = p - 4;
				const boxSize = view.getUint32(
					boxStart,
					false
				);
                
				// sanity check
				if(boxSize < 42 || boxStart + boxSize > end)
					continue;

				// parse content : [size 4][dfLa 4][fullBox ver/flags 4][blockHeader 4][streamInfo 34]
				const metaBlockHeaderPos = p + 8; // skip type(4) + fullBox(4)
				const metaBlockHeader = view.getUint32(
					metaBlockHeaderPos,
					false
				);
                
				// first block in dfLa must be streamInfo (type 0)
				const blockType = (metaBlockHeader >>> 24) & 0x7F;

				if(blockType === 0) {

					const streamInfoStart = metaBlockHeaderPos + 4;

					// slice distinct copy >> final file
					return buffer.slice(
						streamInfoStart,
						streamInfoStart + 34
					);
				
				}
			
			}
		
		}

		return null;
	
	}

}

export {
	DashProcessor
};