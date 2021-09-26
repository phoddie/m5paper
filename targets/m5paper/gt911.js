/*
 * Copyright (c) 2016-2021  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK Runtime.
 *
 *   The Moddable SDK Runtime is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   The Moddable SDK Runtime is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with the Moddable SDK Runtime.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

import Timer from "timer";

//@@ more buffers
//@@ interrrupt support

class GT911 {
	#io;
	#byteBuffer = new Uint8Array(1);

	constructor(options) {
		const io = this.#io = new options.io({
			hz: 200_000,		// ....data sheet warns about speeds over 200_000
			address: 0x5D,
			...options
		});

		// check id
		io.write(Uint8Array.of(0x81, 0x40));
		const data = new Uint8Array(io.read(3));
		const id = String.fromCharCode(data[0]) + String.fromCharCode(data[1]) + String.fromCharCode(data[2]);
		if ("911" !== id)
			throw new Error("unrecognized");

		if (options?.config) {
			const start = 0x8047, end = 0x80FF;
			const config = options.config;
			if (config.length !== (end - start))
				throw new Error("bad config");

			// see if configuration needs update
			let update = false;
			for (let address = start, step = 16; address < end; address += step) {
				let use = step;
				if ((address + use) > end)
					use = end - address;
				io.write(Uint8Array.of(address >> 8, address & 0xff));
				const data = new Uint8Array(super.read(use));
				for (let i = 0, offset = address - start; i < use; i++, offset++) {
					if (data[i] !== config[offset])
						update = true;
				}
			}

			if (update) {	// write configuration
				let checksum = 0;
				for (let address = start, step = 16, offset = 0; address < end; address += step, offset += step) {
					let use = step;
					if ((address + use) > end)
						use = end - address;
					const slice = new  Uint8Array(use);
					for (let i = 0; i < use; i++)
						slice[i] = config[offset + i];

					io.write(Uint8Array.of(address >> 8, address & 0xff, slice));

					for (let i = 0; i < use; i++)
						checksum += slice[i];
				}
				checksum = ((~checksum) + 1) & 0xFF;
				io.write(Uint8Array.of(end >> 8, end & 0xff, checksum, 1));

				Timer.delay(100);
			}
		}

		io.write(Uint8Array.of(0x81, 0x4E, 0));		// ready for next reading
	}
	close() {
		this.#io?.close();
		this.#io = undefined;
	}
	configure() {
		//@@ set length... maybe fix-up below
		//@@ other config?
	}
	sample() {
		const io = this.#io;
		const buf = this.#byteBuffer;
		io.write(Uint8Array.of(0x81, 0x4E)); 		// GOODIX_READ_COOR_ADDR
		io.read(buf);

		const touchCount = buf[0] & 0b0000_1111;
		if (0 == touchCount) {
			io.write(Uint8Array.of(0x81, 0x4E, 0));	// ready for next reading
			return;
		}

		const data = new Uint8Array(touchCount * 8);
		io.read(data);

		const result = new Array(touchCount);
		for (let i = 0; i < touchCount; i++) {
			const offset = i * 8;
			const id = data[offset];
			if (id && (1 === io.length))
				continue;

			let x = (data[offset + 1] | (data[offset + 2] << 8));
			let y = (data[offset + 3] | (data[offset + 4] << 8));
			let size = (data[offset + 5] | (data[offset + 6] << 8));

			result[i] = {x, y, id, size};
		}

		io.write(Uint8Array.of(0x81, 0x4E, 0));	// ready for next reading

		return result;
	}

}

export default GT911;
