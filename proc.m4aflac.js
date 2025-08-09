
class FlacFromM4aProcessor {

	constructor() {

		this.FTYP = 0x66747970;
		this.MDAT = 0x6D646174;
		this.MOOV = 0x6D6F6F76;
		this.TRAK = 0x7472616B;
		this.MDIA = 0x6D646961;
		this.MINF = 0x6D696E66;
		this.STBL = 0x7374626C;
		this.STSD = 0x73747364;
		this.STTS = 0x73747473;
		this.STSC = 0x73747363;
		this.STSZ = 0x7374737A;
		this.STCO = 0x7374636F;
		this.CO64 = 0x636F3634;
		
		this.FLAC_SIGNATURE = 0x664C6143;
		this.VORBIS_COMMENT_TYPE = 4;
		this.PICTURE_TYPE = 6;
		this.VENDOR_STRING = new TextEncoder()
		.encode("MetaFlaque");
		this.encoder = new TextEncoder();

		this.flacProcessor = new FlacProcessor();
	
	}

	async injectMetadata(buffer, metadata, coverData = null) {

		try {

			const flacFrames = this.extractFlacFrames(buffer);
			
			if(!flacFrames || flacFrames.length === 0) {

				throw new Error("no flac frames found");
			
			}

			return this.buildFlacWithMetadata(
				flacFrames,
				metadata,
				coverData
			);
		
		}
		catch(err) {

			console.error(
				"flac extraction failed",
				err
			);

			return buffer;
		
		}
	
	}

