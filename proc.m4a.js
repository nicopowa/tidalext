const FLAC_SIGNATURE = 0x664C6143; // fLaC

// mp4 atoms
const MOOV = 0x6D6F6F76;
const MDAT = 0x6D646174;
const MOOF = 0x6D6F6F66;
const STYP = 0x73747970;
const FTYP = 0x66747970;
const DFLA = 0x64664C61;

class M4aProcessor {

	constructor() {

		this.encoder = new TextEncoder();
		this.TAG_MAP = {
			"TRACK": "TRACKNUMBER",
			"YEAR": "DATE",
			"COMMENTS": "DESCRIPTION"
		};
	
	}

	/**
     * @param {Uint8Array} buffer : dash segments init + media
     * @param {Object} metadata : tags
     * @param {Object} coverData : cover
     */
	async injectMetadata(buffer, metadata, coverData) {

		const {
			streamInfo, audioChunks, totalAudioLength
		} = this.parseMp4Container(buffer);

		if(!streamInfo) {

			// fallback
			if(this.isRawFlac(buffer)) {

				return this.rebuildRawFlac(
					buffer,
					metadata,
					coverData
				);
			
			}

			throw new Error("could not find FLAC streamInfo in mp4 container");
		
		}

		return this.buildFlac(
			streamInfo,
			audioChunks,
			totalAudioLength,
			metadata,
			coverData
		);
	
	}

	isRawFlac(buffer) {

		if(buffer.length < 4)
			return false;

		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);

		return view.getUint32(
			0,
			false
		) === FLAC_SIGNATURE;
	
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

					// look for 'm' (moov/moof/mdat), 's' (styp), 'f' (ftyp) signatures
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

	buildFlac(streamInfo, audioChunks, totalAudioLen, metadata, coverImage) {

		// prepare metadata blocks
		const vorbisBlock = this.buildVorbisComment(metadata);
		let pictureBlock = null;

		if(coverImage && coverImage.data) {

			pictureBlock = this.buildPictureBlock(coverImage);
		
		}

		// calc output size
		let totalSize = 4 + 38 + (4 + vorbisBlock.length);

		if(pictureBlock)
			totalSize += (4 + pictureBlock.length);

		totalSize += totalAudioLen;

		const output = new Uint8Array(totalSize);
		const view = new DataView(output.buffer);
		let pos = 0;

		// flac header
		view.setUint32(
			pos,
			FLAC_SIGNATURE,
			false
		);
		pos += 4;

		// streamInfo (block type 0)
		// last=0, type=0, size=34 => 0x00000022
		view.setUint32(
			pos,
			0x00000022,
			false
		);
		pos += 4;
		output.set(
			streamInfo,
			pos
		);
		pos += 34;

		// vorbis comment (block type 4)
		const isLastMeta = !pictureBlock;
		const vorbisHeader = ((isLastMeta ? 1 : 0) << 31) | (4 << 24) | (vorbisBlock.length & 0xFFFFFF);

		view.setUint32(
			pos,
			vorbisHeader >>> 0,
			false
		);
		pos += 4;
		output.set(
			vorbisBlock,
			pos
		);
		pos += vorbisBlock.length;

		// picture (block type 6) / optional
		if(pictureBlock) {

			const picHeader = (1 << 31) | (6 << 24) | (pictureBlock.length & 0xFFFFFF);

			view.setUint32(
				pos,
				picHeader >>> 0,
				false
			);
			pos += 4;
			output.set(
				pictureBlock,
				pos
			);
			pos += pictureBlock.length;
		
		}

		// audio frames
		for(const chunk of audioChunks) {

			output.set(
				chunk,
				pos
			);
			pos += chunk.length;
		
		}

		return output;
	
	}

	buildVorbisComment(metadata) {

		const vendorBytes = this.encoder.encode("MetaFlaque");
		const entries = [];

		for(const [key, value] of Object.entries(metadata)) {

			if(key && value) {

				const finalKey = this.TAG_MAP[key.toUpperCase()] || key.toUpperCase();
				const entryStr = `${finalKey}=${value}`;

				entries.push(this.encoder.encode(entryStr));
			
			}
		
		}

		let totalSize = 4 + vendorBytes.length + 4;

		entries.forEach(e =>
			totalSize += (4 + e.length));

		const block = new Uint8Array(totalSize);
		const view = new DataView(block.buffer);
		let pos = 0;

		view.setUint32(
			pos,
			vendorBytes.length,
			true
		);
		pos += 4;
		block.set(
			vendorBytes,
			pos
		);
		pos += vendorBytes.length;

		view.setUint32(
			pos,
			entries.length,
			true
		);
		pos += 4;

		for(const entry of entries) {

			view.setUint32(
				pos,
				entry.length,
				true
			);
			pos += 4;
			block.set(
				entry,
				pos
			);
			pos += entry.length;
		
		}

		return block;
	
	}

	buildPictureBlock(coverDat) {

		const imageBytes = new Uint8Array(coverDat.data);
		const mimeType = coverDat.type || "image/jpeg";
		const mimeBytes = this.encoder.encode(mimeType);
        
		const totalSize = 32 + mimeBytes.length + imageBytes.length;
		const block = new Uint8Array(totalSize);
		const view = new DataView(block.buffer);
		let pos = 0;

		view.setUint32(
			pos,
			3,
			false
		);
		pos += 4; // type 3 (front)
		view.setUint32(
			pos,
			mimeBytes.length,
			false
		);
		pos += 4;
		block.set(
			mimeBytes,
			pos
		);
		pos += mimeBytes.length;
		view.setUint32(
			pos,
			0,
			false
		);
		pos += 4; // desc Len
		view.setUint32(
			pos,
			0,
			false
		);
		pos += 4; // width
		view.setUint32(
			pos,
			0,
			false
		);
		pos += 4; // height
		view.setUint32(
			pos,
			24,
			false
		);
		pos += 4; // depth
		view.setUint32(
			pos,
			0,
			false
		);
		pos += 4; // colors
		view.setUint32(
			pos,
			imageBytes.length,
			false
		);
		pos += 4;
		block.set(
			imageBytes,
			pos
		);
        
		return block;
	
	}

	rebuildRawFlac(data, metadata, coverImage) {

		const view = new DataView(
			data.buffer,
			data.byteOffset,
			data.byteLength
		);
        
		// find end of existing metadata
		let endPos = 4;

		while(endPos < data.length) {

			const h = view.getUint32(
				endPos,
				false
			);
			const isLast = (h & 0x80000000) !== 0;
			const size = h & 0x00FFFFFF;

			endPos += 4 + size;

			if(isLast)
				break;
		
		}
        
		const firstHeader = view.getUint32(
			4,
			false
		);
		const firstSize = firstHeader & 0x00FFFFFF;
		const streamInfo = data.slice(
			8,
			8 + firstSize
		);
		const audio = data.slice(endPos);
        
		return this.buildFlac(
			streamInfo,
			[audio],
			audio.length,
			metadata,
			coverImage
		);
	
	}

}

export {
	M4aProcessor
};