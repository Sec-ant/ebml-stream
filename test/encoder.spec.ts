import { assert, describe, it } from "vitest";
import { EbmlStreamEncoder } from "../src/EbmlStreamEncoder";
import type { EbmlTag } from "../src/models/EbmlTag";
import { EbmlTagFactory } from "../src/models/EbmlTagFactory";
import { EbmlTagId } from "../src/models/enums/EbmlTagId";
import { EbmlTagPosition } from "../src/models/enums/EbmlTagPosition";

const invalidTag = {
	id: undefined,
	type: "404NotFound",
	position: undefined,
	size: -1,
	data: null,
} as unknown as EbmlTag;

const incompleteTag = undefined as unknown as EbmlTag;

const ebmlStartTag: EbmlTag = Object.assign(
	EbmlTagFactory.create(EbmlTagId.EBML),
	{
		size: 10,
		position: EbmlTagPosition.Start,
	},
);

const ebmlEndTag: EbmlTag = Object.assign(
	EbmlTagFactory.create(EbmlTagId.EBML),
	{
		size: 10,
		position: EbmlTagPosition.End,
	},
);

const ebmlVersion1Tag: EbmlTag = Object.assign(
	EbmlTagFactory.create(EbmlTagId.EBMLVersion),
	{
		position: EbmlTagPosition.Content,
		data: 1,
	},
);

const ebmlVersion0Tag: EbmlTag = Object.assign(
	EbmlTagFactory.create(EbmlTagId.EBMLVersion),
	{
		position: EbmlTagPosition.Content,
		data: 0,
	},
);

const makeEncoderTest =
	(tags: EbmlTag[]) =>
	async (cb?: (chunk: Uint8Array) => void, ignoreNotDone = false) => {
		let isDone = false;

		const source = new ReadableStream({
			pull(controller) {
				for (const tag of tags) controller.enqueue(tag);
				controller.close();
			},
		});
		const encoder = new EbmlStreamEncoder();
		await source.pipeThrough(encoder).pipeTo(
			new WritableStream({
				write(chunk) {
					cb?.(chunk);
					isDone = true;
				},
			}),
		);
		assert.ok(
			isDone || ignoreNotDone,
			"hit end of file without checking any chunks",
		);
		return encoder;
	};

describe("EBML", () => {
	describe("Encoder", () => {
		it("should write a single tag", () =>
			makeEncoderTest([ebmlVersion1Tag])((chunk) =>
				assert.deepEqual(
					Array.from(new Uint8Array(chunk)),
					[0x42, 0x86, 0x81, 0x01],
				),
			));
		it("should write a tag with a single child", () =>
			makeEncoderTest([ebmlStartTag, ebmlVersion0Tag, ebmlEndTag])((chunk) =>
				assert.deepEqual(
					Array.from(new Uint8Array(chunk)),
					[0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x00],
				),
			));
		describe("#writeTag", () => {
			it("does nothing with incomplete tag data", async () => {
				const encoder = await makeEncoderTest([incompleteTag])(undefined, true);
				assert.strictEqual(encoder.getStack().length, 0);
			});
			it("throws with an invalid tag id", async () => {
				const err = await makeEncoderTest([invalidTag])().catch((err) => err);
				assert.instanceOf(err, Error, "Not throwing properly");
			});
		});
		describe("#startTag", () => {
			it("throws with an invalid tag id", async () => {
				const err = await makeEncoderTest([invalidTag])().catch((err) => err);
				assert.instanceOf(err, Error, "Not throwing properly");
			});
		});
		describe("#_transform", () => {
			it("should do nothing on an incomplete tag", async () => {
				const encoder = await makeEncoderTest([incompleteTag])(undefined, true);
				assert.strictEqual(encoder.getBuffer().byteLength, 0);
			});
		});
	});
});
