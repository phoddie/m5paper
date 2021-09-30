# Moddable SDK support for M5Paper
Updated September 30, 2021

This is experimental. The display fundamentals are working. Feel free to help.

The Moddable SDK examples that do not depend on a display generally seem to work as-is.

This porting effort depends on the new APIs defined by [Ecma-419](https://419.ecma-international.org). This implementation depends on fixes in the latest Moddable SDK.

There is a working GT911 touch driver. The I2C address of the GT911 floats. The implementation tries both addresses 0x14 and 0x5D. Handled in host provider's Touch constructor -- not in driver and not in user script If 0x14 fails, an exception is thrown before it retries at 0x5D. If you encounter this, just hit Go in xsbug.

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

## EPD Notes

EPD display driver implemented. It is able to initialize the screen. It can fill rectangles. For development convenience, the `EPD` class is built into `main.js`.

The reference driver used to guide this implementation is [here](https://github.com/m5stack/M5EPD/blob/63f6eb34697b0120e68d279fe0e22e5ec3aba61b/src/M5EPD_Driver.cpp). The organization is similar. Once it works, it can be restructured for ease of integration with Poco and Piu.

The data sheet is included in this [repository](./documentation).

- Pin numbers are correct - both SPI read and write work
- Using VSPI_HOST (like reference driver)
- Confirmed that most-significant bit is sent first (MSBFIRST) (like reference driver)
- Confirmed SPI Mode 0 used (SPI_MODE0)  (like reference driver)
- 10,000,000 Hz SPI (like reference driver)
- Sending 16-bit words in big endian byte order (as per data sheet)
- Confirmed that SPI writes are synchronous
- Reset pin is unused in M5Paper configuration
- The reference driver is slow (writes 4 pixels per translation). This implementation uses bulk writes for speed.
- UpdateMode.init always erases to white. There's no need to clear the memory buffer first.
- Handling of chip-select is different between M5Paper implementation and data sheet. Current implementation matches the data sheet. which toggles it less often.
- Rotation implemented
- Implemented Commodetto PixelsOut for rendering with Poco

## Help

Thank you to Andy Carle for noticing that the io/spi module wasn't using the pin numbers passed to it.
