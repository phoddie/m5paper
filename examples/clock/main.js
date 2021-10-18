/*
 * Copyright (c) 2016-2021  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK.
 * 
 *   This work is licensed under the
 *       Creative Commons Attribution 4.0 International License.
 *   To view a copy of this license, visit
 *       <http://creativecommons.org/licenses/by/4.0>.
 *   or send a letter to Creative Commons, PO Box 1866,
 *   Mountain View, CA 94042, USA.
 *
 */

import Time from "time";
import Timer from "timer";
import parseBMP from "commodetto/parseBMP";
import Poco from "commodetto/Poco";
import Resource from "Resource";

function drawTime(render, when) {
	let backgroundColor = render.makeColor(255, 255, 255);
	let digitsColor = render.makeColor(0, 0, 0);
	let colonColor = render.makeColor(128, 128, 128);
	let digits = parseBMP(new Resource("digits-alpha.bmp"));

	const digitWidth = Math.idiv(digits.width, 10);
	const digitHeight = digits.height;
	const colonWidth = 16;
	const timeWidth = (digitWidth << 2) + colonWidth;
	const bounds = { x:(render.width - timeWidth) >> 1, y:(render.height - digitHeight) >> 1, width:timeWidth, height:digitHeight };

	render.begin();
		render.fillRectangle(backgroundColor, 0, 0, render.width, render.height);

		let h = when.getHours();
		let m = when.getMinutes();
		let x = bounds.x;
		let y = bounds.y;
		render.fillRectangle(backgroundColor, 0, 0, render.width, render.height);
		if (Math.idiv(h, 10)) {
			render.drawGray(digits, digitsColor, x, y, Math.idiv(h, 10) * digitWidth, 0, digitWidth, digitHeight);
			x += digitWidth;
		}
		else
			x += digitWidth >> 1;
		render.drawGray(digits, digitsColor, x, y, (h % 10) * digitWidth, 0, digitWidth, digitHeight);
		x += digitWidth;

		render.fillRectangle(colonColor, x + 6, y + 10, 6, 6);
		render.fillRectangle(colonColor, x + 6, y + digitHeight - 18, 6, 6);
		x += colonWidth;
		render.drawGray(digits, digitsColor, x, y, Math.idiv(m, 10) * digitWidth, 0, digitWidth, digitHeight);
		x += digitWidth;
		render.drawGray(digits, digitsColor, x, y, (m % 10) * digitWidth, 0, digitWidth, digitHeight);

	render.end();
}

export default function () {
	const rtc = new device.peripheral.RTC;
	if (!rtc.enabled && (Date.now() > (new Date("July 1, 2021")).valueOf()))
		rtc.time = Date.now();

	rtc.alarm = rtc.time + 60_000;	// 1 minute

	Time.set(rtc.time / 1000);

	screen.clear();

	const render = new Poco(screen);
	drawTime(render, new Date);

	Timer.delay(500);

	screen.close();

	power.main.write(0);
}
