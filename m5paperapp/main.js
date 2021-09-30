import Poco from "commodetto/Poco";
import Bitmap from "commodetto/Bitmap";

const touch = new device.sensor.Touch({
	onSample() {
		trace(JSON.stringify(this.sample()), "\n");
	}
})

const render = new Poco(screen, {pixels: screen.width * 16});

const black = render.makeColor(0, 0, 0);
const white = render.makeColor(255, 255, 255);

render.begin();
	render.fillRectangle(black, 0, 0, render.width, render.height);

	render.clip(20, 20, render.width - 40, render.height - 40);
	render.fillRectangle(white, 0, 0, render.width, render.height);

	render.clip(100, 100, render.width - 200, render.height - 200);
	render.fillRectangle(render.makeColor(128, 128, 128), 0, 0, render.width, render.height);

	render.clip();
	render.clip();
render.end();
