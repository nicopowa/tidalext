import {browser, DEBUG} from "./vars.js";

class FlacProcessor {

	constructor() {

		this.FLAC_SIGNATURE = 0x664C6143;
		this.VORBIS_COMMENT_TYPE = 4;
		this.PICTURE_TYPE = 6;
		this.VENDOR_STRING = new TextEncoder()
		.encode("MetaFlaque");
		this.encoder = new TextEncoder();
	
	}

	async process(dat, metadata, taskId, coverDat = null) {

		if(DEBUG) console.log("process", taskId);

		dat.url = [dat.url].flat();

		const response = await fetch(dat.url);

		if(!response.ok)
			throw new Error(`http ${response.status}`);

		const contentLength = +(response.headers.get("content-length") || 0);

		if(!contentLength)
			throw new Error("no content");

		let position = 0;
		let progress = 0;
		let data = new Uint8Array(contentLength);

		const reader = response.body.getReader();

		const processChunk = ({
			done, value
		}) => {

			if(done) {

				// download complete

				return;

			}

			data.set(
				value,
				position
			);

			position += value.length;

			const progressing = Math.ceil(position / contentLength * 100);

			if(progressing !== progress) {

				browser.runtime.sendMessage({
					type: "progress",
					task: taskId, 
					progress: progressing
				});
					
			}

			progress = progressing;

			return reader.read()
			.then(processChunk);

		};

		await reader.read()
		.then(processChunk);

		// useless ?
		reader.releaseLock();

		if(metadata) {

			try {

				data = this.injectMetadata(
					data,
					metadata,
					coverDat
				);
			
			}
			catch(err) {

				console.warn(
					"metadata inject fail",
					err
				);
			
			}
		
		}

		const blob = URL.createObjectURL(new Blob(
			[data],
			{
				type: "audio/flac"
			}
		));

		data = null;

		return blob;

	}

	injectMetadata(buffer, metadata, coverImage = null) {
	
		const view = new DataView(
			buffer.buffer,
			buffer.byteOffset
		);

		if(buffer.length < 8 || view.getUint32(
			0,
			false
		) !== this.FLAC_SIGNATURE) {

			console.error("invalid flac");

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
	
		const blocks = this.extractBlocks(
			buffer,
			endPos
		);

		const vorbisBlock = this.buildVorbisComment(metadata);
	
		// keep STREAMINFO
		const newBlocks = [blocks[0]];

		newBlocks.push({
			type: this.VORBIS_COMMENT_TYPE,
			data: vorbisBlock
		});
	
		if(coverImage) {
			
			const pictureBlock = this.buildPictureBlock(coverImage);

			newBlocks.push({
				type: this.PICTURE_TYPE,
				data: pictureBlock
			});
		
		}

		// non-metadata blocks
		for(let i = 1; i < blocks.length; i++) {

			const block = blocks[i];

			if(block.type !== this.VORBIS_COMMENT_TYPE && block.type !== this.PICTURE_TYPE) {

				newBlocks.push(block);
			
			}
		
		}

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
	
		const block = new Uint8Array(totalSize);
		const view = new DataView(block.buffer);
		let pos = 0;
	
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

		pos += 4; // color depth

		view.setUint32(
			pos,
			0,
			false
		);

		pos += 4; // num colors
	
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

		for(const block of blocks) 
			metadataSize += 4 + block.data.length;

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

}

export {FlacProcessor}