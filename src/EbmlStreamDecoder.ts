import type { EbmlTag } from "./models/EbmlTag";
import { EbmlTagFactory } from "./models/EbmlTagFactory";
import { EbmlElementType } from "./models/enums/EbmlElementType";
import type { EbmlTagId } from "./models/enums/EbmlTagId";
import { EbmlTagPosition } from "./models/enums/EbmlTagPosition";
import type { EbmlDataTag } from "./models/tags/EbmlDataTag";
import type { EbmlMasterTag } from "./models/tags/EbmlMasterTag";
import { readVint } from "./tools";

export type EbmlStreamDecoderOptions = {
	bufferTagIds?: EbmlTagId[];
};

function getTransformer(
	options?: EbmlStreamDecoderOptions,
): Transformer<Uint8Array, EbmlTag> & { getBuffer(): Uint8Array } {
	let currentBufferOffset = 0;
	const tagStack: ProcessingTag[] = [];

	let buffer = new Uint8Array(8192); // Initial capacity
	let bufferLength = 0;
	let bufferOffset = 0;

	const _bufferTagIds: EbmlTagId[] = options?.bufferTagIds ?? [];

	const advanceBuffer = (length: number): void => {
		currentBufferOffset += length;
		bufferOffset += length;
	};

	const getActiveBuffer = () => buffer.subarray(bufferOffset, bufferLength);

	const readTagHeader = (buf: Uint8Array): ProcessingTag | undefined => {
		if (buf.byteLength === 0) return;

		const tagVint = readVint(buf, 0);
		if (!tagVint) return;
		const sizeVint = readVint(buf, tagVint.length);
		if (!sizeVint) return;

		let tagId = 0;
		for (let i = 0; i < tagVint.length; i++) {
			tagId = (tagId << 8) | buf[i];
		}

		const tagObject = EbmlTagFactory.create(tagId);
		tagObject.size = sizeVint.value;

		return Object.assign(tagObject, {
			absoluteStart: currentBufferOffset,
			tagHeaderLength: tagVint.length + sizeVint.length,
		});
	};

	const makeTag = (
		processingTag: ProcessingTag,
		position: EbmlTagPosition,
		data?: Uint8Array,
	): EbmlTag => {
		const tag: EbmlTag = EbmlTagFactory.create(processingTag.id);
		tag.size = processingTag.size;
		tag.position = position;
		if (position === EbmlTagPosition.Content) {
			if (data === undefined)
				throw Error("Data must be provided when position is of type Content");
			tag.parseContent(data);
		}
		return tag;
	};

	return {
		start() {
			bufferLength = 0;
			bufferOffset = 0;
			currentBufferOffset = 0;
		},
		transform(chunk, controller): void {
			const needed = bufferLength - bufferOffset + chunk.length;
			if (needed > buffer.length - bufferOffset) {
				// Not enough space at the end
				if (needed <= buffer.length) {
					// Fits if we move to the start
					buffer.set(buffer.subarray(bufferOffset, bufferLength), 0);
				} else {
					// Need to grow
					let newCapacity = buffer.length * 2;
					while (newCapacity < needed) newCapacity *= 2;
					const newBuffer = new Uint8Array(newCapacity);
					newBuffer.set(buffer.subarray(bufferOffset, bufferLength), 0);
					buffer = newBuffer;
				}
				bufferLength = bufferLength - bufferOffset;
				bufferOffset = 0;
			}
			buffer.set(chunk, bufferLength);
			bufferLength += chunk.length;

			while (true) {
				const activeBuffer = getActiveBuffer();
				const currentTag = readTagHeader(activeBuffer);
				if (!currentTag) break;

				if (
					currentTag.type === EbmlElementType.Master &&
					!_bufferTagIds.some((i) => i === currentTag.id)
				) {
					tagStack.push(currentTag);
					controller.enqueue(makeTag(currentTag, EbmlTagPosition.Start));
					advanceBuffer(currentTag.tagHeaderLength);
					continue;
				}
				if (
					activeBuffer.byteLength <
					currentTag.tagHeaderLength + currentTag.size
				)
					break;

				const data = activeBuffer.subarray(
					currentTag.tagHeaderLength,
					currentTag.tagHeaderLength + currentTag.size,
				);
				controller.enqueue(makeTag(currentTag, EbmlTagPosition.Content, data));
				advanceBuffer(currentTag.tagHeaderLength + currentTag.size);

				while (tagStack.length > 0) {
					const nextTag = tagStack[tagStack.length - 1];
					if (
						currentBufferOffset <
						nextTag.absoluteStart + nextTag.tagHeaderLength + nextTag.size
					) {
						break;
					}
					controller.enqueue(makeTag(nextTag, EbmlTagPosition.End));
					tagStack.pop();
				}
			}
		},
		getBuffer() {
			return getActiveBuffer();
		},
	};
}

export class EbmlStreamDecoder extends TransformStream<
	Uint8Array,
	EbmlMasterTag | EbmlDataTag
> {
	getBuffer: () => Uint8Array;
	constructor(options?: EbmlStreamDecoderOptions) {
		const transformer = getTransformer(options);
		super(transformer);
		this.getBuffer = transformer.getBuffer;
	}
}

type ProcessingTag = EbmlTag & {
	absoluteStart: number;
	tagHeaderLength: number;
};
