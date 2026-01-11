import { concatUint8Arrays, writeVint } from "../tools";
import type { EbmlElementType } from "./enums/EbmlElementType";
import { EbmlTagId } from "./enums/EbmlTagId";
import type { EbmlTagPosition } from "./enums/EbmlTagPosition";

export abstract class EbmlTag {
	size = 0;

	constructor(
		public id: number,
		public type: EbmlElementType,
		public position: EbmlTagPosition,
	) {}

	protected abstract encodeContent(): Uint8Array;

	public abstract parseContent(content: Uint8Array): void;

	private getTagDeclaration(): Uint8Array {
		if (this.id <= 0xff) return new Uint8Array([this.id]);
		if (this.id <= 0xffff)
			return new Uint8Array([this.id >> 8, this.id & 0xff]);
		if (this.id <= 0xffffff)
			return new Uint8Array([
				(this.id >> 16) & 0xff,
				(this.id >> 8) & 0xff,
				this.id & 0xff,
			]);
		return new Uint8Array([
			(this.id >>> 24) & 0xff,
			(this.id >> 16) & 0xff,
			(this.id >> 8) & 0xff,
			this.id & 0xff,
		]);
	}

	public encode(): Uint8Array {
		const content = this.encodeContent();

		if (this.size === -1) {
			const vintSize = new Uint8Array([
				0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
			]);
			return concatUint8Arrays(this.getTagDeclaration(), vintSize, content);
		}
		const isSegment = this.id === EbmlTagId.Segment;
		const isCluster = this.id === EbmlTagId.Cluster;
		const specialLength: number = isSegment || isCluster ? 8 : 0;
		const vintSize = writeVint(content.byteLength, specialLength);

		return concatUint8Arrays(this.getTagDeclaration(), vintSize, content);
	}
}
