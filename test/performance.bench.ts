import { bench, describe } from "vitest";
import { EbmlStreamDecoder } from "../src/EbmlStreamDecoder";
import { EbmlStreamEncoder } from "../src/EbmlStreamEncoder";
import { EbmlTagFactory } from "../src/models/EbmlTagFactory";
import { EbmlTagId } from "../src/models/enums/EbmlTagId";
import { EbmlTagPosition } from "../src/models/enums/EbmlTagPosition";
import type { EbmlDataTag } from "../src/models/tags/EbmlDataTag";

describe("EBML Stream Performance", () => {
	// Create a buffer of 1MB filled with many EBML tags
	// Tag: 0x4286 (EBMLVersion), VINT Size 0x81 (1 byte), Data 0x01
	// Full tag: [0x42, 0x86, 0x81, 0x01]
	const singleTag = new Uint8Array([0x42, 0x86, 0x81, 0x01]);
	const tagCount = 2000;
	const largeBuffer = new Uint8Array(tagCount * singleTag.length);
	for (let i = 0; i < tagCount; i++) {
		largeBuffer.set(singleTag, i * singleTag.length);
	}

	bench("Decoder - small chunks (O(N^2) test)", async () => {
		const decoder = new EbmlStreamDecoder();
		const reader = decoder.readable.getReader();
		const writer = decoder.writable.getWriter();

		// Use a promise to drain the readable
		const drain = (async () => {
			while (true) {
				const { done } = await reader.read();
				if (done) break;
			}
		})();

		// Write in very small chunks to trigger concatenation
		for (let i = 0; i < largeBuffer.length; i += 4) {
			await writer.write(largeBuffer.subarray(i, i + 4));
		}
		await writer.close();
		await drain;
	});

	bench("Decoder - large chunks", async () => {
		const decoder = new EbmlStreamDecoder();
		const reader = decoder.readable.getReader();
		const writer = decoder.writable.getWriter();

		const drain = (async () => {
			while (true) {
				const { done } = await reader.read();
				if (done) break;
			}
		})();

		await writer.write(largeBuffer);
		await writer.close();
		await drain;
	});

	const tagsToEncode: EbmlDataTag[] = [];
	for (let i = 0; i < tagCount; i++) {
		const tag = EbmlTagFactory.create(EbmlTagId.EBMLVersion) as EbmlDataTag;
		tag.data = 1;
		tag.position = EbmlTagPosition.Content;
		tagsToEncode.push(tag);
	}

	bench("Encoder - many tags", async () => {
		const encoder = new EbmlStreamEncoder();
		const reader = encoder.readable.getReader();
		const writer = encoder.writable.getWriter();

		const drain = (async () => {
			while (true) {
				const { done } = await reader.read();
				if (done) break;
			}
		})();

		for (const tag of tagsToEncode) {
			await writer.write(tag);
		}
		await writer.close();
		await drain;
	});
});
