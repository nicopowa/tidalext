class FlacProcessor {

	constructor() {

		this.FLAC_SIGNATURE = 0x664C6143;
		this.VORBIS_COMMENT_TYPE = 4;
		this.PICTURE_TYPE = 6;
		this.VENDOR_STRING = new TextEncoder()
		.encode("MetaFlaque");
		this.encoder = new TextEncoder();
	
	}

	async process(url, metadata, messageId, coverDat = null) {

		const response = await fetch(url);

		if(!response.ok)
			throw new Error(`HTTP ${response.status}`);

		const contentLength = parseInt(response.headers.get("content-length")) || 0;

		if(!contentLength)
			throw new Error("No content");

		const reader = response.body.getReader();
		const chunks = [];
		let receivedLength = 0;
		let progressing = 0;

		try {

			while(true) {

				const {
					done, value
				} = await reader.read();

				if(done)
					break;

				chunks.push(value);
				receivedLength += value.length;

				const progress = Math.round(receivedLength / contentLength * 100);

				if(progress !== progressing) {

					this.sendProgress(progress);
					progressing = progress;
				
				}
			
			}
		
		}
		finally {

			reader.releaseLock();
		
		}

		const data = new Uint8Array(receivedLength);
		let position = 0;

		for(const chunk of chunks) {

			data.set(
				chunk,
				position
			);
			position += chunk.length;
		
		}

		let processedData = data;

		if(metadata) {

			try {

				processedData = this.injectMetadata(
					data,
					metadata,
					coverDat
				);
			
			}
			catch(err) {

				console.warn(
					"Metadata injection failed:",
					err
				);
			
			}
		
		}

		return URL.createObjectURL(new Blob(
			[processedData],
			{
				type: "audio/flac"
			}
		));

	}

	injectMetadata(buffer, metadata, coverImage = null) {

		console.log(
			"injectMetadata called with cover:",
			!!coverImage
		);
	
		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset
		);

		if(buffer.length < 8 || view.getUint32(
			0,
			false
		) !== this.FLAC_SIGNATURE) {

			console.log("Not a valid FLAC file");

			return buffer;
		
		}

		let endPos = 4;

		while(endPos + 4 <= buffer.length) {

			const blockHeader = view.getUint32(
				endPos,
				false
			);
			const blockSize = blockHeader & 0x00FFFFFF;

			endPos += 4 + blockSize;

			if(blockHeader & 0x80000000)
				break;
		
		}

		return this.replaceMetadata(
			buffer,
			metadata,
			endPos,
			coverImage
		);

	}

	replaceMetadata(buffer, metadata, endPos, coverImage) {

		console.log(
			"replaceMetadata called with cover:",
			!!coverImage
		);
	
		const blocks = this.extractBlocks(
			buffer,
			endPos
		);
		const vorbisBlock = this.buildVorbisComment(metadata);
	
		const newBlocks = [blocks[0]]; // keep STREAMINFO

		newBlocks.push({
			type: this.VORBIS_COMMENT_TYPE,
			data: vorbisBlock
		});
	
		if(coverImage) {

			console.log(
				"Building picture block, cover data size:",
				coverImage.data.byteLength
			);
			
			const pictureBlock = this.buildPictureBlock(coverImage);

			console.log(
				"Picture block size:",
				pictureBlock.length
			);

			newBlocks.push({
				type: this.PICTURE_TYPE,
				data: pictureBlock
			});
		
		}
		else {

			console.log("no cover image provided");
		
		}

		// non-metadata blocks
		for(let i = 1; i < blocks.length; i++) {

			const block = blocks[i];

			if(block.type !== this.VORBIS_COMMENT_TYPE && block.type !== this.PICTURE_TYPE) {

				newBlocks.push(block);
			
			}
		
		}

		console.log(
			"Total blocks:",
			newBlocks.length
		);

		return this.buildOutput(
			newBlocks,
			buffer,
			endPos
		);

	}

	extractBlocks(buffer, endPos) {

		const blocks = [];
		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset
		);
		let pos = 4;
		
		while(pos < endPos) {

			const blockHeader = view.getUint32(
				pos,
				false
			);
			const type = (blockHeader >>> 24) & 0x7F;
			const size = blockHeader & 0x00FFFFFF;
			
			blocks.push({
				type,
				data: buffer.subarray(
					pos + 4,
					pos + 4 + size
				)
			});
			pos += 4 + size;
		
		}
		
		return blocks;
	
	}

	buildVorbisComment(metadata) {

		const entries = [];
		let totalSize = 4 + this.VENDOR_STRING.length + 4;

		for(const [key, value] of Object.entries(metadata)) {

			if(key && value) {

				const entry = this.encoder.encode(`${key.toUpperCase()}=${value}`);

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

	buildPictureBlock(imageData) {

		const imageBytes = new Uint8Array(imageData.data);
		const mimeBytes = this.encoder.encode(imageData.type || "image/jpeg");
		const totalSize = 32 + mimeBytes.length + imageBytes.length;
	
		console.log(
			"buildPictureBlock - image bytes length:",
			imageBytes.length,
			"mime:",
			imageData.type
		);
	
		const block = new Uint8Array(totalSize);
		const view = new DataView(block.buffer);
		let pos = 0;
	
		// cover front
		view.setUint32(
			pos,
			3,
			false
		);
		pos += 4;
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
	
		// desc length (0) + dimensions + color info
		view.setUint32(
			pos,
			0,
			false
		); pos += 4; // desc length
		view.setUint32(
			pos,
			0,
			false
		); pos += 4; // width
		view.setUint32(
			pos,
			0,
			false
		); pos += 4; // height
		view.setUint32(
			pos,
			24,
			false
		); pos += 4; // color depth
		view.setUint32(
			pos,
			0,
			false
		); pos += 4; // num colors
	
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

	buildOutput(blocks, originalBuffer, endPos) {

		let metadataSize = 4;

		for(const block of blocks) {

			metadataSize += 4 + block.data.length;
		
		}

		const audioSize = originalBuffer.length - endPos;
		const output = new Uint8Array(metadataSize + audioSize);
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
			originalBuffer.subarray(endPos),
			pos
		);

		return output;
	
	}

	sendProgress(progress) {

		browser.runtime.sendMessage({
			type: "loadProgress",
			progress: progress
		})
		.catch(() => {});
	
	}

}