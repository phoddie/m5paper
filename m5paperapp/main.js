import Poco from "commodetto/Poco";
import Bitmap from "commodetto/Bitmap";

const touch = new device.sensor.Touch({
	onSample() {
		trace(JSON.stringify(this.sample()), "\n");
	}
})

const humidityTemperature = new device.sensor.HumidityTemperature;
trace(JSON.stringify(humidityTemperature.sample(), undefined , 3), "\n");
humidityTemperature.close();

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
