import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import sharp from "sharp";

import { createApi } from "unsplash-js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const ColorThief = require("colorthief");

dotenv.config();

const app = express();
app.use(cors());

const PORT = 8080;

const fallbackTitles = [
	"Home, Sweet Home",
	"Lost in the Moment",
	"A Place to Breathe",
	"Wander & Wonder",
	"Postcard Perfect",
	"Quiet Corners",
	"Beautiful",
];

//fetch photo-----------------------------------------
const api = createApi({
	accessKey: process.env.UNSPLASH_ACCESS_KEY,
});

async function loadImage() {
	const { data, error } = await api.GET('/photos/random', {
		params: {
			query: {
				collection: ["10466882"],
				orientation: 'landscape',
			}
		}
	});

    return data;
}

function getSavedWallpaper() {
	const file = fs.readFileSync("./wallpaper.json");
	return JSON.parse(file);
}

async function getWallpaper(force = false) {

	const saved = getSavedWallpaper();

	const today = new Date().toISOString().split("T")[0];

	if (!force && saved.date === today) {
		return saved;
	}

	//get new photo WITH a location
	let newPhoto;

	while (true){
		newPhoto = await loadImage();
		
		if(newPhoto.location.city != null){
			break;
		}
	}

	//save image via sharp
	const imageURL = newPhoto.urls.raw + "&w=3840";
	const response = await fetch(imageURL);
	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	await sharp(buffer).jpeg().toFile("./wallpapers/daily.jpg");

	//find colours in img via colorthief
	const palette = await ColorThief.getPalette("./wallpapers/daily.jpg", 3);

	//check if city isn't too long
	newPhoto.location.city = getDisplayCity(newPhoto.location.city);

	//save new stuff to new data
	const newData = {
		date: today,

		photo: newPhoto,

		colors: {
			palette: palette
		}
	};

	//update wallpaper.json
	fs.writeFileSync(
		"./wallpaper.json",
		JSON.stringify(newData, null, 4)
	);

	return newData;
}

function getDisplayCity(city) {
	if (!city) return null;

	if (city.length > 20) {
		const randomIndex = Math.floor(Math.random() * fallbackTitles.length);
		return fallbackTitles[randomIndex];
	}

	return city;
}

app.use("/wallpapers", express.static("wallpapers"));

app.get("/wallpaper", async (req, res) => {
	const force = req.query.force === "true";
	const wallpaper = await getWallpaper(force);

	res.json(wallpaper);
});
//----------------------------------------------------

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});