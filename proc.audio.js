import {browse, Msg, Stat} from "./common/vars.js";
import {BaseProcessor} from "./common/proc.js";

// mp4 atom type signatures
const MDAT = 0x6D646174;
const DFLA = 0x64664C61;

class FlacProcessor extends BaseProcessor {

	constructor() {

		super();

		// parallel chunks
		this.chunks = 1;

		this.taskId = "";
		this.progress = 0;
		this.segmentProgress = new Float32Array(0);

	}

	async process(dat, metadata, taskId, coverData = null, rules = {}, opts = {}) {

		this.taskId = taskId;
		this.progress = 0;
		this.chunks = opts.segments || 1;

		const manifest = this.parseManifest(dat.man);
		const totalSegments = 1 + manifest.segmentCount;

		this.segmentProgress = new Float32Array(totalSegments);

		// buffer init segment MOOV, no audio
		const initBuf = await this._fetchBuffered(
			manifest.initialization,
			0,
			totalSegments
		);
		const streamInfo = this._extractStreamInfo(initBuf);

		if(!streamInfo)
			throw new Error("STREAMINFO not found in init segment");

		// build FLAC header

		let header;

		try {

			header = this.buildFlacHeader(
				streamInfo,
				metadata || {},
				coverData
			);

		}
		catch(err) {

			console.warn(
				"header build failed, fall back to empty tags",
				err
			);
			header = this.buildFlacHeader(
				streamInfo,
				{},
				null
			);

		}

		// ReadableStream : FLAC header, MDAT segment 1, MDAT segment 2, ...

		const count = manifest.segmentCount;
		const self = this;

		const queue = [];
		let launchIdx = 0;
		let drainIdx = 0;

		const launchMore = () => {

			while(queue.length < self.chunks && launchIdx < count) {

				const segIdx = launchIdx++;
				const url = manifest.mediaTemplate.replace(
					"$Number$",
					manifest.startNumber + segIdx
				);

				queue.push(self._fetchAndExtractMdat(
					url,
					segIdx + 1,
					totalSegments
				));

			}

		};

		const stream = new ReadableStream({

			start(controller) {

				controller.enqueue(header);

				if(count === 0)
					controller.close();
				else
					launchMore();

			},

			async pull(controller) {

				if(drainIdx >= count) {

					controller.close();

					return;

				}

				const chunks = await queue.shift();

				drainIdx++;
				launchMore();

				for(const chunk of chunks) {

					if(chunk.length)
						controller.enqueue(chunk);

				}

				if(drainIdx >= count)
					controller.close();

			},

			cancel() {

				queue.length = 0;

			}

		});

		const blob = await new Response(
			stream,
			{
				headers: {
					"Content-Type": "audio/flac"
				}
			}
		)
		.blob();

		return URL.createObjectURL(blob);

	}

	parseManifest(manifestXml) {

		const parser = new DOMParser();
		const doc = parser.parseFromString(
			manifestXml,
			"text/xml"
		);

		const segmentTemplate = doc.querySelector("SegmentTemplate");
		const initialization = segmentTemplate.getAttribute("initialization");
		const mediaTemplate = segmentTemplate.getAttribute("media");
		const startNumber = parseInt(
			segmentTemplate.getAttribute("startNumber"),
			10
		) || 1;

		const timeline = doc.querySelector("SegmentTimeline");
		const segments = timeline.querySelectorAll("S");

		let segmentCount = 0;

		for(const segment of segments) {

			segmentCount += 1 + +(segment.getAttribute("r") || 0);

		}

		return {
			initialization, mediaTemplate, startNumber, segmentCount
		};

	}

	async _fetchBuffered(url, segmentIndex, totalSegments) {

		const res = await fetch(url);

		if(!res.ok)
			throw new Error(`segment ${segmentIndex} failed: ${res.status}`);

		const contentLength = +(res.headers.get("content-length") || 0);

		if(!contentLength)
			throw new Error(`segment ${segmentIndex}: no content-length`);

		const buf = new Uint8Array(contentLength);
		let pos = 0;
		const reader = res.body.getReader();

		while(true) {

			const {
				done, value
			} = await reader.read();

			if(done)
				break;

			buf.set(
				value,
				pos
			);
			pos += value.length;

			this.segmentProgress[segmentIndex] = pos / contentLength;
			this._reportProgress(totalSegments);

		}

		reader.releaseLock();

		return buf;

	}

