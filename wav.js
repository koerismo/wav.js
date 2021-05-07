/*
javascript WAV file reading library - By Baguettery

Thanks, documentation at  https://web.archive.org/web/20141101112743/http:/www.sonicspot.com/guide/wavefiles.html  for making this possible!
*/


String.prototype.bytes = function() { return this.split('').map((x)=>{return x.charCodeAt()}) }



class wave {
	constructor(data) {
		this.raw = Array.from(data)
		this.chunks = this.readChunks().map((x)=>{return this.parseChunk(x)})

		this.fmt = this.chunks.filter((x)=>{return x.type == 'fmt'})[0]
	}

	b32int(arr) {return new Uint32Array( (new Uint8Array(arr)).buffer.slice(-4) )[0]}
	b16int(arr) {return new Uint16Array( (new Uint8Array(arr)).buffer.slice(-2) )[0]}

	readChunks() {


		var pos = 4*3 // First chunk ID is always RIFF (0x52494646)
		var chunks = []

		var chunksRead = 0 // Temporary. Just to make sure that I don't crash the browser.

		while (pos < this.raw.length && chunksRead < 500) {
			chunksRead += 1

			var chunkID   = this.b32int(this.raw.slice(pos,pos+4))
			var chunkSize = this.b32int(this.raw.slice(pos+4,pos+8))
			var chunkData = this.raw.slice(pos+8,pos+8+chunkSize) // Starts at byte 8 in chunk after headers
			chunks.push({
				id: chunkID,
				size: chunkSize,
				data: chunkData
			})
			pos += (8+chunkSize)
			console.log(`Read chunk #${chunksRead} with type ${chunkID} and length ${chunkSize}`)
		}

		return chunks
	}

	parseChunk(chunk) {
		var out = {type:'unknown', type_id:chunk.id, content:{data: chunk.data}}
		switch(chunk.id) {
			case 1635017060: // data
				console.log('Parsed data block')
				out = {
					type: 'data',
					type_id: 1635017060,
					content: {
						data:	chunk.data // TODO: split into channels
					}
				}
				break;
			case 544501094: // fmt
				console.log('Parsed format block')
				out = {
					type: 'fmt',
					type_id: 544501094,
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
				console.log('fact')
				break;
			case 1953393779: // slnt
				console.log('slnt')
				break;
			case 543520099: // cue
				console.log('cue')
				break;
		}

		return out
	}
}
