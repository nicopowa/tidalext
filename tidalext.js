import {Util} from "./common/util.js";
import {TidalBackground} from "./background.js";
import {TidalOffscreen} from "./offscreen.js";
import {TidalPopup} from "./popup.js";

switch(Util.where) {

	case "bck":
		new TidalBackground();
		break;
	case "cnt":
		// TODO CONTENT SCRIPT CLASS
		break;
	case "pop":
		window.onload = () =>
			new TidalPopup();
		break;
	case "off":
		new TidalOffscreen();
		break;

}