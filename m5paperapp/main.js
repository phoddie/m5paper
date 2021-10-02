import Poco from "commodetto/Poco";

const touch = new device.sensor.Touch({
	onSample() {
		trace(JSON.stringify(this.sample()), "\n");
	}
});

const humidityTemperature = new device.sensor.HumidityTemperature;
trace(JSON.stringify(humidityTemperature.sample(), undefined, 3), "\n");
humidityTemperature.close();

const rtc = new device.peripheral.RTC;
if (rtc.enabled)
	trace(`RTC date/time is ${new Date(rtc.time)}\n`);
else {
	trace(`Setting RTC  date/time to: ${new Date}\n`);
	rtc.time = Date.now();
}

for (let name in device.peripheral.button) {
	new device.peripheral.button[name]({
		onPush() {
			trace(`Button ${name}: ${this.pressed}\n`);
		}
	})
}

screen.clear();

for (let rotation = 0; rotation < 360; rotation += 90) {
	screen.rotation = rotation;

	const render = new Poco(screen, {pixels: screen.width * 16});

	const black = render.makeColor(0, 0, 0);
	const white = render.makeColor(255, 255, 255);
	const gray = render.makeColor(128, 128, 128);

	render.begin();
		render.fillRectangle(black, 0, 0, render.width, render.height);

		render.clip(20, 20, render.width - 40, render.height - 40);
		render.fillRectangle(white, 0, 0, render.width, render.height);

		render.clip(100, 100, render.width - 200, render.height - 200);
		render.fillRectangle(gray, 0, 0, render.width, render.height);

		render.clip();
		render.clip();

		render.fillRectangle(gray, 0, 0, 60, 60);
	render.end();
}
