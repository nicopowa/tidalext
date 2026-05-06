import {Util} from "./util.js";
import {ExtBck} from "../background.js";
import {ExtOff} from "./off.js";
import {ExtPop} from "./pop.js";

//if(DEBUG) console.log("entry", Util.where);

switch(Util.where) {

	case "bck":
		new ExtBck()
		.liftoff();
		break;
	case "cnt":
		// content script class ?
		break;
	case "pop":
		window.onload = () =>
			new ExtPop()
			.liftoff();
		break;
	case "off":
		new ExtOff();
		break;

}