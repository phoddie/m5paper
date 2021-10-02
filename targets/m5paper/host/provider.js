/*
 * Copyright (c) 2021  Moddable Tech, Inc.
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

import Analog from "embedded:io/analog";
import Digital from "embedded:io/digital";
import DigitalBank from "embedded:io/digitalbank";
import I2C from "embedded:io/i2c";
import PulseCount from "embedded:io/pulsecount";
import PWM from "embedded:io/pwm";
import Serial from "embedded:io/serial";
import SMBus from "embedded:io/smbus";
import SPI from "embedded:io/spi";
import Touch from "embedded:sensor/touch/GT911";
import HumidityTemperature from "embedded:sensor/Humidity-Temperature/SHT3x"
import RTC from "embedded:peripherals/RTC-NXP/PCF8563"

class Button {
	#io;
	#onPush;

	constructor(options) {
		options = {...options};
		if (options.onReadable || options.onWritable || options.onError)
			throw new Error;

		if (options.target)
			this.target = options.target;

		const Digital = options.io;
		if (options.onPush) {
			this.#onPush = options.onPush; 
			options.onReadable = () => this.#onPush();
			options.edge = Digital.Rising | Digital.Falling;
		}

		this.#io = new Digital(options);
		this.#io.pressed = options.invert ? 0 : 1;
	}
	close() {
		this.#io?.close();
		this.#io = undefined;
	}
	get pressed() {
		return (this.#io.read() === this.#io.pressed) ? 1 : 0;
	}
}

const device = {
	I2C: {
		default: {
			io: I2C,
			data: 21,
			clock: 22
		}
	},
//	Serial: {
//		default: {
//			io: Serial,
//			port: 1,
//			receive: 3,
//			transmit: 1
//		}
//	},
	SPI: {
		default: {
			io: SPI,
			clock: 14,
			in: 13,
			out: 12,
			port: 2,		// VSPI_HOST
		}
	},
//	Analog: {
//		default: {
//			io: Analog,
//			pin: 33
//		}
//	},
	io: {Analog, Digital, DigitalBank, I2C, PulseCount, PWM, Serial, SMBus, SPI},
	pin: {
		powerMain: 2,
		powerExternal: 5,
		powerEPD: 23,
		touchInterrupt: 36,
		epdSelect: 15,     
		epdBusy: 27
	},
	sensor: {
		Touch: class {
			constructor(options) {
				let result;

				const o = {
					i2c: {...device.I2C.default},
					interrupt: {
						io: Digital,
						mode: Digital.Input,
						pin: device.pin.touchInterrupt
					}
				};
				if (options?.onSample)
					o.onSample = options.onSample; 

				// I2C address floats: try both
				try {
					o.i2c.address = 0x14;
					result = new Touch(o);
				}
				catch {
					o.i2c.address = 0x5D;
					result = new Touch(o);
				}

				return result;
			}
		},
		HumidityTemperature: class {
			constructor(options) {
				return new HumidityTemperature({
					sensor: {
						...device.I2C.default
					}
				});
			}
		}
	},
	peripheral: {
		RTC: class {
			constructor() {
				return new RTC({
					...device.I2C.default,
					io: SMBus
				});
			}
		},
		button: {
			A: class {
				constructor(options) {
					return new Button({
						...options,
						io: Digital,
						pin: 38,
						mode: Digital.InputPullUp,
						invert: true					
					});
				}
			},
			B: class {
				constructor(options) {
					return new Button({
						...options,
						io: Digital,
						pin: 37,
						mode: Digital.InputPullUp,
						invert: true					
					});
				}
			},
			C: class {
				constructor(options) {
					return new Button({
						...options,
						io: Digital,
						pin: 39,
						mode: Digital.InputPullUp,
						invert: true					
					});
				}
			}
		}
	}
};

export default device;
