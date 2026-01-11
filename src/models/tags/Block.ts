import {
	concatUint8Arrays,
	readSigned,
	readVint,
	writeVint,
} from "../../tools";
import { BlockLacing } from "../enums/BlockLacing";
import { EbmlElementType } from "../enums/EbmlElementType";
import { EbmlTagId } from "../enums/EbmlTagId";
import { EbmlDataTag } from "./EbmlDataTag";

export class Block extends EbmlDataTag {
	payload: Uint8Array = new Uint8Array(0);
	track: number = 0;
	value: number = 0;

	invisible: boolean | undefined;
	lacing: BlockLacing | undefined;

	constructor(subTypeId?: number) {
		super(subTypeId || EbmlTagId.Block, EbmlElementType.Binary);
	}

	protected writeTrackBuffer(): Uint8Array {
		return writeVint(this.track);
	}

	protected writeValueBuffer(): Uint8Array {
		const value = new DataView(new ArrayBuffer(2));
		value.setInt16(0, this.value);
		return new Uint8Array(value.buffer);
	}

	protected writeFlagsBuffer(): Uint8Array {
		let flags = 0x00;
		if (this.invisible) {
			flags |= 0x10;
		}

		switch (this.lacing) {
			case BlockLacing.None:
				break;
			case BlockLacing.Xiph:
				flags |= 0x04;
				break;
			case BlockLacing.EBML:
				flags |= 0x08;
				break;
			case BlockLacing.FixedSize:
				flags |= 0x0c;
				break;
		}

		return new Uint8Array([flags % 256]);
	}

	encodeContent(): Uint8Array {
		return concatUint8Arrays(
			this.writeTrackBuffer(),
			this.writeValueBuffer(),
			this.writeFlagsBuffer(),
			this.payload,
		);
	}

	parseContent(data: Uint8Array): void {
		const track = readVint(data);
		if (!track) return;
		this.track = track.value;
		this.value = readSigned(data.subarray(track.length, track.length + 2));
		const flags: number = data[track.length + 2];
		this.invisible = Boolean(flags & 0x10);
		switch (flags & 0x0c) {
			case 0x00:
				this.lacing = BlockLacing.None;
				break;

			case 0x04:
				this.lacing = BlockLacing.Xiph;
				break;

			case 0x08:
				this.lacing = BlockLacing.EBML;
				break;

			case 0x0c:
				this.lacing = BlockLacing.FixedSize;
				break;
		}
		this.payload = data.subarray(track.length + 3);
	}
}