	async _fetchAndExtractMdat(url, segmentIndex, totalSegments) {

		const buf = await this._fetchBuffered(
			url,
			segmentIndex,
			totalSegments
		);

		return this._extractMdat(buf);

	}

	_extractMdat(buffer) {

		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);
		const len = buffer.length;
		const chunks = [];
		let i = 0;

		while(i + 8 <= len) {

			let size = view.getUint32(
				i,
				false
			);
			const type = view.getUint32(
				i + 4,
				false
			);
			let headerSize = 8;

			if(size === 1) {

				if(i + 16 > len)
					break;

				size = Number(view.getBigUint64(
					i + 8,
					false
				));
				headerSize = 16;

			}
			else if(size === 0) {

				size = len - i;

			}

			if(size < headerSize || i + size > len + 1024) {

				i++;
				continue;

			}

			if(type === MDAT) {

				const payload = buffer.subarray(
					i + headerSize,
					Math.min(
						i + size,
						len
					)
				);

				if(payload.length)
					chunks.push(payload);

			}

			i += size;

		}

		return chunks;

	}

	_extractStreamInfo(buffer) {

		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);
		const len = buffer.length;

		for(let p = 4; p < len - 4; p++) {

			if(view.getUint32(
				p,
				false
			) !== DFLA)
				continue;

			const boxStart = p - 4;
			const boxSize = view.getUint32(
				boxStart,
				false
			);

			if(boxSize < 50 || boxStart + boxSize > len)
				continue;

			const blockHeader = view.getUint32(
				p + 8,
				false
			);
			const blockType = (blockHeader >>> 24) & 0x7F;

			if(blockType !== 0)
				continue;

			const streamInfoStart = p + 12;

			return buffer.slice(
				streamInfoStart,
				streamInfoStart + 34
			);

		}

		return null;

	}

	_reportProgress(totalSegments) {

		const overall = Math.ceil(
			this.segmentProgress.reduce(
				(a, b) =>
					a + b,
				0
			) / totalSegments * 100
		);

		if(overall === this.progress)
			return;

		this.progress = overall;

		browse.runtime.sendMessage({
			type: Msg.PROGRESS,
			id: this.taskId,
			sts: Stat.LOAD,
			progress: overall
		});

	}

}

class M4aProcessor {

	constructor() {

		// atom types
		this.FTYP = 0x66747970;
		this.MOOV = 0x6D6F6F76;
		this.UDTA = 0x75647461;
		this.META = 0x6D657461;
		this.ILST = 0x696C7374;
		this.DATA = 0x64617461;
		this.HDLR = 0x68646C72;
		
		this.UTF8_TYPE = 1;
		this.JPEG_TYPE = 13;
		this.PNG_TYPE = 14;
		
		this.TAG_MAP = {
			"TITLE": 0xa96E616D,
			"ARTIST": 0xa9415254,
			"ALBUM": 0xa9616C62,
			"DATE": 0xa9646179,
			"TRACK": 0x74726B6E,
			"ALBUMARTIST": 0x61415254,
			"YEAR": 0xa9646179,
			"COVR": 0x636F7672
		};
		
		this.encoder = new TextEncoder();
		this.hdlrCache = null;

		// streaming state
		this.chunks = 1;
		this.taskId = "";
		this.progress = 0;
		this.segmentProgress = new Float32Array(0);
	
	}

