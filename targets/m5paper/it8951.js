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

import Timer from "timer";
import Bitmap from "commodetto/Bitmap";

/*
	EPD driver reference: https://github.com/m5stack/M5EPD/blob/63f6eb34697b0120e68d279fe0e22e5ec3aba61b/src/M5EPD_Driver.cpp
 */

const IT8951_TCON_SYS_RUN =         0x0001;
const IT8951_TCON_STANDBY =         0x0002;
const IT8951_TCON_SLEEP =           0x0003;
const IT8951_TCON_REG_RD =          0x0010;
const IT8951_TCON_REG_WR =          0x0011;

const IT8951_TCON_MEM_BST_RD_T =    0x0012;
const IT8951_TCON_MEM_BST_RD_S =    0x0013;
const IT8951_TCON_MEM_BST_WR =      0x0014;
const IT8951_TCON_MEM_BST_END =     0x0015;

const IT8951_TCON_LD_IMG =          0x0020;
const IT8951_TCON_LD_IMG_AREA =     0x0021;
const IT8951_TCON_LD_IMG_END =      0x0022;

//I80 User defined command code
const IT8951_I80_CMD_DPY_AREA =     0x0034;
const IT8951_I80_CMD_GET_DEV_INFO = 0x0302;
const IT8951_I80_CMD_DPY_BUF_AREA = 0x0037;
const IT8951_I80_CMD_VCOM =         0x0039;

//Endian Type
const IT8951_LDIMG_L_ENDIAN =    0;
const IT8951_LDIMG_B_ENDIAN =    1;

//Pixel mode (Bit per Pixel)
const IT8951_2BPP =             0;
const IT8951_3BPP =             1;
const IT8951_4BPP =             2;
const IT8951_8BPP =             3;

const M5EPD_PANEL_W =   960;
const M5EPD_PANEL_H =   540;

const IT8951_DISPLAY_REG_BASE =     0x1000; //Register RW access

const IT8951_UP0SR =       (IT8951_DISPLAY_REG_BASE + 0x134); //Update Parameter0 Setting Reg
const IT8951_UP1SR =       (IT8951_DISPLAY_REG_BASE + 0x138); //Update Parameter1 Setting Reg
const IT8951_LUT0ABFRV =   (IT8951_DISPLAY_REG_BASE + 0x13C); //LUT0 Alpha blend and Fill rectangle Value
const IT8951_UPBBADDR =    (IT8951_DISPLAY_REG_BASE + 0x17C); //Update Buffer Base Address
const IT8951_LUT0IMXY =    (IT8951_DISPLAY_REG_BASE + 0x180); //LUT0 Image buffer X/Y offset Reg
const IT8951_LUTAFSR =     (IT8951_DISPLAY_REG_BASE + 0x224); //LUT Status Reg (status of All LUT Engines)
const IT8951_BGVR =        (IT8951_DISPLAY_REG_BASE + 0x250); //Bitmap (1bpp) image color table

const IT8951_SYS_REG_BASE =         0x0000;

//Address of System Registers
const IT8951_I80CPCR =              (IT8951_SYS_REG_BASE + 0x04);

//Memory Converter Registers
const IT8951_MCSR_BASE_ADDR =       0x0200;
const IT8951_MCSR =                 (IT8951_MCSR_BASE_ADDR + 0x0000);
const IT8951_LISAR =                (IT8951_MCSR_BASE_ADDR + 0x0008);

const UpdateMode = {
                             //   Ghosting  Update Time  Usage
    INIT:     0,  // * N/A       2000ms       Display initialization, 
    DU:       1,  //   Low       260ms        Monochrome menu, text input, and touch screen input 
    GC16:     2,  // * Very Low  450ms        High quality images
    GL16:     3,  // * Medium    450ms        Text with white background 
    GLR16:    4,  //   Low       450ms        Text with white background
    GLD16:    5,  //   Low       450ms        Text and graphics with white background 
    DU4:      6,  // * Medium    120ms        Fast page flipping at reduced contrast
    A2:       7,  //   Medium    290ms        Anti-aliased text in menus / touch and screen input 
    NONE:     8
};        // The ones marked with * are more commonly used
Object.freeze(UpdateMode, true);

