export function readVint(
	buffer: Uint8Array,
	start = 0,
): { length: number; value: number } | undefined {
	if (start >= buffer.length) return;

	const firstByte = buffer[start];
	if (firstByte === 0) {
		// This handles the case where length > 8 or invalid 0 byte
		// EBML VINT length is determined by the first non-zero bit
		return;
	}

	// Use clz32 to find the first set bit. firstByte is 8-bit, so it's in the top of a 32-bit int if we shift it left by 24.
	// Math.clz32(firstByte) for a byte will give 24 to 31.
	// 24 -> 10000000 -> length 1
	// 31 -> 00000001 -> length 8
	const length = Math.clz32(firstByte) - 23;

	if (length > 8) return;
	if (start + length > buffer.length) return;

	// Max representable integer in JS is 2^53
	if (
		length === 8 &&
		(buffer[start + 1] > 0x20 ||
			(buffer[start + 1] === 0x20 &&
				buffer.subarray(start + 2, start + 8).some((b) => b > 0)))
	) {
		return { length: 8, value: -1 };
	}

	let value = firstByte & (0xff >> length);
	for (let i = 1; i < length; i += 1) {
		value = value * 256 + buffer[start + i];
	}

	// EBML "all ones" value means unknown/undefined size
	if (value === (1 << (length * 7)) - 1) {
		value = -1;
	}

	return { length, value };
}

export function writeVint(value: number, desiredLength?: number): Uint8Array {
	if (value < -1 || value > 2 ** 53) {
		throw new Error(`Unrepresentable value: ${value}`);
	}

	let length = desiredLength;
	if (!length) {
		if (value === -1) {
			length = 1;
		} else {
			for (length = 1; length <= 8; length += 1) {
				if (value < 2 ** (7 * length) - 1) {
					break;
				}
			}
		}
	}

	const buffer = new Uint8Array(length);
	if (value === -1) {
		buffer.fill(0xff);
	} else {
		let val = value;
		for (let i = 1; i <= length; i += 1) {
			buffer[length - i] = val & 0xff;
			val = Math.floor(val / 256);
		}
	}
	buffer[0] |= 1 << (8 - length);

	return buffer;
}

export function padStart(val: string): string {
	if (val.length === 0) {
		return "00";
	}
	if (val.length === 1) {
		return `0${val}`;
	}
	return val;
}

export function readHexString(
	buf: Uint8Array,
	start = 0,
	end = buf.byteLength,
): string {
	let res = "";
	for (let i = start; i < end; i++) {
		const q = buf[i];
		if (q < 16) res += "0";
		res += q.toString(16);
	}
	return res;
}

export const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

export function hexStringToBuf(str: string): Uint8Array {
	const len = str.length;
	const view = new Uint8Array(len / 2);
	for (let i = 0; i < len; i += 2) {
		view[i / 2] = Number.parseInt(str.substring(i, i + 2), 16);
	}
	return view;
}

export function readUtf8(buffer: Uint8Array): string | undefined {
	try {
		return textDecoder.decode(buffer);
	} catch (_err) {
		return undefined;
	}
}

export function readUnsigned(buf: Uint8Array): number | string {
	if (buf.byteLength <= 6) {
		let res = 0;
		for (let i = 0; i < buf.byteLength; i++) {
			res = res * 256 + buf[i];
		}
		return res;
	}

	return readHexString(buf);
}

export function writeUnsigned(num: number | string): Uint8Array {
	if (typeof num === "string") {
		return hexStringToBuf(num);
	}

	if (num <= 0xffffffff) {
		if (num <= 0xff) return new Uint8Array([num]);
		if (num <= 0xffff) return new Uint8Array([num >> 8, num & 0xff]);
		if (num <= 0xffffff)
			return new Uint8Array([
				(num >> 16) & 0xff,
				(num >> 8) & 0xff,
				num & 0xff,
			]);
		return new Uint8Array([
			(num >>> 24) & 0xff,
			(num >> 16) & 0xff,
			(num >> 8) & 0xff,
			num & 0xff,
		]);
	}

	const view = new DataView(new ArrayBuffer(8));
	view.setBigUint64(0, BigInt(num));
	let firstValueIndex = 0;
	while (firstValueIndex < 7 && view.getUint8(firstValueIndex) === 0) {
		firstValueIndex++;
	}
	return new Uint8Array(view.buffer.slice(firstValueIndex));
}

export function readSigned(buf: Uint8Array): number {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	switch (buf.byteLength) {
		case 1:
			return view.getInt8(0);
		case 2:
			return view.getInt16(0);
		case 4:
			return view.getInt32(0);
		default:
			return NaN;
	}
}

export function writeSigned(num: number): Uint8Array {
	// EBML signed integers are variable length
	// This is a simple implementation that matches readSigned's expectations
	if (num >= -128 && num <= 127)
		return new Uint8Array(new Int8Array([num]).buffer);
	if (num >= -32768 && num <= 32767)
		return new Uint8Array(new Int16Array([num]).buffer).reverse(); // Big-endian
	return new Uint8Array(new Int32Array([num]).buffer).reverse(); // Big-endian
}

export function readFloat(buf: Uint8Array): number {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	switch (buf.byteLength) {
		case 4:
			return view.getFloat32(0);
		case 8:
			return view.getFloat64(0);
		default:
			return NaN;
	}
}

export function writeFloat(num: number): Uint8Array {
	return new Uint8Array(new Float32Array([num]).buffer).reverse();
}

export function concatUint8Arrays(...bufs: Uint8Array[]): Uint8Array {
	const totalLength = bufs.reduce((acc, buf) => acc + buf.byteLength, 0);
	const res = new Uint8Array(totalLength);
	let offset = 0;
	for (const buf of bufs) {
		res.set(buf, offset);
		offset += buf.byteLength;
	}
	return res;
}
