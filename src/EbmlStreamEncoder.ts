import { EbmlElementType } from "./models/enums/EbmlElementType";
import { EbmlTagId } from "./models/enums/EbmlTagId";
import { EbmlTagPosition } from "./models/enums/EbmlTagPosition";
import type { EbmlDataTag } from "./models/tags/EbmlDataTag";
import type { EbmlMasterTag } from "./models/tags/EbmlMasterTag";
import { concatUint8Arrays } from "./tools";

type EbmlTagInstance = EbmlMasterTag | EbmlDataTag;

function getTransformer(): Transformer<EbmlTagInstance, Uint8Array> & {
	getBuffer(): Uint8Array;
	getStack(): EbmlMasterTag[];
} {
	let buffer: Uint8Array = new Uint8Array(0);
	const openTags: EbmlMasterTag[] = [];

	const flush = (controller: TransformStreamDefaultController<Uint8Array>) => {
		if (buffer.byteLength === 0) return;
		controller.enqueue(buffer);
		buffer = new Uint8Array(0);
	};

	function addToBuffer(chunk: Uint8Array) {
		buffer = concatUint8Arrays(buffer, chunk);
	}

	return {
		transform(tag, controller): void {
			if (!tag) return;
			if (tag.id === undefined)
				throw new Error(`No id found for ${JSON.stringify(tag)}`);

			if (tag.position === EbmlTagPosition.Start) {
				if (openTags.length > 0) {
					openTags[openTags.length - 1].Children.push(tag);
				}
				if (tag.type === EbmlElementType.Master) {
					openTags.push(tag as EbmlMasterTag);
				}
			} else if (tag.position === EbmlTagPosition.Content) {
				if (openTags.length === 0) {
					addToBuffer(tag.encode());
					flush(controller);
					return;
				}
				openTags[openTags.length - 1].Children.push(tag);
			} else if (tag.position === EbmlTagPosition.End) {
				const inMemoryTag = openTags.pop();
				if (!inMemoryTag) {
					throw new Error(
						`Logic error - closing tag "${EbmlTagId[tag.id]}" but no tag is open`,
					);
				}
				if (tag.id !== inMemoryTag.id) {
					throw new Error(
						`Logic error - closing tag "${EbmlTagId[tag.id]}" is not expected tag "${EbmlTagId[inMemoryTag.id]}"`,
					);
				}

				if (openTags.length === 0) {
					addToBuffer(inMemoryTag.encode());
					flush(controller);
				}
			}
		},
		flush,
		getBuffer() {
			return buffer;
		},
		getStack() {
			return openTags;
		},
	};
}

export class EbmlStreamEncoder extends TransformStream<
	EbmlTagInstance,
	Uint8Array
> {
	getBuffer: () => Uint8Array;
	getStack: () => EbmlMasterTag[];
	constructor() {
		const transformer = getTransformer();
		super(transformer);
		this.getBuffer = transformer.getBuffer;
		this.getStack = transformer.getStack;
	}
}
