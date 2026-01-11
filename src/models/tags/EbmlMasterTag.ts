import { concatUint8Arrays, readVint } from "../../tools";
import { EbmlTag } from "../EbmlTag";
import { EbmlTagFactory } from "../EbmlTagFactory";
import { EbmlElementType } from "../enums/EbmlElementType";
import { EbmlTagPosition } from "../enums/EbmlTagPosition";

export class EbmlMasterTag extends EbmlTag {
	private _children: EbmlTag[] = [];
	public override readonly type = EbmlElementType.Master as const;

	get Children(): EbmlTag[] {
		return this._children;
	}
	set Children(value: EbmlTag[]) {
		this._children = value;
	}

	constructor(id: number, position: EbmlTagPosition = EbmlTagPosition.Content) {
		super(id, EbmlElementType.Master, position);
	}

	encodeContent(): Uint8Array {
		return concatUint8Arrays(...this._children.map((child) => child.encode()));
	}

	parseContent(content?: Uint8Array): void {
		if (!content) return;
		let offset = 0;
		while (offset < content.byteLength) {
			const tagVint = readVint(content, offset);
			if (!tagVint) break;
			const sizeVint = readVint(content, offset + tagVint.length);
			if (!sizeVint) break;

			let tagId = 0;
			for (let i = 0; i < tagVint.length; i++) {
				tagId = (tagId << 8) | content[offset + i];
			}

			const tagObject = EbmlTagFactory.create(tagId);
			tagObject.size = sizeVint.value;

			const headerLength = tagVint.length + sizeVint.length;
			const contentStart = offset + headerLength;
			const totalTagLength = headerLength + sizeVint.value;

			tagObject.parseContent(
				content.subarray(contentStart, contentStart + sizeVint.value),
			);
			this._children.push(tagObject);

			offset += totalTagLength;
		}
	}
}
