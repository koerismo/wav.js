/*
javascript WAV file reading library - By Baguettery

Thanks, documentation at  https://web.archive.org/web/20141101112743/http:/www.sonicspot.com/guide/wavefiles.html  for making this possible!
*/


String.prototype.bytes = function() { return this.split('').map((x)=>{return x.charCodeAt()}) }
Number.prototype.bytes = function(len) { return Array(len).fill('').map((x,y)=>{return (this >>> y*8) & 0xFF }) }


class wave {
	constructor(data) {
		this.raw = Array.from(data)
		this.chunks = this._readChunks().map((x)=>{return this._decodeChunk(x)})

		if (!this._dataChunk || !this._formatChunk) {}
	}

	get properties() {
		return this._formatChunk.content
	}

	get sampleCount() {
		return this._dataChunk.content.data.length/this._formatChunk.content.num_channels
	}

	nBitInt(arr) {
		var out = 0
		arr.forEach((x,y)=>{ out += x << (y*8) })
		return out
	}

	b32int(arr) {return new Uint32Array( (new Uint8Array(arr)).buffer.slice(-4) )[0]}
	b16int(arr) {return new Uint16Array( (new Uint8Array(arr)).buffer.slice(-2) )[0]}
	b8str(arr) {return new TextDecoder().decode(new Uint8Array(arr))}

	_getChunkInd(t) {
		let out = -1
		this.chunks.forEach((x,y)=>{
			if (x.type == t) {out = y}
		})
		return out
	}

	get _formatChunk() {
		const chunkind = this._getChunkInd('fmt')
		if (chunkind == -1) {throw('File is missing format (fmt) chunk!')}
		return this.chunks[chunkind]
	}

	get _dataChunk() {
		// TODO: Allow using multiple data chunks!
		const chunkind = this._getChunkInd('data')
		if (chunkind == -1) {throw('File is missing data (data) chunk!')}
		return this.chunks[chunkind]
	}

	_readChunks() {

		var pos = 4*3 // First chunk ID is always RIFF (0x52494646)
		var chunks = []

		var chunksRead = 0 // Temporary. Just to make sure that I don't crash the browser.

		while (pos < (this.raw.length-1) && chunksRead < 500) {
			chunksRead += 1

			//console.log(`Reading chunk #${chunksRead} at ${pos} with ${this.raw.length-pos} remaining.`)

			var chunkID   = this.b32int(this.raw.slice(pos,pos+4))
			var chunkSize = this.b32int(this.raw.slice(pos+4,pos+8))
			var chunkData = this.raw.slice(pos+8,pos+8+chunkSize) // Starts at byte 8 in chunk after headers
			chunks.push({
				id: chunkID,
				size: chunkSize,
				data: chunkData
			})
			pos += (8+chunkSize)
		}

		return chunks
	}

	_decodeChunk(chunk) {
		//console.log('Parsed chunk type as ',this.b8str((chunk.id).bytes(4)))
		var out = {type:'unknown', id:chunk.id, size: chunk.size, content:{data: chunk.data}}

		const self = this // Honestly fuck you javascript
		function b16(start) {return self.b16int(chunk.data.slice(start,start+2))}
		function b32(start) {return self.b32int(chunk.data.slice(start,start+4))}

		switch(chunk.id) {
			case 1635017060: // data
				out = {
					type: 'data',
					size: chunk.size,
					id: 1635017060,
					content: {
						data:	chunk.data // TODO: split into channels
					}
				}
				break;
			case 544501094: // fmt
				out = {
					type: 'fmt',
					size: chunk.size,
					id: 544501094,
					content: {
						compression_code:	b16(0),
						num_channels:		b16(2),
						sample_rate:		b32(4),
						avg_bytes_per_second:	b32(8),
						block_align:		b16(12),
						signif_bits_per_sample:	b16(14)
					}
				}
				break;
			case 1819307379: // smpl
				out = {
					type: 'smpl',
					size: chunk.size,
					id: 1819307379,
					content: {
						manufacturer_id:	b32(0),
						product_id:		b32(4),
						sample_period:		b32(8),
						midi_unity_note:	b32(12),
						midi_pitch_fraction:	b32(16),
						SMPTE_format:		b32(20),
						SMPTE_offset:		b32(24),
						num_sample_loops:	b32(28),
						sampler_data:		b32(32),
						sample_loops:		this._decodeSampleLoops(chunk.data.slice(36))
					}
				}
				break;
			case 543520099: // cue
				out = {
					type: 'cue',
					size: chunk.size,
					id: 543520099,
					content: {
						cues: this._decodeCuePoints(chunk.data),
						data: chunk.data // Temporary export support. This makes all of the calculated values above read-only.
					}
				}
				break;
			/*case 1952670054: // fact
				out.type = 'fact'
				break;
			case 1953393779: // slnt
				out.type = 'slnt'
				break;*/
		}

		return out
	}

	_decodeCuePoints(cueChunk) {
		var out = []
		for (var pos = 0; pos < cueChunk.length; pos += 24) {
		out.push({
				id:		this.b32int(cueChunk.slice(0,4)),
				position:	this.b32int(cueChunk.slice(4,8)),
				data_chunk_id:	this.b32int(cueChunk.slice(8,12)),
				chunk_start:	this.b32int(cueChunk.slice(12,16)),
				block_start:	this.b32int(cueChunk.slice(16,20)),
				sample_offset:	this.b32int(cueChunk.slice(20,24))
			})
		}
		return out
	}

