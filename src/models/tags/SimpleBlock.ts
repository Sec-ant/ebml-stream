import { concatUint8Arrays, readVint } from "../../tools";
import { EbmlTagId } from "../enums/EbmlTagId";
import { Block } from "./Block";

export class SimpleBlock extends Block {
	discardable: boolean | undefined;
	keyframe: boolean | undefined;

	constructor() {
		super(EbmlTagId.SimpleBlock);
	}

	encodeContent(): Uint8Array {
		const flags = this.writeFlagsBuffer();

		if (this.keyframe) flags[0] |= 0x80;
		if (this.discardable) flags[0] |= 0x01;

		return concatUint8Arrays(
			this.writeTrackBuffer(),
			this.writeValueBuffer(),
			flags,
			this.payload,
		);
	}

	parseContent(data: Uint8Array): void {
		super.parseContent(data);

		const track = readVint(data);
		if (!track) return;
		const flags: number = data[track.length + 2];
		this.keyframe = Boolean(flags & 0x80);
		this.discardable = Boolean(flags & 0x01);
	}
}