class EPD {
	_tar_memaddr = 0x001236E0;
	_endian_type;
	_pix_bpp;
// _direction -- unused. always 1
	_endian_type = IT8951_LDIMG_L_ENDIAN;
	_pix_bpp = IT8951_4BPP;

	constructor() {
		const Digital = device.io.Digital;
		const SPI = device.io.SPI;

		this.select = new Digital({
			pin: device.pin.epdSelect,
			mode: Digital.Output,
		});
		this.select.write(1);

		this.busy = new Digital({
			pin: device.pin.epdBusy,
			mode: Digital.Input,
		});

		this.spi = new SPI({
			...device.SPI.default,
			hz: 10_000_000
		});
		this.spi.write16 = function(value) {
			this.write(Uint8Array.of(value >> 8, value & 0xFF));
		}; 
		this.spi.transfer16 = function(value) {
			const buffer = Uint8Array.of(value >> 8, value & 0xFF);
			this.transfer(buffer);
			return (buffer[0] << 8) | buffer[1];
		}; 
		this.spi.write32 = function(value) {
			this.write(Uint8Array.of(value >> 24, value >> 16, value >> 8, value & 0xFF));
		}; 

		this.getSysInfo();

		this.writeCommand(IT8951_TCON_SYS_RUN);
		this.writeRegister(IT8951_I80CPCR, 0x0001); // enable pack write

		//set vcom to -2.30v
		this.writeCommand(0x0039); // tcon vcom set command
		this.writeWord(0x0001);
		this.writeWord(2300);

		Timer.delay(1000);
	}
	close() {
		this.spi?.close();
		this.select?.close();
		this.busy?.close();

		delete this.spi;
		delete this.select;
		delete this.busy;
	}
	clear() {
		this.updateFull(UpdateMode.INIT);
	}
	updateFull(mode) {
        this.updateArea(0, 0, M5EPD_PANEL_W, M5EPD_PANEL_H, mode);
	}
	checkAFSR() {
		const start = Date.now();
		do { 
			this.writeCommand(IT8951_TCON_REG_RD);
			this.writeWord(IT8951_LUTAFSR);
			const info = this.readWords(1);
			if (0 === info[0])
				return;

			if ((Date.now() - start) > 3000)
				throw new Error("time out");
		} while (true);
	}
	fillArea(x, y, w, h, color) {
		if (w & 3)
			throw new Error;

		if ((color < 0) || (color > 15))
			throw new Error;
	
		this.setTargetMemoryAddress(this._tar_memaddr);
        this.setArea(x, y, w, h);

		const pixels = new Uint16Array(w >> 2);
		pixels.fill(color | (color << 4) | (color << 8) | (color << 12));
		const buffer = pixels.buffer, spi = this.spi;

		this.select.write(0);
		spi.write(Uint16Array.of(0))
		while (h--)
			spi.write(buffer);
		this.select.write(1);

		this.writeCommand(IT8951_TCON_LD_IMG_END);
	}
	updateArea(x, y, w, h, mode) {
		if (UpdateMode.NONE === mode)
			return;

		// rounded up to be multiple of 4
		x = (x + 3) & ~3;

		this.checkAFSR();

        if (x + w > M5EPD_PANEL_W)
            w = M5EPD_PANEL_W - x;
        if (y + h > M5EPD_PANEL_H)
            h = M5EPD_PANEL_H - y;

		const args = Uint16Array.of(x, y, w, h, mode, this._tar_memaddr, this._tar_memaddr >> 16);
		this.writeArgs(IT8951_I80_CMD_DPY_BUF_AREA, args);
	}	
	
