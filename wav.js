/*
javascript WAV file reading library - By Baguettery

Thanks, documentation at  https://web.archive.org/web/20141101112743/http:/www.sonicspot.com/guide/wavefiles.html  for making this possible!
*/


String.prototype.bytes = function() { return this.split('').map((x)=>{return x.charCodeAt()}) }
Number.prototype.bytes = function(len) { return Array(len).fill('').map((x,y)=>{return (this >>> y*8) & 0xFF }) }


class wave {
	constructor(data) {
		this.raw = Array.from(data)
		this.chunks = this.readChunks().map((x)=>{return this.decodeChunk(x)})
	}

	setSampleRate() {
		this.chunks[getFormatChunk()].content.sample_rate = ind
	}


	b32int(arr) {return new Uint32Array( (new Uint8Array(arr)).buffer.slice(-4) )[0]}
	b16int(arr) {return new Uint16Array( (new Uint8Array(arr)).buffer.slice(-2) )[0]}
	b8str(arr) {return new TextDecoder().decode(new Uint8Array(arr))}

	getChunkInd(t) {
		let out = -1
		this.chunks.forEach((x,y)=>{
			if (x.type == t) {out = y}
		})
		return out
	}

	getFormatChunk() {
		const chunkind = this.getChunkInd('fmt')
		if (chunkind == -1) {throw('File is missing format (fmt) chunk!')}
		return chunkind
	}

	readChunks() {

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
			console.log('Chunk has length', 8+chunkSize)
			pos += (8+chunkSize)
		}

		return chunks
	}

	decodeChunk(chunk) {
		//console.log('Parsed chunk type as ',this.b8str((chunk.id).bytes(4)))
		var out = {type:'unknown', id:chunk.id, size: chunk.size, content:{data: chunk.data}}
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
						compression_code:	this.b16int(chunk.data.slice(0,2)),
						num_channels:		this.b16int(chunk.data.slice(2,4)),
						sample_rate:		this.b32int(chunk.data.slice(4,8)),
						avg_bytes_per_second:	this.b32int(chunk.data.slice(8,12)),
						block_align:		this.b16int(chunk.data.slice(12,14)),
						signif_bits_per_sample:	this.b16int(chunk.data.slice(14,16))
					}
				}
				break;
			case 1952670054: // fact
				out.type = 'fact'
				break;
			case 1953393779: // slnt
				out.type = 'slnt'
				break;
			case 543520099: // cue
				out.type = 'cue'
				break;
		}

		return out
	}

	encodeChunk(chunk) {
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
			default:
				out = [
					...chunk.id.bytes(4),
					...chunk.size.bytes(4),
					...chunk.content.data
				]
				break;
		}
		console.log('Chunk has length', out.length)
		return out
	}


	writeChunks() {
		var body = []
		this.chunks.forEach((x)=>{body = body.concat(this.encodeChunk(x))})

		var header = [
			'WAVE'.bytes(4),
			body.length.bytes(4),
			'RIFF'.bytes(4)
		]

		return new Uint8Array(header.concat(body))
	}
}
