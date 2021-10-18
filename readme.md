# Moddable SDK support for M5Paper
Updated October 18, 2021

This is experimental. The display fundamentals are working. Feel free to help.

The Moddable SDK examples that do not depend on a display generally seem to work as-is.

This porting effort depends on the new APIs standardized by [Ecma-419](https://419.ecma-international.org). This implementation depends on fixes in the latest Moddable SDK. Instructions for updating the Moddable SDK are in [https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/Moddable%20SDK%20-%20Getting%20Started.md#table-of-contents).

## Setup, build, run

Copy the directory at `targets/m5paper` to `$MODDABLE/build/devices/esp32/targets`

Then `cd` to the `m5paperapp` directory and build as usual:

```
mcconfig -d -m -p esp32/m5paper
```
The test app draws three rectangles using Poco. After that, it waits for touch interrupts and traces touch events to the xsbug console.

## macOS

The USB driver situation for M5Paper on macOS is ugly:

- Run at least macOS Big Sur
- Install the driver referenced in this [issue](https://github.com/Xinyuan-LilyGO/LilyGo-T-Call-SIM800/issues/139#issuecomment-904390716)

## Porting Status

The following are implemented and working:

- EPD display driver
- GT911 touch driver
- SHT30 temperature/humidity sensor
- A / B / C buttons 
- RTC (not yet integrated)

> *Note*: The I2C address of the GT911 touch controller floats. The implementation tries both addresses 0x14 and 0x5D. This is handled in host provider's Touch constructor -- not in driver and not in user script If 0x14 fails, an exception is thrown before it retries at 0x5D. If you encounter this, just hit Go in xsbug.

## Display Driver

The display driver is a [Poco `PixelsOut`](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/commodetto/commodetto.md#pixelsout-class) implementation. This allows it to use both the [Poco](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/commodetto/poco.md) graphics APIs and[ Piu](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/piu/piu.md) user interface framework from the Moddable SDK.

While many existing Poco and Piu examples run with the EPD, most are not practical. Because they were designed for a small color LCD with a high refresh rate, their appearance on a big gray display with a low refresh rate is often silly. We need some examples designed for this display.

The display driver is written entirely in JavaScript. It uses [Ecma-419 IO](https://419.ecma-international.org/#-9-io-class-pattern) APIs for all hardware access. Performance is excellent, often faster than the EPD class built into the native M5Paper library. One reason for this is that Poco can render directly to 4-bit gray pixels, eliminating the need for pixel format conversion. Another reason is that the SPI transfers to the display controller bulk transfer of thousands of pixels at a time, rather than four at a time. This reduces the number of bits transferred by over half.

Memory use is also quite low. There is no frame buffer in ESP32 memory: rendered pixels are sent directly to the display from a 16 line render buffer (about 8 KB).

Using the `continue` feature of Poco, it is possible to update several areas of the screen while only refreshing the EPD panel once. This allows for very efficient updates -- the least possible amount of memory is transferred and only one long panel flash occurs. The Piu balls example is a good way to see this in action - only the ball images (not the empty space around them) are transferred to the display and only the rectangle that encloses the four balls flashes on the display panel.

The rotation feature of the display controller is supported, allowing no-overhead rotation at 0, 90, 180, and 270 rotations.

### Update Modes
The display controller supports several different [update modes](https://github.com/phoddie/m5paper/blob/f0b79e0a0579c0dbdb1bb4445dc6acf501403681/targets/m5paper/it8951.js#L82-L93). The optimal mode depends on the content being drawn. The mode may be changed on each frame. The default mode is `GLD16`. To change the mode:

```js
screen.config({updateMode: "A2"});
```

### Image Filters
The display driver supports several different [pixel filters](https://github.com/phoddie/m5paper/blob/4110701c8084c07d7f777a44e17e970ffd18f729/targets/m5paper/it8951.js#L342-L349). These filter adjust the luminance of the pixels. The are useful for optimizing image and applying special effects. The default filter is "none". The filter may be changed on each frame. To change the filter:

```js
screen.config({filter: "negative"});
```

The filters are a `Uint8Array` of 16 values. To set your own filter, instead of using one of the built-in filters:

```js
let filter = new Uint8Array(16);
// code here to initialize filter
screen.config({filter});
```

### Notes

The reference driver used to guide this implementation is [here](https://github.com/m5stack/M5EPD/blob/63f6eb34697b0120e68d279fe0e22e5ec3aba61b/src/M5EPD_Driver.cpp). 

The data sheet is included in this [repository](./documentation).

- Pin numbers are correct - both SPI read and write work
- Using VSPI_HOST (like reference driver)
- Confirmed that most-significant bit is sent first (MSBFIRST) (like reference driver)
- Confirmed SPI Mode 0 used (SPI_MODE0)  (like reference driver)
- 10,000,000 Hz SPI (like reference driver)
- Sending 16-bit words in big endian byte order (as per data sheet)
- Confirmed that SPI writes are synchronous
- Reset pin is unused in M5Paper configuration
- UpdateMode.init always erases to white. There's no need to clear the memory buffer first.
- Handling of chip-select is different between M5Paper implementation and data sheet. Current implementation matches the data sheet. which toggles it less often.
- PixelsOut implements `continue` by unioning update areas

## Help

Thank you to Andy Carle for noticing that the io/spi module wasn't using the pin numbers passed to it.
