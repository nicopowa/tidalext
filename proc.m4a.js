class M4aProcessor {

	constructor() {

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