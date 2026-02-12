import dotenv from "dotenv";
dotenv.config();

import express from "express";
import {publishToTistory} from "./publisher";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.json({message: "Publisher server running"});
});

app.post("/publish", async (req, res) => {
    const {title, content} = req.body;

    try {
        await publishToTistory(title, content);
        res.json({success: true});
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false});
    }
});

app.listen(4000, () => {
    console.log("Server running on port 4000");
});