	_encodeCuePoints() {} // TODO: empty

	_decodeSampleLoops(sampleChunk) {
		var out = []
		for (var pos = 0; pos < sampleChunk.length; pos += 24) {
			out.push({
				id:		this.b32int(sampleChunk.slice(0,4)),
				type:		this.b32int(sampleChunk.slice(4,8)),
				start:		this.b32int(sampleChunk.slice(8,12)),
				end:		this.b32int(sampleChunk.slice(12,16)),
				fraction:	this.b32int(sampleChunk.slice(16,20)),
				play_count:	this.b32int(sampleChunk.slice(20,24))
			})
		}
		return out
	}

	_encodeSampleLoops(chunks) {
		var out = []
		chunks.forEach((cueChunk)=>{
			out = out.concat([ // This is super inefficient. So sue me.
				...cueChunk.id.bytes(4),
				...cueChunk.type.bytes(4),
				...cueChunk.start.bytes(4),
				...cueChunk.end.bytes(4),
				...cueChunk.fraction.bytes(4),
				...cueChunk.play_count.bytes(4)
			])
		})
		return out
	}

	_encodeChunk(chunk) {
		var out = null
		switch(chunk.type) {
			case 'fmt':
				out = [
					...chunk.id.bytes(4),
					...chunk.size.bytes(4),
					...chunk.content.compression_code.bytes(2),
					...chunk.content.num_channels.bytes(2),
					...chunk.content.sample_rate.bytes(4),
					...chunk.content.avg_bytes_per_second.bytes(4),
					...chunk.content.block_align.bytes(2),
					...chunk.content.signif_bits_per_sample.bytes(2)
				]
				break;
			case 'smpl':
				out = [
					...chunk.id.bytes(4),
					...(36+chunk.content.sample_loops.length*24).bytes(4),
					...chunk.content.manufacturer_id.bytes(4),
					...chunk.content.product_id.bytes(4),
					...chunk.content.sample_period.bytes(4),
					...chunk.content.midi_unity_note.bytes(4),
					...chunk.content.midi_pitch_fraction.bytes(4),
					...chunk.content.SMPTE_format.bytes(4),
					...chunk.content.SMPTE_offset.bytes(4),
					...chunk.content.num_sample_loops.bytes(4),
					...chunk.content.sampler_data.bytes(4),
					...this._encodeSampleLoops(chunk.content.sample_loops)

				]
				break;
			default:
				out = [
					...chunk.id.bytes(4),
					...chunk.content.data.length.bytes(4),
					...chunk.content.data
				]
				break;
		}
		return out
	}


	_writeChunks() {
		var body = []
		this.chunks.forEach((x)=>{body = body.concat(this._encodeChunk(x))})

		var header = [
			...'RIFF'.bytes(4),
			...body.length.bytes(4),
			...'WAVE'.bytes(4)
		]

		return new Uint8Array(header.concat(body))
	}


	/* Friendly-er functions for audio manipulation */

	audioResample(new_rate) {
		// Number to increment by in bytes.
		const increment = this._formatChunk.content.signif_bits_per_sample/8
		const mult = this._formatChunk.content.sample_rate/new_rate
		const data_orig = this._dataChunk.content.data

		var out = new Uint8Array(data_orig.length*mult)
		function nFloor(value,inc) {return Math.floor((value/inc))*inc}

		for (var pos = 0; Math.round(pos*mult) < data_orig.length; pos += increment) {

			const calcPos = nFloor(Math.round(pos*mult),increment)
			const value = this.nBitInt(  data_orig.slice(calcPos, calcPos+increment)  )
			const bytes = value.bytes(increment)

			for (let i = 0; i < increment; i++) {out[pos+i] = bytes[i]}
		}

		this._dataChunk.content.data = out
		this._formatChunk.content.sample_rate = new_rate
	}

	audioGetSample(sample_num) {
		const increment = this._formatChunk.content.signif_bits_per_sample/8
		return this.nBitInt(  data_orig.slice(sample_num*increment, calcPos*increment+increment)  )
	}

	/*
	audioVolume(vol_multiplier) { // DOES NOT WORK. I don't know how to fix this??? It looks right.
		const increment = this._formatChunk.content.signif_bits_per_sample/8
		const data_orig = this._dataChunk.content.data

		var out = new Uint8Array(data_orig.length)

		for (var pos = 0; pos < data_orig.length; pos += increment) {

			const value = this.nBitInt(  data_orig.slice(pos, pos+increment)  )
			const bytes = (value * vol_multiplier).bytes(increment)

			for (let i = 0; i < increment; i++) {out[pos+i] = bytes[i]}
		}

		this._dataChunk.content.data = out
	}

	audioBitDepth(new_depth) { // DOES NOT WORK. I really don't know what I am doing.
		const increment = this._formatChunk.content.signif_bits_per_sample/8
		const data_orig = this._dataChunk.content.data

		var out = new Uint8Array(data_orig.length)

		for (var pos = 0; pos < data_orig.length; pos += increment) {

			const value = this.nBitInt(  data_orig.slice(pos, pos+increment)  )
			const bytes = value.bytes(new_depth/8)

			const cPos = pos/increment*(new_depth/8)
			for (let i = 0; i < new_depth; i++) {out[cPos+i] = bytes[i]}
		}

		this._dataChunk.content.data = out
		this._formatChunk.content.signif_bits_per_sample = new_depth
	}


	audioSplitChannels() {}
	*/

	blob() {return new Blob([this._writeChunks()])}
}