	setArea(x, y, w, h) {
		const area = Uint16Array.of(
			(this._endian_type << 8) | (this._pix_bpp << 4),
			x, y, w, h); 
		this.writeArgs(IT8951_TCON_LD_IMG_AREA, area);
	}
	writeArgs(command, buffer) {
		this.writeCommand(command);

		this.waitBusy();
		this.select.write(0);
		this.spi.write16(0x0000);
		this.waitBusy();

		for (let i = 0; i < buffer.length; i++) {
			this.spi.write16(buffer[i]);
			this.waitBusy();
		}
		this.select.write(1);
	}
	writeCommand(command) {
		this.waitBusy();
		this.select.write(0);
		this.spi.write16(0x6000);
		this.waitBusy();
		this.spi.write16(command);
		this.select.write(1);
	}
	setTargetMemoryAddress(address) {
		const h = (address >> 16) & 0xFFFF;
		const l = address & 0xFFFF;

    	this.writeRegister(IT8951_LISAR + 2, h);
    	this.writeRegister(IT8951_LISAR, l);
	}
	writeRegister(register, value) {
		this.writeCommand(0x0011); //tcon write reg command

		this.waitBusy();
		this.select.write(0);
		this.spi.write16(0x0000);
		this.waitBusy();
		this.spi.write16(register);
		this.waitBusy();
		this.spi.write16(value);
		this.select.write(1);
	}
	getSysInfo() {
    	this.writeCommand(IT8951_I80_CMD_GET_DEV_INFO);
		const info = this.readWords(20);
		const _tar_memaddr = (info[3] << 16) | info[2];
		if (_tar_memaddr !== this._tar_memaddr)
			trace(`unexpected _tar_memaddr value 0x${_tar_memaddr.toString(16)}\n`);
		
		if ((M5EPD_PANEL_W !== info[0]) || (M5EPD_PANEL_H !== info[1]))
			trace("unexpected panel dimensions\n");
	}
	writeWord(value) {
		this.waitBusy();
		this.select.write(0);
		this.spi.write16(0x0000);
		this.waitBusy();
		this.spi.write16(value);
		this.select.write(1);
	}
	waitBusy(timeout) {
		if (this.busy.read())
			return;

		if (!timeout)
			timeout = 3000;

		const start = Date.now();
		while (!this.busy.read()) {
			if ((Date.now() - start) > timeout)
				throw new Error("time out");
		}
	}
	readWords(length) {
    	this.waitBusy();
    	this.select.write(0);
    	this.spi.write16(0x1000);
    	this.waitBusy();

		// dummy
		this.spi.transfer16(0);
    	this.waitBusy();

		const result = new Array(length);
		for (let i = 0; i < length; i++)
			result[i] = this.spi.transfer16(0);

		this.select.write(1);
		
		return result;
	}
}

class Display {
	#epd = new EPD;
	#area = {};
	#rotation = 0;

	constructor(options) {
		this.#epd.setTargetMemoryAddress(this.#epd._tar_memaddr);	
	}
	close() {
		this.#epd?.close();
		this.#epd = undefined;
	}
	configure(options) {
	}
	begin(x, y, width, height) {
		const epd = this.#epd, area = this.#area;

		if ((x | width) & 3)
			throw new Error;

		area.x = x, area.y = y, area.width = width, area.height = height;

        epd.setArea(x, y, width, height);

		epd.select.write(0);
		epd.spi.write(Uint16Array.of(0))
	}
	send(data) {
		this.#epd.spi.write(data);
	}
	end() {
		const epd = this.#epd;

		epd.select.write(1);
		epd.writeCommand(IT8951_TCON_LD_IMG_END);

		const area = this.#area;
		epd.updateArea(area.x, area.y, area.width, area.height, UpdateMode.GC16);
	}
	adaptInvalid(area) {
		if (area.x & 3) {
			area.w += area.x & 3;
			area.x &= ~3;
		}
		area.w = (area.w + 3) & ~3;
	}
	clear() {
		this.#epd.updateFull(UpdateMode.INIT);
	}
	get width() {
		return (this.#rotation & 1) ? M5EPD_PANEL_H : M5EPD_PANEL_W;
	}
	get height() {
		return (this.#rotation & 1) ? M5EPD_PANEL_W : M5EPD_PANEL_H;
	}
	get pixelFormat() {
		return Bitmap.Gray16;
	}
	pixelsToBytes(pixels) {
		return (pixels + 1) >> 1;
	}
}
Display.prototype.continue = Display.prototype.end; 

export default Display 