	async process(dat, metadata, taskId, coverData = null, rules = {}, opts = {}) {

		this.taskId = taskId;
		this.progress = 0;
		this.chunks = opts.segments || 1;

		const manifest = this.parseManifest(dat.man);
		const totalSegments = 1 + manifest.segmentCount;

		this.segmentProgress = new Float32Array(totalSegments);

		// fetch initialization segment ftyp + moov
		const initBuf = await this._fetchBuffered(
			manifest.initialization,
			0,
			totalSegments
		);

		// inject metadata
		let taggedInitBuf;

		try {

			taggedInitBuf = await this.injectMetadata(
				initBuf,
				metadata,
				coverData
			);
		
		}
		catch(err) {

			console.warn(
				"M4A metadata injection failed, falling back to raw init segment",
				err
			);
			taggedInitBuf = initBuf;
		
		}

		// stream tagged init segment then raw media segments
		const count = manifest.segmentCount;
		const self = this;
		const queue = [];
		let launchIdx = 0;
		let drainIdx = 0;

		const launchMore = () => {

			while(queue.length < self.chunks && launchIdx < count) {

				const segIdx = launchIdx++;
				const url = manifest.mediaTemplate.replace(
					"$Number$",
					manifest.startNumber + segIdx
				);
				
				queue.push(self._fetchBuffered(
					url,
					segIdx + 1,
					totalSegments
				));
			
			}
		
		};

		const stream = new ReadableStream({
			start(controller) {

				controller.enqueue(taggedInitBuf);

				if(count === 0)
					controller.close();
				else
					launchMore();
			
			},
			async pull(controller) {

				if(drainIdx >= count) {

					controller.close();

					return;
				
				}

				const chunk = await queue.shift();

				drainIdx++;
				launchMore();

				if(chunk.length)
					controller.enqueue(chunk);

				if(drainIdx >= count)
					controller.close();
			
			},
			cancel() {

				queue.length = 0;
			
			}
		});

		const blob = await new Response(
			stream,
			{
				headers: {
					"Content-Type": "audio/mp4"
				}
			}
		)
		.blob();

		return URL.createObjectURL(blob);

	}

	parseManifest(manifestXml) {

		const parser = new DOMParser();
		const doc = parser.parseFromString(
			manifestXml,
			"text/xml"
		);

		const segmentTemplate = doc.querySelector("SegmentTemplate");
		const initialization = segmentTemplate.getAttribute("initialization");
		const mediaTemplate = segmentTemplate.getAttribute("media");
		const startNumber = parseInt(
			segmentTemplate.getAttribute("startNumber"),
			10
		) || 1;

		const timeline = doc.querySelector("SegmentTimeline");
		const segments = timeline.querySelectorAll("S");

		let segmentCount = 0;

		for(const segment of segments) {

			segmentCount += 1 + +(segment.getAttribute("r") || 0);
		
		}

		return {
			initialization, mediaTemplate, startNumber, segmentCount
		};

	}

	async _fetchBuffered(url, segmentIndex, totalSegments) {

		const res = await fetch(url);

		if(!res.ok)
			throw new Error(`segment ${segmentIndex} failed: ${res.status}`);

		const contentLength = +(res.headers.get("content-length") || 0);

		if(!contentLength)
			throw new Error(`segment ${segmentIndex}: no content-length`);

		const buf = new Uint8Array(contentLength);
		let pos = 0;
		const reader = res.body.getReader();

		while(true) {

			const {
				done, value
			} = await reader.read();

			if(done)
				break;

			buf.set(
				value,
				pos
			);
			pos += value.length;

			this.segmentProgress[segmentIndex] = pos / contentLength;
			this._reportProgress(totalSegments);
		
		}

		reader.releaseLock();

		return buf;

	}

	_reportProgress(totalSegments) {

		const overall = Math.ceil(
			this.segmentProgress.reduce(
				(a, b) =>
					a + b,
				0
			) / totalSegments * 100
		);

		if(overall === this.progress)
			return;

		this.progress = overall;

		browse.runtime.sendMessage({
			type: Msg.PROGRESS,
			id: this.taskId,
			sts: Stat.LOAD,
			progress: overall
		});

	}

	async injectMetadata(buffer, metadata, coverData = null) {

		const atoms = this.parseAtoms(buffer);
		const moovIndex = atoms.findIndex(a =>
			a.type === this.MOOV);
		
		if(moovIndex === -1)
			throw new Error("no moov atom");

		atoms[moovIndex] = await this.updateMoovMetadata(
			atoms[moovIndex],
			metadata,
			coverData
		);

		return this.buildM4AFile(atoms);
	
	}

	parseAtoms(buffer) {

		const atoms = [];
		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset
		);
		let pos = 0;