	extractFlacFrames(buffer) {

		const atoms = this.parseAtoms(buffer);
		const moovAtom = atoms.find(a =>
			a.type === this.MOOV);
		const mdatAtom = atoms.find(a =>
			a.type === this.MDAT);
		
		if(!moovAtom || !mdatAtom) {

			throw new Error("missing moov or mdat");
		
		}

		const sampleInfo = this.parseSampleInfo(moovAtom.data);

		return this.extractFramesFromMdat(
			mdatAtom.data,
			sampleInfo
		);
	
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

			if(atomSize === 0) {

				atomSize = buffer.length - pos;
			
			}

			if(atomSize < headerSize || pos + atomSize > buffer.length) {

				break;
			
			}

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

	findAtomInContainer(containerData, atomType) {

		const view = new DataView(
			containerData.buffer,
			containerData.byteOffset
		);
		let pos = 8;

		while(pos + 8 <= containerData.length) {

			const size = view.getUint32(
				pos,
				false
			);
			const type = view.getUint32(
				pos + 4,
				false
			);

			if(type === atomType) {

				return containerData.subarray(
					pos,
					pos + size
				);
			
			}

			if(size === 0 || pos + size > containerData.length)
				break;

			pos += size;
		
		}

		return null;
	
	}

	parseSampleInfo(moovData) {

		const trakAtom = this.findAtomInContainer(
			moovData,
			this.TRAK
		);

		if(!trakAtom)
			throw new Error("no trak");

		const mdiaAtom = this.findAtomInContainer(
			trakAtom,
			this.MDIA
		);

		if(!mdiaAtom)
			throw new Error("no mdia");

		const minfAtom = this.findAtomInContainer(
			mdiaAtom,
			this.MINF
		);

		if(!minfAtom)
			throw new Error("no minf");

		const stblAtom = this.findAtomInContainer(
			minfAtom,
			this.STBL
		);

		if(!stblAtom)
			throw new Error("no stbl");

		const stszAtom = this.findAtomInContainer(
			stblAtom,
			this.STSZ
		);
		const stcoAtom = this.findAtomInContainer(
			stblAtom,
			this.STCO
		);
		
		if(!stszAtom || !stcoAtom) {

			throw new Error("missing sample tables");
		
		}

		return this.parseSampleTables(
			stszAtom,
			stcoAtom
		);
	
	}

	parseSampleTables(stszData, stcoData) {

		const stszView = new DataView(
			stszData.buffer,
			stszData.byteOffset
		);
		const stcoView = new DataView(
			stcoData.buffer,
			stcoData.byteOffset
		);

		const sampleSize = stszView.getUint32(
			12,
			false
		);
		const sampleCount = stszView.getUint32(
			16,
			false
		);
		
		const sampleSizes = [];
		let pos = 20;

		if(sampleSize === 0) {

			for(let i = 0; i < sampleCount; i++) {

				sampleSizes.push(stszView.getUint32(
					pos,
					false
				));
				pos += 4;
			
			}
		
		}
		else {

			for(let i = 0; i < sampleCount; i++) {

				sampleSizes.push(sampleSize);
			
			}
		
		}

		const chunkCount = stcoView.getUint32(
			12,
			false
		);
		const chunkOffsets = [];

		pos = 16;

		for(let i = 0; i < chunkCount; i++) {

			chunkOffsets.push(stcoView.getUint32(
				pos,
				false
			));
			pos += 4;
		
		}

		return {
			sampleSizes, chunkOffsets
		};
	
	}

	extractFramesFromMdat(mdatData, sampleInfo) {

		const frames = [];
		const mdatOffset = 8;
		
		let sampleIndex = 0;
		
		for(const chunkOffset of sampleInfo.chunkOffsets) {

			let currentOffset = chunkOffset - mdatOffset;
			
			if(sampleIndex < sampleInfo.sampleSizes.length) {

				const sampleSize = sampleInfo.sampleSizes[sampleIndex];
				
				if(currentOffset + sampleSize <= mdatData.length) {

					const frame = mdatData.subarray(
						currentOffset,
						currentOffset + sampleSize
					);

					frames.push(frame);
				
				}
				
				sampleIndex++;
			
			}
		
		}

		let totalSize = 0;

		for(const frame of frames) {

			totalSize += frame.length;
		
		}

		const combined = new Uint8Array(totalSize);
		let pos = 0;

		for(const frame of frames) {

			combined.set(
				frame,
				pos
			);
			pos += frame.length;
		
		}

		return combined;
	
	}

	buildFlacWithMetadata(flacFrames, metadata, coverImage = null) {

		const existingBlocks = this.parseFlacBlocks(flacFrames);
		const streamInfo = existingBlocks.find(b =>
			b.type === 0);
		
		if(!streamInfo) {

			throw new Error("no streaminfo in source");
		
		}

		const blocks = [streamInfo];

		const vorbisBlock = this.flacProcessor.buildVorbisComment(metadata);

		blocks.push({
			type: this.VORBIS_COMMENT_TYPE,
			data: vorbisBlock
		});

		if(coverImage) {

			const pictureBlock = this.flacProcessor.buildPictureBlock(coverImage);

			blocks.push({
				type: this.PICTURE_TYPE,
				data: pictureBlock
			});
		
		}

		const audioFrames = this.extractAudioFrames(flacFrames);

		return this.buildFlacFile(
			blocks,
			audioFrames
		);
	
	}

	parseFlacBlocks(flacData) {

		const blocks = [];
		const view = new DataView(
			flacData.buffer,
			flacData.byteOffset
		);
		
		if(flacData.length < 4 || view.getUint32(
			0,
			false
		) !== this.FLAC_SIGNATURE) {

			return blocks;
		
		}

		let pos = 4;

		while(pos + 4 <= flacData.length) {

			const blockHeader = view.getUint32(
				pos,
				false
			);
			const isLast = (blockHeader & 0x80000000) !== 0;
			const blockType = (blockHeader >>> 24) & 0x7F;
			const blockSize = blockHeader & 0x00FFFFFF;

			if(pos + 4 + blockSize > flacData.length)
				break;

			blocks.push({
				type: blockType,
				data: flacData.subarray(
					pos + 4,
					pos + 4 + blockSize
				)
			});

			pos += 4 + blockSize;

			if(isLast)
				break;
		
		}

		return blocks;
	
	}

	extractAudioFrames(flacData) {

		const view = new DataView(
			flacData.buffer,
			flacData.byteOffset
		);
		let pos = 4;

		while(pos + 4 <= flacData.length) {

			const blockHeader = view.getUint32(
				pos,
				false
			);
			const isLast = (blockHeader & 0x80000000) !== 0;
			const blockSize = blockHeader & 0x00FFFFFF;

			pos += 4 + blockSize;

			if(isLast)
				break;
		
		}

		return flacData.subarray(pos);
	
	}

	buildFlacFile(blocks, audioFrames) {

		let metadataSize = 4;

		for(const block of blocks) {

			metadataSize += 4 + block.data.length;
		
		}

		const totalSize = metadataSize + audioFrames.length;
		const output = new Uint8Array(totalSize);
		const view = new DataView(output.buffer);

		let pos = 0;

		view.setUint32(
			pos,
			this.FLAC_SIGNATURE,
			false
		);
		pos += 4;

		for(let i = 0; i < blocks.length; i++) {

			const block = blocks[i];
			const isLast = i === blocks.length - 1;
			
			const header = ((isLast ? 0x80000000 : 0) | (block.type << 24) | block.data.length) >>> 0;
			
			view.setUint32(
				pos,
				header,
				false
			);
			pos += 4;

			output.set(
				block.data,
				pos
			);
			pos += block.data.length;
		
		}

		output.set(
			audioFrames,
			pos
		);

		return output;
	
	}

}