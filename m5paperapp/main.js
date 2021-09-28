import Timer from "timer";

const touch = new device.sensor.Touch({
	onSample() {
		const points = this.sample();

		points?.forEach((point, i) => {
			const id = point.id;
			delete point.id;
			trace(`Point ${id}: ${JSON.stringify(point)}\n`);
		});
	}
})

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


class EPD {
	_tar_memaddr = 0x001236E0;
	_dev_memaddr_l = 0x36E0;
	_dev_memaddr_h = 0x0012;
	_endian_type;
	_pix_bpp;
// _direction -- unused. always 1

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
			hz: 10_000_000,
//			select: 4,		//@@  _epd_spi->begin(sck, miso, mosi, 4);... but that 4 (cs/SS) appears to be unused... and 4 seems to be CS for SD Card
		});
		this.spi.write16 = function(value) {
//			this.write(Uint8Array.of(value & 0xFF, value >> 8));
			this.write(Uint8Array.of(value >> 8, value & 0xFF));			// according to IT9051 data sheet section 7.4.2 - values are big endian
		}; 
		this.spi.transfer16 = function(value) {
			const buffer = Uint8Array.of(value >> 8, value & 0xFF);
			this.transfer(buffer);
			return (buffer[0] << 8) | buffer[1];
		}; 
		this.spi.write32 = function(value) {
//			this.write(Uint8Array.of(value & 0xFF, value >> 8, value >> 16, value >> 24));
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
	}
	clear(init = false) {
		this._endian_type = IT8951_LDIMG_L_ENDIAN;
		this._pix_bpp = IT8951_4BPP;

		this.setTargetMemoryAddress(this._tar_memaddr);
        this.setArea(0, 0, M5EPD_PANEL_W, M5EPD_PANEL_H);

		let count = (M5EPD_PANEL_W * M5EPD_PANEL_H) >> 2;
		const buffer = Uint8Array.of(0xFF, 0xFF, 0, 0).buffer;
		const select = this.select, spi = this.spi;
		do {
            select.write(0);
            spi.write(buffer);
            select.write(1);
		} while (--count);

		this.writeCommand(IT8951_TCON_LD_IMG_END);
		
		if (init)
			this.updateFull(UpdateMode.INIT);
	}
	updateFull(mode) {
        this.updateArea(0, 0, M5EPD_PANEL_W, M5EPD_PANEL_H, mode);
	}
	checkAFSR() {
		const start = Date.now();
		while (true) { 
			this.writeCommand(IT8951_TCON_REG_RD);
			this.writeWord(IT8951_LUTAFSR);
			const info = this.readWords(1);
			if (0 === info[0])
				return;

			if ((Date.now() - start) > 3000)
				throw new Error("time out");
		}
	}
	updateArea(x, y, w, h, mode) {
		if (UpdateMode.NONE === mode)
			return;

		// rounded up to be multiple of 4
		x = (x + 3) & ~3;

		this.checkAFSR();

        if(x + w > M5EPD_PANEL_W)
            w = M5EPD_PANEL_W - x;
        if(y + h > M5EPD_PANEL_H)
            h = M5EPD_PANEL_H - y;

		const args = Uint16Array.of(x, y, w, h, mode, this._dev_memaddr_l, this._dev_memaddr_h);
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

		this.select.write(0);
		this.spi.write16(0x0000);

		for (let i = 0; i < buffer.length; i++)
			this.spi.write16(buffer[i]);
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
		let _dev_memaddr_l = info[2];
		let _dev_memaddr_h = info[3];
		let _tar_memaddr = (_dev_memaddr_h << 16) | _dev_memaddr_l;
		if (0 === _tar_memaddr)
			trace(`_tar_memaddr looks incorrect 0x${_tar_memaddr.toString(16)}\n`);
	}
	writeWord(value) {
		this.waitBusy();
		this.select.write(0);
		this.spi.write16(0x0000);
		this.waitBusy();
		this.spi.write16(value);
		this.select.write(1);
	}
	waitBusy(timeout = 3000) {
		const start = Date.now();
		while (true) {
			if (this.busy.read())
				return;

			if ((Date.now() - start) > timeout)
				throw new Error("time out");
		}
	}
	readWords(length) {
    	this.waitBusy();
    	this.select.write(0);
    	this.spi.write16(0x1000);
    	this.waitBusy();

		//dummy
		this.spi.transfer16(0);
    	this.waitBusy();

		let result = new Array(length);
		for (let i = 0; i < length; i++)
			result[i] = this.spi.transfer16(0);

		this.select.write(1);
		
		return result;
	}
}

/*
	App reference:  https://github.com/m5stack/M5EPD/blob/63f6eb34697b0120e68d279fe0e22e5ec3aba61b/examples/Basics/Button/Button.ino#L13
 */

let e = new EPD;
e.clear(true);
