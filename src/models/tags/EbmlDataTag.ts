import {
	readFloat,
	readSigned,
	readUnsigned,
	readUtf8,
	textEncoder,
	writeFloat,
	writeSigned,
	writeUnsigned,
} from "../../tools";
import { EbmlTag } from "../EbmlTag";
import { EbmlElementType } from "../enums/EbmlElementType";
import { EbmlTagPosition } from "../enums/EbmlTagPosition";

export class EbmlDataTag extends EbmlTag {
	data: string | number | Uint8Array | undefined;
	public override readonly type: Exclude<
		EbmlElementType,
		EbmlElementType.Master
	>;

	constructor(
		id: number,
		type: Exclude<EbmlElementType, EbmlElementType.Master>,
	) {
		super(id, type, EbmlTagPosition.Content);
		this.type = type;
	}

	parseContent(data: Uint8Array): void {
		switch (this.type) {
			case EbmlElementType.UnsignedInt:
				this.data = readUnsigned(data);
				break;
			case EbmlElementType.Float:
				this.data = readFloat(data);
				break;
			case EbmlElementType.Integer:
				this.data = readSigned(data);
				break;
			case EbmlElementType.String:
				this.data = readUtf8(data);
				break;
			case EbmlElementType.UTF8:
				this.data = readUtf8(data);
				break;
			default:
				this.data = data;
				break;
		}
	}

	encodeContent(): Uint8Array {
		const data = this.data;
		if (data === undefined) {
			return new Uint8Array(0);
		}
		switch (this.type) {
			case EbmlElementType.UnsignedInt:
				return writeUnsigned(data as number | string);
			case EbmlElementType.Float:
				return writeFloat(data as number);
			case EbmlElementType.Integer:
				return writeSigned(data as number);
			case EbmlElementType.String:
			case EbmlElementType.UTF8:
				if (typeof data === "string") {
					return textEncoder.encode(data);
				}
				return data as Uint8Array;
			default:
				return data as Uint8Array;
		}
	}
}
