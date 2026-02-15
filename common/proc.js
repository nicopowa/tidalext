class BaseProcessor {

	constructor() {

		this.encoder = new TextEncoder();
		this.VENDOR_STRING = this.encoder.encode("Flaque");
		this.FLAC_SIGNATURE = 0x664C6143;
	
	}

	injectMetadata(buffer, metadata, coverImage = null) {

		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength
		);

		if(buffer.length < 8 || view.getUint32(
			0,
			false
		) !== this.FLAC_SIGNATURE) {

			console.error("invalid flac");

			return buffer;
		
		}

		return this.rebuildRawFlac(
			buffer,
			metadata,
			coverImage
		);
	
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
			this.FLAC_SIGNATURE,
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

		const entries = [];

		let totalSize = 4 + this.VENDOR_STRING.length + 4;

		for(const [key, value] of Object.entries(metadata)) {

			if(key && value) {

				const finalKey = key.toUpperCase();
				const entry = this.encoder.encode(`${finalKey}=${value}`);

				entries.push(entry);
				totalSize += 4 + entry.length;
			
			}
		
		}

		const block = new Uint8Array(totalSize);
		const view = new DataView(block.buffer);
		let pos = 0;

		view.setUint32(
			pos,
			this.VENDOR_STRING.length,
			true
		);
		pos += 4;
		block.set(
			this.VENDOR_STRING,
			pos
		);
		pos += this.VENDOR_STRING.length;

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
		pos += 4; // desc length
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

}

export {
	BaseProcessor
};