		while(pos + 8 <= buffer.length) {

			let atomSize = view.getUint32(
				pos,
				false
			);
			const atomType = view.getUint32(
				pos + 4,
				false
			);
			let headerSize = 8;

			if(atomSize === 1) {

				if(pos + 16 > buffer.length)
					break;

				atomSize = view.getUint32(
					pos + 12,
					false
				);
				headerSize = 16;
			
			}

			if(atomSize === 0)
				atomSize = buffer.length - pos;

			if(atomSize < headerSize || pos + atomSize > buffer.length)
				break;

			atoms.push({
				type: atomType,
				data: buffer.subarray(
					pos,
					pos + atomSize
				)
			});

			pos += atomSize;
		
		}

		return atoms;
	
	}

	async updateMoovMetadata(moovAtom, metadata, coverData) {

		const subAtoms = this.parseSubAtoms(
			moovAtom.data,
			8
		);
		let udtaIndex = subAtoms.findIndex(a =>
			a.type === this.UDTA);
		
		if(udtaIndex >= 0) {

			subAtoms[udtaIndex] = await this.updateUdtaMetadata(
				subAtoms[udtaIndex],
				metadata,
				coverData
			);
		
		}
		else {

			subAtoms.push(await this.createUdtaAtom(
				metadata,
				coverData
			));
		
		}

		return {
			type: moovAtom.type,
			data: this.buildAtom(
				this.MOOV,
				subAtoms
			)
		};
	
	}

	parseSubAtoms(data, offset) {

		const atoms = [];
		const view = new DataView(
			data.buffer,
			data.byteOffset
		);
		let pos = offset;

		while(pos + 8 <= data.length) {

			const atomSize = view.getUint32(
				pos,
				false
			);
			const atomType = view.getUint32(
				pos + 4,
				false
			);
			
			if(atomSize === 0 || pos + atomSize > data.length)
				break;

			atoms.push({
				type: atomType,
				data: data.subarray(
					pos,
					pos + atomSize
				)
			});

			pos += atomSize;
		
		}

		return atoms;
	
	}

	async updateUdtaMetadata(udtaAtom, metadata, coverData) {

		const subAtoms = this.parseSubAtoms(
			udtaAtom.data,
			8
		);
		let metaIndex = subAtoms.findIndex(a =>
			a.type === this.META);
		
		if(metaIndex >= 0) {

			subAtoms[metaIndex] = await this.createMetaAtom(
				metadata,
				coverData
			);
		
		}
		else {

			subAtoms.push(await this.createMetaAtom(
				metadata,
				coverData
			));
		
		}

		return {
			type: this.UDTA,
			data: this.buildAtom(
				this.UDTA,
				subAtoms
			)
		};
	
	}

	async createUdtaAtom(metadata, coverData) {

		return {
			type: this.UDTA,
			data: this.buildAtom(
				this.UDTA,
				[await this.createMetaAtom(
					metadata,
					coverData
				)]
			)
		};
	
	}

	async createMetaAtom(metadata, coverData) {

		const ilstData = await this.buildIlstAtom(
			metadata,
			coverData
		);
		const hdlrData = this.getHdlrAtom();
		
		const totalSize = 12 + hdlrData.length + ilstData.length;
		const buffer = new Uint8Array(totalSize);
		const view = new DataView(buffer.buffer);
		
		view.setUint32(
			0,
			totalSize,
			false
		);
		view.setUint32(
			4,
			this.META,
			false
		);
		view.setUint32(
			8,
			0,
			false
		);
		
		buffer.set(
			hdlrData,
			12
		);
		buffer.set(
			ilstData,
			12 + hdlrData.length
		);

		return {
			type: this.META,
			data: buffer
		};
	
	}

	getHdlrAtom() {

		if(!this.hdlrCache) {

			const size = 33;
			const buffer = new Uint8Array(size);
			const view = new DataView(buffer.buffer);
			
			view.setUint32(
				0,
				size,
				false
			);
			view.setUint32(
				4,
				this.HDLR,
				false
			);
			view.setUint32(
				8,
				0,
				false
			);
			view.setUint32(
				12,
				0,
				false
			);
			
			buffer.set(
				this.encoder.encode("mdir"),
				16
			);
			
			this.hdlrCache = buffer;
		
		}

		return this.hdlrCache;
	
	}

	async buildIlstAtom(metadata, coverData) {

		const tagBuffers = [];
		let totalDataSize = 0;

		for(const [tagName, value] of Object.entries(metadata)) {

			const tagType = this.TAG_MAP[tagName.toUpperCase()];

			if(tagType && value && tagType !== this.TAG_MAP.COVR) {

				const tagBuffer = this.buildTextTag(
					tagType,
					String(value)
				);

				tagBuffers.push(tagBuffer);
				totalDataSize += tagBuffer.length;
			
			}
		
		}

		if(coverData) {

			const coverBuffer = this.buildCoverTag(coverData);

			tagBuffers.push(coverBuffer);
			totalDataSize += coverBuffer.length;
		
		}

		const totalSize = 8 + totalDataSize;
		const buffer = new Uint8Array(totalSize);
		const view = new DataView(buffer.buffer);
		
		view.setUint32(
			0,
			totalSize,
			false
		);
		view.setUint32(
			4,
			this.ILST,
			false
		);

		let pos = 8;

		for(const tagBuffer of tagBuffers) {

			buffer.set(
				tagBuffer,
				pos
			);
			pos += tagBuffer.length;
		
		}

		return buffer;
	
	}

	buildTextTag(tagType, value) {

		const valueBytes = this.encoder.encode(value);
		const totalSize = 24 + valueBytes.length;
		const buffer = new Uint8Array(totalSize);
		const view = new DataView(buffer.buffer);
		
		view.setUint32(
			0,
			totalSize,
			false
		);
		view.setUint32(
			4,
			tagType,
			false
		);
		view.setUint32(
			8,
			16 + valueBytes.length,
			false
		);
		view.setUint32(
			12,
			this.DATA,
			false
		);
		view.setUint32(
			16,
			this.UTF8_TYPE,
			false
		);
		view.setUint32(
			20,
			0,
			false
		);
		
		buffer.set(
			valueBytes,
			24
		);

		return buffer;
	
	}

	buildCoverTag(coverData) {

		const imageBytes = new Uint8Array(coverData.data);
		const imageType = (coverData.type || "").includes("png") ? this.PNG_TYPE : this.JPEG_TYPE;
		const totalSize = 24 + imageBytes.length;
		
		const buffer = new Uint8Array(totalSize);
		const view = new DataView(buffer.buffer);
		
		view.setUint32(
			0,
			totalSize,
			false
		);
		view.setUint32(
			4,
			this.TAG_MAP.COVR,
			false
		);
		view.setUint32(
			8,
			16 + imageBytes.length,
			false
		);
		view.setUint32(
			12,
			this.DATA,
			false
		);
		view.setUint32(
			16,
			imageType,
			false
		);
		view.setUint32(
			20,
			0,
			false
		);
		
		buffer.set(
			imageBytes,
			24
		);

		return buffer;
	
	}

	buildAtom(atomType, subAtoms) {

		let totalDataSize = 0;

		for(const atom of subAtoms) {

			totalDataSize += atom.data.length;
		
		}

		const totalSize = 8 + totalDataSize;
		const buffer = new Uint8Array(totalSize);
		const view = new DataView(buffer.buffer);
		
		view.setUint32(
			0,
			totalSize,
			false
		);
		view.setUint32(
			4,
			atomType,
			false
		);

		let pos = 8;

		for(const atom of subAtoms) {

			buffer.set(
				atom.data,
				pos
			);
			pos += atom.data.length;
		
		}

		return buffer;
	
	}

	buildM4AFile(atoms) {

		let totalSize = 0;

		for(const atom of atoms) {

			totalSize += atom.data.length;
		
		}

		const buffer = new Uint8Array(totalSize);
		let pos = 0;

		for(const atom of atoms) {

			buffer.set(
				atom.data,
				pos
			);
			pos += atom.data.length;
		
		}

		return buffer;
	
	}

}

class AudioProcessor {

	process(dat, metadata, taskId, coverData = null, rules = {}, opts = {}) {

		const processor = rules.atmos === true
			? new M4aProcessor()
			: new FlacProcessor();

		return processor.process(
			dat,
			metadata,
			taskId,
			coverData,
			rules,
			opts
		);

	}

}

export {
	AudioProcessor
};